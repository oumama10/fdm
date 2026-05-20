import logging
import os
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.db.models import Q
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
                qs = qs.filter(id_fournisseur=fournisseur_profile)
            else:
                qs = qs.none()

        if type_acquisition := self.request.query_params.get("type_acquisition"):
            if type_acquisition in ("marche", "bon_commande", "donation"):
                qs = qs.filter(type_acquisition=type_acquisition)

        # Only surface marchés that belong on the list pages:
        # - all receptionne_et_stocke and refuse
        # - en_attente_livraison only when created via the manual form (source=manuel)
        # - en_attente_livraison from imports when they are sent to the gestionnaire (en_revision)
        qs = qs.filter(
            Q(statut__in=["receptionne_et_stocke", "refuse"]) |
            Q(statut="en_attente_livraison", source="manuel") |
            Q(statut="en_attente_livraison", source="import", import_excel__statut_import="en_revision")
        )

        return qs

    def perform_create(self, serializer):
        serializer.save(id_cree_par=self.request.user)

    @action(detail=True, methods=["post"], url_path="confirmer-reception")
    def confirmer_reception(self, request, pk=None):
        marche = self.get_object()

        if marche.statut == "receptionne_et_stocke":
            return Response(
                {"detail": "Ce marché est déjà réceptionné et stocké."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if marche.statut != "en_attente_livraison":
            return Response(
                {"detail": "Seul un marché en attente de livraison peut être confirmé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .signals import (  # noqa: PLC0415
            _complete_reception_etapes,
            _find_or_create_ressource,
            _integrate_item_into_stock,
            _sync_marche_reference,
        )

        import_obj = getattr(marche, "import_excel", None)
        if import_obj:
            items = StagingItem.objects.filter(id_import=import_obj).select_related(
                "id_ressource_liee", "id_categorie_suggeree", "id_sous_categorie_suggeree"
            )
            
            unclassified = []
            for item in items:
                if not _find_or_create_ressource(item):
                    unclassified.append((item.designation_brute or item.designation_normalisee or "Inconnu")[:50])
            
            if unclassified:
                names = ", ".join(unclassified[:3])
                if len(unclassified) > 3:
                    names += "..."
                return Response(
                    {"detail": f"Veuillez classer tous les articles avant de confirmer. Non classés: {names}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            for item in items:
                ressource = _find_or_create_ressource(item)
                if ressource:
                    _integrate_item_into_stock(item, ressource, marche)
            StagingItem.objects.filter(id_import=import_obj).update(statut="approuve")
            ImportExcelBC.objects.filter(pk=import_obj.pk).update(statut_import="valide")
            _sync_marche_reference(marche, import_obj)

        marche.statut = "receptionne_et_stocke"
        marche.save(update_fields=["statut", "reference"])
        _complete_reception_etapes(marche)

        serializer = self.get_serializer(marche)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="refuser")
    def refuser(self, request, pk=None):
        marche = self.get_object()

        if marche.statut != "en_attente_livraison":
            return Response(
                {"detail": "Seul un marché en attente de livraison peut être refusé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motif = str(request.data.get("motif_rejet") or "").strip()
        marche.statut = "refuse"
        marche.motif_rejet = motif
        marche.save(update_fields=["statut", "motif_rejet"])

        # Also mark associated import as rejected
        import_obj = getattr(marche, "import_excel", None)
        if import_obj:
            ImportExcelBC.objects.filter(pk=import_obj.pk).update(statut_import="rejete")

        serializer = self.get_serializer(marche)
        return Response(serializer.data)


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
        if self.action == "envoyer_gestionnaire":
            return [(IsServiceFinanciere | IsGestionnaireOrAdmin)()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return ImportExcelBCStatusSerializer
        return ImportExcelBCSerializer

    _SCOPE_STATUTS = {
        "a_envoyer": ["brouillon", "en_attente"],
        "extraites":  ["en_revision", "valide", "rejete", "non_conforme", "autre"],
    }

    def get_queryset(self):
        qs = (
            ImportExcelBC.objects.select_related("id_marche", "id_importe_par")
            .prefetch_related("staging_items")
            .order_by("-date_import")
        )
        scope = self.request.query_params.get("scope")
        if scope and scope in self._SCOPE_STATUTS:
            qs = qs.filter(statut_import__in=self._SCOPE_STATUTS[scope])
        elif statut_import := self.request.query_params.get("statut_import"):
            qs = qs.filter(statut_import=statut_import)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(id_importe_par=self.request.user)
        _trigger_extract(instance.pk)

    @action(detail=True, methods=["post"], url_path="envoyer-gestionnaire")
    def envoyer_gestionnaire(self, request, pk=None):
        from apps.alerts.models import NotificationType  # noqa: PLC0415
        from apps.alerts.notification_service import create_notification  # noqa: PLC0415
        from apps.users.models import Utilisateur  # noqa: PLC0415

        import_obj = self.get_object()

        if import_obj.statut_import in ("rejete", "non_conforme", "autre"):
            return Response(
                {"detail": "Impossible d'envoyer un import rejeté."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if import_obj.statut_import == "en_revision":
            return Response(
                {"detail": "Cet import est déjà en révision gestionnaire."},
                status=status.HTTP_200_OK,
            )

        if import_obj.statut_import == "valide":
            return Response(
                {"detail": "Cet import est déjà validé."},
                status=status.HTTP_200_OK,
            )

        if import_obj.statut_import not in ("en_attente", "brouillon"):
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

        gestionnaires = Utilisateur.objects.filter(
            id_role__nom_role="gestionnaire_magasin",
            actif=True,
        ).only("id_utilisateur")

        for gestionnaire in gestionnaires:
            create_notification(
                gestionnaire,
                NotificationType.IMPORT_STAGING,
                (
                    f"L'import #{import_obj.id_import} contient {item_count} article(s) "
                    "en attente de validation."
                ),
                objet_id=import_obj.id_import,
                lien=f"/gestionnaire/donnees-extraites/{import_obj.id_import}/",
            )

        import_obj.statut_import = "en_revision"
        import_obj.save(update_fields=["statut_import"])

        return Response(
            {
                "detail": "Import envoyé au gestionnaire.",
                "notifications_sent": gestionnaires.count(),
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

        # Vérification 1 — taille maximale (10 Mo)
        if fichier.size > 10 * 1024 * 1024:
            return Response(
                {"error": "Fichier trop volumineux. Taille maximale : 10 Mo."},
                status=400,
            )

        # Vérification 2 — extension autorisée
        filename = (fichier.name or "").lower()
        if filename.endswith(".pdf"):
            file_type = "pdf"
        elif filename.endswith((".xlsx", ".xls")):
            file_type = "xlsx"
        else:
            return Response(
                {"error": "Format non supporté. Utilisez .pdf, .xlsx ou .xls uniquement."},
                status=400,
            )

        # Vérification 3 — magic bytes (anti-spoofing)
        header = fichier.read(8)
        fichier.seek(0)
        if file_type == "pdf" and not header.startswith(b"%PDF"):
            return Response(
                {"error": "Le contenu du fichier ne correspond pas à un PDF valide."},
                status=400,
            )
        if file_type == "xlsx" and not header.startswith(b"PK"):
            return Response(
                {"error": "Le contenu du fichier ne correspond pas à un Excel valide."},
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
            source="import",
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

        statut_livraison = data.get("statut_livraison") or "en_attente_livraison"
        if statut_livraison not in ("en_attente_livraison", "receptionne_et_stocke"):
            statut_livraison = "en_attente_livraison"

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
        date_attribution_raw = (data.get("date_attribution") or "").strip()
        marque = (data.get("marque") or "").strip()[:255]
        comite_conformite = (data.get("comite_conformite") or "").strip()
        type_donateur = (data.get("type_donateur") or "").strip()[:50]
        nom_donateur = (data.get("nom_donateur") or "").strip()[:255]
        organisme_donateur = (data.get("organisme_donateur") or "").strip()[:255]
        contact_donateur = (data.get("contact_donateur") or "").strip()[:255]

        # Parse date_attribution
        date_attribution = None
        if date_attribution_raw:
            from datetime import date as _date  # noqa: PLC0415
            try:
                date_attribution = _date.fromisoformat(date_attribution_raw)
            except (ValueError, TypeError):
                pass

        # Parse delai_execution to an integer for delai_reception_jours
        delai_reception_jours = None
        if delai_execution:
            try:
                delai_reception_jours = int(float(delai_execution))
            except (ValueError, TypeError):
                pass

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
        marche_kwargs = dict(
            reference=marche_reference,
            type_acquisition=type_acquisition,
            statut="en_attente_livraison",
            source="manuel",
            id_cree_par=request.user,
            id_fournisseur=fournisseur_obj,
            marque=marque,
            comite_conformite=comite_conformite,
            type_donateur=type_donateur if type_acquisition == "donation" else "",
            nom_donateur=nom_donateur if type_acquisition == "donation" else "",
            organisme_donateur=organisme_donateur if type_acquisition == "donation" else "",
            contact_donateur=contact_donateur if type_acquisition == "donation" else "",
        )
        if date_attribution:
            marche_kwargs["date_attribution"] = date_attribution
        if delai_reception_jours is not None:
            marche_kwargs["delai_reception_jours"] = delai_reception_jours
        marche = MarcheBC.objects.create(**marche_kwargs)

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
            statut_import="brouillon",
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

        from apps.resources.models import Categorie as CategorieModel  # noqa: PLC0415

        cat_id_by_type = {
            "consommable": CategorieModel.objects.filter(nom_categorie="Consommable").values_list("pk", flat=True).first(),
            "bien_inventaire": CategorieModel.objects.filter(nom_categorie="Bien Inventaire").values_list("pk", flat=True).first(),
        }

        def _to_decimal(value):
            if value in (None, ""):
                return None
            try:
                return Decimal(str(value).replace(" ", "").replace(",", ".")).quantize(Decimal("0.01"))
            except Exception:
                return None

        staging_items = []
        for ligne in lignes:
            if not isinstance(ligne, dict):
                continue

            designation = str(ligne.get("designation") or "").strip()
            if not designation:
                continue

            description = str(ligne.get("description") or "").strip()
            unite = str(ligne.get("unite") or "U").strip()[:20]

            try:
                quantite = max(1, int(float(str(ligne.get("quantite") or 1).replace(",", "."))))
            except Exception:
                quantite = 1

            type_detecte = str(ligne.get("type_produit") or "").strip()
            if type_detecte not in ("consommable", "bien_inventaire"):
                type_detecte = ""

            # DB Categorie ID derived from type (Consommable / Bien Inventaire)
            categorie_id = cat_id_by_type.get(type_detecte)

            # Sous-catégorie: prefer child (id_sous_categorie), fall back to top-level (id_categorie_metier)
            try:
                sous_categorie_id = int(ligne.get("id_sous_categorie") or 0) or None
            except (TypeError, ValueError):
                sous_categorie_id = None
            if not sous_categorie_id:
                try:
                    sous_categorie_id = int(ligne.get("id_categorie_metier") or 0) or None
                except (TypeError, ValueError):
                    sous_categorie_id = None

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
                    type_detecte=type_detecte,
                    id_categorie_suggeree_id=categorie_id,
                    id_sous_categorie_suggeree_id=sous_categorie_id,
                    statut="en_attente",
                )
            )

        if not staging_items:
            import_obj.delete()
            marche.delete()
            return Response({"detail": "Les lignes sont invalides."}, status=400)

        StagingItem.objects.bulk_create(staging_items, batch_size=200)

        if statut_livraison == "receptionne_et_stocke":
            from .signals import _find_or_create_ressource, _integrate_item_into_stock, _sync_marche_reference  # noqa: PLC0415

            for item in StagingItem.objects.filter(id_import=import_obj).select_related(
                "id_ressource_liee", "id_categorie_suggeree", "id_sous_categorie_suggeree"
            ):
                ressource = _find_or_create_ressource(item)
                if ressource:
                    _integrate_item_into_stock(item, ressource, marche)

            StagingItem.objects.filter(id_import=import_obj).update(statut="approuve")
            ImportExcelBC.objects.filter(pk=import_obj.pk).update(statut_import="valide")
            _sync_marche_reference(marche, import_obj)
            marche.statut = "receptionne_et_stocke"
            marche.save(update_fields=["statut", "reference"])
            MarcheEtape.objects.filter(
                id_marche=marche, nom_etape="receptionne_magasin"
            ).update(statut="complete", date_fin=timezone.now())

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


_MODIFIE_TRACKED = (
    "designation_normalisee",
    "type_detecte",
    "id_categorie_suggeree_id",
    "id_sous_categorie_suggeree_id",
    "quantite",
    "prix_unitaire_ht",
)


class StagingItemViewSet(_NoCreateViewSet):
    """
    list / retrieve / update  : IsGestionnaireOrAdmin
    approve / reject actions  : IsGestionnaireOrAdmin

    Creation is handled exclusively by the Celery OCR task.

    POST /staging/{id}/approve/  — sets statut='approuve' (triggers signal)
    POST /staging/{id}/reject/   — sets statut='rejete'
    """

    serializer_class = StagingItemSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
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

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.statut not in ("approuve", "rejete"):
            before = {f: getattr(instance, f) for f in _MODIFIE_TRACKED}
            serializer.save()
            if any(before[f] != getattr(instance, f) for f in _MODIFIE_TRACKED):
                instance.statut = "modifie"
                instance.save(update_fields=["statut"])
        else:
            serializer.save()

    # ── approve ──────────────────────────────────────────────────────────────

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

        VALID_MOTIFS = ("non_conforme", "document_invalide", "autre")
        motif = str(request.data.get("motif_rejet") or "autre").strip()
        if motif not in VALID_MOTIFS:
            motif = "autre"
        item.statut = "rejete"
        item.motif_rejet = motif
        item.commentaire_rejet = str(request.data.get("commentaire_rejet") or "").strip()
        item.save(update_fields=["statut", "motif_rejet", "commentaire_rejet"])
        serializer = self.get_serializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["patch"], url_path="bulk-validate")
    def bulk_validate(self, request):
        id_import = request.data.get("id_import") or request.query_params.get("id_import")
        item_ids = request.data.get("item_ids") or []
        target_statut = str(request.data.get("statut") or "approuve").strip().lower()

        if target_statut not in ("approuve", "rejete"):
            return Response(
                {"detail": "Le statut cible doit être 'approuve' ou 'rejete'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = self.get_queryset()
        if id_import:
            qs = qs.filter(id_import_id=id_import)
        if item_ids:
            qs = qs.filter(id_staging__in=item_ids)

        if not qs.exists():
            return Response({"detail": "Aucun article correspondant."}, status=status.HTTP_404_NOT_FOUND)

        motif_rejet = str(request.data.get("motif_rejet") or "").strip()[:255]
        commentaire_rejet = str(request.data.get("commentaire_rejet") or "").strip()

        updated_count = 0
        for item in qs:
            payload = {"statut": target_statut}
            if target_statut == "rejete":
                payload.update({
                    "motif_rejet": motif_rejet,
                    "commentaire_rejet": commentaire_rejet,
                })
            serializer = self.get_serializer(item, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            updated_count += 1

        import_id = id_import
        if not import_id:
            first = qs.first()
            import_id = first.id_import_id if first else None

        if import_id:
            remaining_pending = StagingItem.objects.filter(
                id_import_id=import_id,
                statut="en_attente",
            ).exists()
            if remaining_pending:
                ImportExcelBC.objects.filter(pk=import_id).update(statut_import="en_revision")
            elif target_statut == "approuve":
                ImportExcelBC.objects.filter(pk=import_id).update(statut_import="valide")
                import_obj = ImportExcelBC.objects.select_related("id_marche").get(pk=import_id)
                marche = import_obj.id_marche
                if marche and marche.statut != "receptionne_et_stocke":
                    from .signals import _sync_marche_reference  # noqa: PLC0415
                    _sync_marche_reference(marche, import_obj)
                    marche.statut = "receptionne_et_stocke"
                    marche.save(update_fields=["statut", "reference"])
            else:
                _VALID_IMPORT_REJECT_STATUTS = {"non_conforme", "autre"}
                reject_statut = motif_rejet if motif_rejet in _VALID_IMPORT_REJECT_STATUTS else "autre"
                ImportExcelBC.objects.filter(pk=import_id).update(statut_import=reject_statut)

        return Response({"updated": updated_count}, status=status.HTTP_200_OK)

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
        qs = LotArticle.objects.select_related("id_marche", "id_ressource", "id_ressource__id_sous_categorie").all()
        if id_marche := self.request.query_params.get("id_marche"):
            qs = qs.filter(id_marche=id_marche)
        if id_ressource := self.request.query_params.get("id_ressource"):
            qs = qs.filter(id_ressource=id_ressource)
        return qs
