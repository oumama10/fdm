import logging
import os
import json
from decimal import Decimal
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import (
    IsAdmin,
    IsFournisseur,
    IsGestionnaireOrAdmin,
    IsServiceFinanciere,
)
from apps.resources.utils import normalize_sous_categorie_name

from .models import (
    ImportExcelBC,
    LotArticle,
    MarcheBC,
    MarcheEtape,
    StagingItem,
)
from .serializers import (
    ImportExcelBCSerializer,
    ImportExcelBCStatusSerializer,
    LotArticleSerializer,
    MarcheBCSerializer,
    MarcheEtapeSerializer,
    StagingItemSerializer,
)


logger = logging.getLogger(__name__)

# Workflow status reference:
# - Financial import:
#   ImportExcelBC.statut_import = "en_attente"
#   MarcheBC.statut = "en_attente_livraison"
#   StagingItem.statut = "en_attente"
# - Financial send to manager:
#   ImportExcelBC.statut_import = "en_revision"
# - Manager validates and integrates:
#   StagingItem.statut = "approuve"
#   ImportExcelBC.statut_import = "valide"
#   MarcheBC.statut = "receptionne_et_stocke"
# - Manager rejects extraction:
#   StagingItem.statut = "rejete"
#   ImportExcelBC.statut_import = one of ["non_conforme", "document_invalide", "autre"]


def _integrate_item_into_stock(item, ressource, lot):
    from apps.resources.models import InstanceRessource, MouvementStock, Stock
    from .signals import generate_numero_inventaire
    logger.info(f"[STOCK INTEGRATION] Processing item {item.id_staging}, ressource {ressource.designation}, is_consommable={ressource.is_consommable}, quantite={item.quantite}")

    if item.quantite <= 0:
        logger.warning(f"[STOCK INTEGRATION] Skipping item {item.id_staging} with invalid quantity {item.quantite}")
        return

    if ressource.is_consommable:
        logger.info(f"[STOCK INTEGRATION] Creating/updating Stock for consumable {ressource.designation}")
        stock, created = Stock.objects.get_or_create(id_ressource=ressource)
        logger.info(f"[STOCK INTEGRATION] Stock {'created' if created else 'found'}, current quantite={stock.quantite_disponible}, adding {item.quantite}")
        Stock.objects.filter(pk=stock.pk).update(
            quantite_disponible=F('quantite_disponible') + item.quantite
        )
        MouvementStock.objects.create(
            type_mouvement='entree',
            quantite=item.quantite,
            id_ressource=ressource,
        )
        logger.info(f"[STOCK INTEGRATION] Stock updated, MouvementStock created")
    else:
        logger.info(f"[STOCK INTEGRATION] Creating InstanceRessource for inventory item {ressource.designation}")
        # Bien inventaire: one InstanceRessource per unit
        marche = getattr(lot, "id_marche", None)
        acquisition_date = None
        if marche is not None:
            acquisition_date = marche.date_creation or marche.date_livraison_prevue
        instances = []
        for i in range(item.quantite):
            instances.append(
                InstanceRessource(
                    id_ressource=ressource,
                    id_lot=lot,
                    numero_inventaire=generate_numero_inventaire(),
                    date_acquisition=acquisition_date,
                    statut='en_stock',
                    etat='neuf',
                )
            )
        if instances:
            InstanceRessource.objects.bulk_create(instances)
            logger.info(f"[STOCK INTEGRATION] Created {len(instances)} InstanceRessource entries")
        MouvementStock.objects.create(
            type_mouvement='entree',
            quantite=item.quantite,
            id_ressource=ressource,
        )
        logger.info(f"[STOCK INTEGRATION] MouvementStock created for inventory item")


def _trigger_extract(import_id: int) -> None:
    """
    Trigger OCR extraction via Celery when available.

    If broker/backend is unavailable (e.g. Redis down in local dev),
    fallback to synchronous execution so upload endpoint remains functional.
    """
    from apps.procurement.models import ImportExcelBC  # noqa: PLC0415
    from .tasks import extract_excel_items, extract_pdf_items  # noqa: PLC0415

    logger.info("[IMPORT %s] Trigger extract START", import_id)

    try:
        import_obj = ImportExcelBC.objects.get(id_import=import_id)
    except ImportExcelBC.DoesNotExist:
        logger.error("[IMPORT %s] Import object not found", import_id)
        return

    file_path = ""
    try:
        file_path = import_obj.fichier_excel_original.path
    except Exception:
        file_path = str(import_obj.fichier_excel_original)

    logger.info(
        "[IMPORT %s] File type=%s path=%s",
        import_id,
        import_obj.file_type,
        file_path,
    )

    try:
        if import_obj.file_type == "pdf":
            result = extract_pdf_items.apply_async(
                args=[import_id],
                queue="ocr",
                ignore_result=True,
            )
        else:
            result = extract_excel_items.apply_async(
                args=[import_id],
                queue="ocr",
                ignore_result=True,
            )
        logger.info("[IMPORT %s] Task queued: %s", import_id, result.id)
    except Exception as exc:
        logger.error("[IMPORT %s] Celery failure: %s", import_id, exc)
        logger.warning("[IMPORT %s] Falling back to sync execution", import_id)
        if import_obj.file_type == "pdf":
            extract_pdf_items.run(import_id, retry_enabled=False)
        else:
            extract_excel_items.run(import_id, retry_enabled=False)


# ---------------------------------------------------------------------------
# 1. MarcheBCViewSet
# ---------------------------------------------------------------------------


class MarcheBCViewSet(viewsets.ModelViewSet):
    """
    Permissions per action
    ----------------------
    list / retrieve       : IsGestionnaireOrAdmin | IsFournisseur | IsServiceFinanciere
                            Fournisseurs see only their own marches (queryset
                            filtered), so no separate object-level check needed.
    create / update       : IsServiceFinanciere | IsGestionnaireOrAdmin
    destroy               : IsAdmin
    """

    serializer_class = MarcheBCSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [(IsGestionnaireOrAdmin | IsFournisseur | IsServiceFinanciere)()]
        if self.action in ("create", "update", "partial_update"):
            return [(IsServiceFinanciere | IsGestionnaireOrAdmin)()]
        if self.action == "destroy":
            return [IsAdmin()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = MarcheBC.objects.select_related(
            "id_fournisseur", "id_cree_par", "import_excel"
        ).prefetch_related("etapes")

        user = self.request.user
        # Fournisseurs only see marches that belong to them.
        if (
            user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "fournisseur"
        ):
            fournisseur_profile = getattr(user, "fournisseur_profile", None)
            if fournisseur_profile is not None:
                # fournisseur_profile is a reverse OneToOne — a single object
                qs = qs.filter(id_fournisseur=fournisseur_profile)
            else:
                qs = qs.none()

        return qs

    def perform_create(self, serializer):
        serializer.save(id_cree_par=self.request.user)


# ---------------------------------------------------------------------------
# 2. MarcheEtapeViewSet
# ---------------------------------------------------------------------------


class MarcheEtapeViewSet(viewsets.ModelViewSet):
    """
    Permissions per action
    ----------------------
    list / retrieve  : IsGestionnaireOrAdmin | IsFournisseur | IsServiceFinanciere
                       Fournisseurs see only etapes of their own marches.
    all write ops    : IsGestionnaireOrAdmin
    """

    serializer_class = MarcheEtapeSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [(IsGestionnaireOrAdmin | IsFournisseur | IsServiceFinanciere)()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = MarcheEtape.objects.select_related("id_marche", "id_modifie_par").all()

        # Narrow by ?id_marche= query param
        if id_marche := self.request.query_params.get("id_marche"):
            qs = qs.filter(id_marche=id_marche)

        # Fournisseurs see only etapes of their own marches
        user = self.request.user
        if (
            user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "fournisseur"
        ):
            fournisseur_profile = getattr(user, "fournisseur_profile", None)
            if fournisseur_profile is not None:
                qs = qs.filter(id_marche__id_fournisseur=fournisseur_profile)
            else:
                qs = qs.none()

        return qs

    def perform_update(self, serializer):
        serializer.save(id_modifie_par=self.request.user)


# ---------------------------------------------------------------------------
# 3. ImportExcelBCViewSet
# ---------------------------------------------------------------------------


class ImportExcelBCViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    POST /api/procurement/import/         — upload + trigger OCR task
    GET  /api/procurement/import/{id}/    — retrieve with staging_items count
    """

    serializer_class = ImportExcelBCSerializer
    permission_classes = [(IsServiceFinanciere | IsGestionnaireOrAdmin)]
    queryset = ImportExcelBC.objects.prefetch_related("staging_items").all()

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [(IsServiceFinanciere | IsGestionnaireOrAdmin)()]
        if self.action == "envoyer_gestionnaire":
            return [(IsServiceFinanciere | IsGestionnaireOrAdmin)()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return ImportExcelBCStatusSerializer
        return ImportExcelBCSerializer

    def get_queryset(self):
        return (
            ImportExcelBC.objects.select_related("id_marche", "id_importe_par")
            .prefetch_related("staging_items")
            .order_by("-date_import")
        )

    def perform_create(self, serializer):
        instance = serializer.save(id_importe_par=self.request.user)
        _trigger_extract(instance.pk)

    @action(detail=True, methods=["post"], url_path="envoyer-gestionnaire")
    def envoyer_gestionnaire(self, request, pk=None):
        from apps.alerts.models import Notification  # noqa: PLC0415
        from apps.users.models import Utilisateur  # noqa: PLC0415

        import_obj = self.get_object()

        if import_obj.statut_import in ("non_conforme", "autre"):
            return Response(
                {"detail": "Impossible d'envoyer un import rejeté."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if import_obj.statut_import == "valide":
            return Response(
                {"detail": "Cet import a déjà été envoyé au gestionnaire."},
                status=status.HTTP_200_OK,
            )

        if import_obj.statut_import == "en_revision":
            return Response(
                {"detail": "Cet import est déjà en révision chez le gestionnaire."},
                status=status.HTTP_200_OK,
            )

        if import_obj.statut_import != "en_attente":
            return Response(
                {"detail": "L'extraction doit être terminée avant envoi au gestionnaire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item_count = import_obj.staging_items.count()
        if item_count == 0:
            return Response(
                {"detail": "Aucun article extrait à envoyer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = ContentType.objects.get_for_model(ImportExcelBC)
        gestionnaires = Utilisateur.objects.filter(
            id_role__nom_role="gestionnaire_magasin",
            actif=True,
        ).only("id_utilisateur")

        notifications = [
            Notification(
                id_destinataire=g,
                type_notification="validation_requise",
                titre="Import prêt pour révision",
                message=(
                    f"L'import #{import_obj.id_import} contient {item_count} article(s) "
                    "en attente de validation."
                ),
                canal="web",
                content_type=content_type,
                object_id=import_obj.id_import,
            )
            for g in gestionnaires
        ]

        if notifications:
            Notification.objects.bulk_create(notifications)

        import_obj.statut_import = "en_revision"
        import_obj.save(update_fields=["statut_import"])

        return Response(
            {
                "detail": "Import envoyé au gestionnaire.",
                "notifications_sent": len(notifications),
            },
            status=status.HTTP_200_OK,
        )

class DirectImportView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        return [(IsServiceFinanciere | IsGestionnaireOrAdmin)()]

    def post(self, request):
        fichier = request.FILES.get("fichier_excel") or request.FILES.get(
            "fichier_excel_original"
        )
        source_type_raw = request.data.get("source_type", "bon_commande")

        if not fichier:
            return Response({"error": "Fichier manquant"}, status=400)

        filename = (fichier.name or "").lower()
        if filename.endswith(".pdf"):
            file_type = "pdf"
        elif filename.endswith(".xlsx"):
            file_type = "xlsx"
        else:
            return Response(
                {"error": "Format non supporté. Utilisez .xlsx ou .pdf"},
                status=400,
            )

        # ImportExcelBC expects: bc | marche | donation
        source_type_import = (
            "bc" if source_type_raw == "bon_commande" else source_type_raw
        )
        if source_type_import not in ("bc", "marche", "donation"):
            source_type_import = "bc"

        # MarcheBC expects: marche | bon_commande | donation
        type_acquisition = (
            "bon_commande"
            if source_type_import == "bc"
            else source_type_import
        )

        timestamp = timezone.now().strftime("%Y%m%d%H%M%S%f")
        marche = MarcheBC.objects.create(
            reference=f"IMPORT-{timestamp}",
            type_acquisition=type_acquisition,
            statut="en_attente_livraison",
            id_cree_par=request.user,
            id_fournisseur=None,
        )

        import_obj = ImportExcelBC.objects.create(
            fichier_excel_original=fichier,
            titre_fichier=os.path.splitext(fichier.name)[0][:255],
            file_type=file_type,
            source_type=source_type_import,
            statut_import="en_attente",
            id_marche=marche,
            id_importe_par=request.user,
        )

        _trigger_extract(import_obj.id_import)

        return Response(
            {
                "id_import": import_obj.id_import,
                "id_marche": marche.id_marche,
                "statut_import": import_obj.statut_import,
                "file_type": import_obj.file_type,
            },
            status=201,
        )


class ManualImportView(APIView):
    def get_permissions(self):
        return [(IsServiceFinanciere | IsGestionnaireOrAdmin)()]

    def post(self, request):
        data = request.data or {}

        type_acquisition = data.get("type_acquisition") or "bon_commande"
        if type_acquisition not in ("marche", "bon_commande", "donation"):
            type_acquisition = "bon_commande"

        source_type = "bc" if type_acquisition == "bon_commande" else type_acquisition
        if source_type not in ("bc", "marche", "donation"):
            source_type = "bc"

        titre_fichier = (data.get("titre_fichier") or "").strip()[:255]
        reference_document = (data.get("reference_document") or "").strip()[:150]
        fournisseur_denomination = (data.get("fournisseur_denomination") or "").strip()[:255]
        fournisseur_telephone = (data.get("fournisseur_telephone") or "").strip()[:50]
        fournisseur_email = (data.get("fournisseur_email") or "").strip()
        fournisseur_adresse = (data.get("fournisseur_adresse") or "").strip()
        delai_execution = (data.get("delai_execution") or "").strip()[:255]
        type_donateur = (data.get("type_donateur") or "").strip() or None
        nom_donateur = (data.get("nom_donateur") or "").strip() or None
        organisme_donateur = (data.get("organisme_donateur") or "").strip() or None
        contact_donateur = (data.get("contact_donateur") or "").strip() or None

        if type_acquisition == "donation" and not nom_donateur:
            return Response(
                {"nom_donateur": "Le nom du donateur est obligatoire pour un don."},
                status=400,
            )

        lignes = data.get("lignes") or []
        if not isinstance(lignes, list) or len(lignes) == 0:
            return Response({"detail": "Ajoutez au moins une ligne d'article."}, status=400)

        # Build/attach supplier when possible so list pages display supplier directly.
        fournisseur_obj = None
        if fournisseur_denomination:
            from apps.users.models import Fournisseur  # noqa: PLC0415

            fournisseur_obj = Fournisseur.objects.filter(
                nom_societe__iexact=fournisseur_denomination
            ).first()
            if not fournisseur_obj:
                fournisseur_obj = Fournisseur.objects.create(
                    nom_societe=fournisseur_denomination,
                    nom_responsable=fournisseur_denomination,
                    email=fournisseur_email or "manual@placeholder.local",
                    telephone=fournisseur_telephone,
                    adresse=fournisseur_adresse,
                )

        marche_reference = reference_document or f"MANUAL-{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
        marche = MarcheBC.objects.create(
            reference=marche_reference,
            type_acquisition=type_acquisition,
            statut="en_attente_livraison",
            type_donateur=type_donateur,
            nom_donateur=nom_donateur,
            organisme_donateur=organisme_donateur,
            contact_donateur=contact_donateur,
            id_cree_par=request.user,
            id_fournisseur=fournisseur_obj,
        )

        import_obj = ImportExcelBC(
            titre_fichier=titre_fichier or marche_reference,
            reference_document=reference_document,
            fournisseur_denomination=fournisseur_denomination,
            fournisseur_telephone=fournisseur_telephone,
            fournisseur_email=fournisseur_email,
            fournisseur_adresse=fournisseur_adresse,
            delai_execution=delai_execution,
            file_type="xlsx",
            source_type=source_type,
            statut_import="en_attente",
            id_marche=marche,
            id_importe_par=request.user,
        )

        fake_name = f"manual_{timezone.now().strftime('%Y%m%d%H%M%S%f')}.txt"
        import_obj.fichier_excel_original.save(
            fake_name,
            ContentFile("Manual import entry"),
            save=False,
        )
        import_obj.save()

        staging_items = []
        for ligne in lignes:
            if not isinstance(ligne, dict):
                continue

            designation = str(ligne.get("designation") or "").strip()
            if not designation:
                continue

            description = str(ligne.get("description") or "").strip()
            unite = str(ligne.get("unite") or "U").strip()[:20]
            observation = str(ligne.get("observation") or "").strip()
            type_detecte = str(ligne.get("type_produit") or "").strip()
            if type_detecte not in ("consommable", "bien_inventaire"):
                type_detecte = ""

            id_categorie_suggeree = ligne.get("id_categorie") or None

            correction_payload = {
                "numero_lot": ligne.get("numero_lot") or 1,
                "n_inventaire": str(ligne.get("n_inventaire") or "").strip(),
                "id_sous_categorie": ligne.get("id_sous_categorie") or None,
                "observation": observation,
            }

            try:
                quantite = max(1, int(float(str(ligne.get("quantite") or 1).replace(",", "."))))
            except Exception:
                quantite = 1

            def _to_decimal(value):
                if value in (None, ""):
                    return None
                try:
                    return Decimal(str(value).replace(" ", "").replace(",", ".")).quantize(Decimal("0.01"))
                except Exception:
                    return None

            staging_items.append(
                StagingItem(
                    id_import=import_obj,
                    designation_brute=designation[:500],
                    description=description[:4000],
                    designation_normalisee=designation[:255],
                    quantite=quantite,
                    unite=unite or "U",
                    prix_unitaire_ht=_to_decimal(ligne.get("prix_unitaire_ht")),
                    prix_total_ht=_to_decimal(ligne.get("prix_total_ht")),
                    statut="en_attente",
                    type_detecte=type_detecte,
                    id_categorie_suggeree_id=id_categorie_suggeree,
                    correction_gestionnaire=json.dumps(correction_payload),
                )
            )

        if not staging_items:
            import_obj.delete()
            marche.delete()
            return Response({"detail": "Les lignes sont invalides."}, status=400)

        StagingItem.objects.bulk_create(staging_items, batch_size=200)

        return Response(
            {
                "id_marche": marche.id_marche,
                "id_import": import_obj.id_import,
                "detail": "Import manuel créé.",
            },
            status=201,
        )


# ---------------------------------------------------------------------------
# 4. StagingItemViewSet
# ---------------------------------------------------------------------------


class _NoCreateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """List + retrieve + update — no create, no destroy."""


class StagingItemViewSet(_NoCreateViewSet):
    """
    list / retrieve / update  : IsGestionnaireOrAdmin | IsServiceFinanciere
    approve / reject actions  : IsGestionnaireOrAdmin

    Creation is handled exclusively by the Celery OCR task.

    POST /staging/{id}/approve/  — sets statut='approuve' (triggers signal)
    POST /staging/{id}/reject/   — sets statut='rejete'
    """

    serializer_class = StagingItemSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "update", "partial_update"):
            return [(IsGestionnaireOrAdmin | IsServiceFinanciere)()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = StagingItem.objects.select_related(
            "id_import",
            "id_categorie_suggeree",
            "id_ressource_liee",
        ).all()
        if id_import := self.request.query_params.get("id_import"):
            qs = qs.filter(id_import=id_import)
        if statut := self.request.query_params.get("statut"):
            qs = qs.filter(statut=statut)
        return qs

    # ── approve ──────────────────────────────────────────────────────────────

    @action(detail=False, methods=["patch"], url_path="bulk-validate")
    def bulk_validate(self, request):
        from apps.resources.models import Categorie, Ressource, SousCategorie  # noqa: PLC0415

        payload = request.data if isinstance(request.data, dict) else {}
        raw_items = payload.get("articles") or payload.get("items")
        if raw_items is None:
            raw_items = request.data

        if not isinstance(raw_items, list) or not raw_items:
            return Response(
                {"detail": "Aucune ligne à valider."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_items = []
        import_ids = set()

        with transaction.atomic():
            for payload in raw_items:
                if not isinstance(payload, dict):
                    return Response(
                        {"detail": "Chaque ligne doit être un objet."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                item_id = payload.get("id_staging") or payload.get("idStaging")
                if not item_id:
                    return Response(
                        {"detail": "Chaque ligne doit contenir un identifiant."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    item = self.get_queryset().select_for_update().get(pk=item_id)
                except StagingItem.DoesNotExist:
                    return Response(
                        {"detail": f"La ligne {item_id} est introuvable."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if item.statut == "approuve":
                    return Response(
                        {"detail": f"La ligne {item_id} est déjà approuvée."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                import_ids.add(item.id_import_id)

                update_data = {
                    key: payload.get(key)
                    for key in (
                        "designation_normalisee",
                        "description",
                        "quantite",
                        "type_detecte",
                        "correction_gestionnaire",
                        "prix_unitaire_ht",
                        "prix_total_ht",
                        "unite",
                        "id_categorie_suggeree",
                        "id_ressource_liee",
                    )
                    if key in payload
                }

                # Auto-link a resource from manual taxonomy inputs when frontend
                # does not provide an explicit existing id_ressource_liee.
                if not update_data.get("id_ressource_liee") and not item.id_ressource_liee_id:
                    designation = (
                        (update_data.get("designation_normalisee") or item.designation_normalisee or item.designation_brute or "")
                        .strip()
                    )[:255]

                    category_obj = None
                    category_id = update_data.get("id_categorie_suggeree") or item.id_categorie_suggeree_id
                    if category_id:
                        category_obj = Categorie.objects.filter(pk=category_id).first()

                    if category_obj is None:
                        type_detecte = str(update_data.get("type_detecte") or item.type_detecte or "").strip().lower()
                        category_name = "Bien Inventaire" if type_detecte == "bien_inventaire" else "Consommable"
                        category_obj, _ = Categorie.objects.get_or_create(
                            nom_categorie=category_name,
                            defaults={"description": category_name, "actif": True},
                        )
                        update_data["id_categorie_suggeree"] = category_obj.id_categorie

                    correction_payload = update_data.get("correction_gestionnaire") or item.correction_gestionnaire
                    parsed_correction = {}
                    if isinstance(correction_payload, str) and correction_payload.strip():
                        try:
                            parsed_correction = json.loads(correction_payload)
                        except Exception:
                            parsed_correction = {}
                    elif isinstance(correction_payload, dict):
                        parsed_correction = correction_payload

                    raw_sub_category_name = str(parsed_correction.get("sous_categorie") or "").strip()
                    sous_categorie_obj = None
                    if raw_sub_category_name:
                        sub_category_name = normalize_sous_categorie_name(raw_sub_category_name)
                        sous_categorie_obj, _ = SousCategorie.objects.get_or_create(
                            id_categorie=category_obj,
                            nom_sous_categorie=sub_category_name,
                            defaults={"description": sub_category_name},
                        )

                    resource = Ressource.objects.filter(
                        designation__iexact=designation,
                        id_categorie=category_obj,
                        id_sous_categorie=sous_categorie_obj,
                    ).first()
                    if resource is None:
                        resource = Ressource.objects.create(
                            designation=designation,
                            description=update_data.get("description") or item.description or "",
                            unite_mesure=update_data.get("unite") or item.unite or "unité",
                            id_categorie=category_obj,
                            id_sous_categorie=sous_categorie_obj,
                        )

                    update_data["id_ressource_liee"] = resource.id_ressource

                update_data["statut"] = "approuve"

                serializer = self.get_serializer(item, data=update_data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                updated_items.append(serializer.data)

            if len(import_ids) > 1:
                return Response(
                    {"detail": "Les lignes doivent appartenir au même import."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if import_ids:
                import_obj = ImportExcelBC.objects.select_for_update().get(pk=next(iter(import_ids)))
                import_update = {}
                if "titre" in request.data:
                    import_update["titre_fichier"] = request.data.get("titre") or ""
                if "reference" in request.data:
                    import_update["reference_document"] = request.data.get("reference") or ""
                if "fournisseur" in request.data:
                    import_update["fournisseur_denomination"] = request.data.get("fournisseur") or ""
                if "telephone" in request.data:
                    import_update["fournisseur_telephone"] = request.data.get("telephone") or ""
                if "email" in request.data:
                    import_update["fournisseur_email"] = request.data.get("email") or ""
                if "adresse" in request.data:
                    import_update["fournisseur_adresse"] = request.data.get("adresse") or ""
                if "delai_livraison" in request.data:
                    import_update["delai_execution"] = str(request.data.get("delai_livraison") or "")

                if import_update:
                    for field, value in import_update.items():
                        setattr(import_obj, field, value)
                    import_obj.save(update_fields=list(import_update.keys()))

                all_approved = not StagingItem.objects.filter(
                    id_import=import_obj
                ).exclude(statut="approuve").exists()
                if all_approved:
                    if import_obj.statut_import != "valide":
                        import_obj.statut_import = "valide"
                        import_obj.save(update_fields=["statut_import"])

                    marche = import_obj.id_marche
                    if marche and marche.statut != "receptionne_et_stocke":
                        marche.statut = "receptionne_et_stocke"
                        marche.save(update_fields=["statut"])

        return Response(
            {"approved_items": len(updated_items), "items": updated_items},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        item = self.get_object()

        if item.statut == "approuve":
            return Response(
                {"detail": "Cet article est déjà approuvé."},
                status=status.HTTP_200_OK,
            )

        if not item.id_ressource_liee:
            return Response(
                {
                    "error": (
                        "Ressource non liée — sélectionnez une ressource avant d'approuver."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate via serializer (enforces designation_normalisee rule)
        serializer = self.get_serializer(
            item, data={"statut": "approuve"}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # The procurement signal (on_staging_approuve) fires via post_save.
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ── reject ───────────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        item = self.get_object()

        if item.statut in ("approuve", "rejete"):
            return Response(
                {"detail": f"Impossible de rejeter un article '{item.statut}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif_rejet = (request.data.get("motif_rejet") or "").strip()
        commentaire_rejet = (request.data.get("commentaire_rejet") or "").strip()

        if not motif_rejet:
            return Response(
                {"detail": "Le motif de rejet est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        VALID_MOTIFS = ["non_conforme", "document_invalide", "autre"]
        if motif_rejet not in VALID_MOTIFS:
            return Response(
                {"detail": "Motif de rejet invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if motif_rejet == "autre" and not commentaire_rejet:
            return Response(
                {"detail": "Le commentaire est obligatoire pour le motif 'autre'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item.statut = "rejete"
        item.motif_rejet = motif_rejet
        item.commentaire_rejet = commentaire_rejet
        item.save(update_fields=["statut", "motif_rejet", "commentaire_rejet"])

        import_obj = item.id_import
        import_status = motif_rejet if motif_rejet in {"non_conforme", "autre"} else "autre"
        if import_obj.statut_import != import_status:
            import_obj.statut_import = import_status
            import_obj.save(update_fields=["statut_import"])

        serializer = self.get_serializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

# ---------------------------------------------------------------------------
# 5. LotArticleViewSet
# ---------------------------------------------------------------------------


class LotArticleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LotArticleSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [(IsGestionnaireOrAdmin | IsServiceFinanciere)()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = LotArticle.objects.select_related("id_marche", "id_ressource").all()
        if id_marche := self.request.query_params.get("id_marche"):
            qs = qs.filter(id_marche=id_marche)
        if id_ressource := self.request.query_params.get("id_ressource"):
            qs = qs.filter(id_ressource=id_ressource)
        return qs
