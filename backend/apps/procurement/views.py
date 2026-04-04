import logging

from django.contrib.contenttypes.models import ContentType
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
    from .tasks import extract_excel_items  # noqa: PLC0415

    try:
        extract_excel_items.apply_async(args=[import_id], ignore_result=True)
    except Exception:
        logger.exception(
            "Could not enqueue extract_excel_items for import %s; falling back to sync execution",
            import_id,
        )
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
            "id_fournisseur", "id_cree_par"
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
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
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
            return [IsServiceFinanciere()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ImportExcelBCStatusSerializer
        return ImportExcelBCSerializer

    def perform_create(self, serializer):
        instance = serializer.save(id_importe_par=self.request.user)
        _trigger_extract(instance.pk)

    @action(detail=True, methods=["post"], url_path="envoyer-gestionnaire")
    def envoyer_gestionnaire(self, request, pk=None):
        from apps.alerts.models import Notification  # noqa: PLC0415
        from apps.users.models import Utilisateur  # noqa: PLC0415

        import_obj = self.get_object()

        if import_obj.statut_import == "rejete":
            return Response(
                {"detail": "Impossible d'envoyer un import rejeté."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if import_obj.statut_import == "valide":
            return Response(
                {"detail": "Cet import a déjà été envoyé au gestionnaire."},
                status=status.HTTP_200_OK,
            )

        if import_obj.statut_import != "brouillon":
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

        import_obj.statut_import = "valide"
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
            source_type=source_type_import,
            statut_import="en_revision",
            id_marche=marche,
            id_importe_par=request.user,
        )

        _trigger_extract(import_obj.id_import)

        return Response(
            {
                "id_import": import_obj.id_import,
                "id_marche": marche.id_marche,
                "statut_import": import_obj.statut_import,
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

        item.statut = "rejete"
        item.save(update_fields=["statut"])
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
