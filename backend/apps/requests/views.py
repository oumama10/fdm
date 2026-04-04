from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import (
    IsChefService,
    IsChefServiceOwner,
    IsGestionnaireOrAdmin,
)

from .models import Demande
from .serializers import DemandeCreateSerializer, DemandeSerializer


class DemandeViewSet(viewsets.ModelViewSet):
    """
    Permissions per action
    ----------------------
    create                : IsChefService
    list                  : IsGestionnaireOrAdmin → all
                            IsChefService        → own only
    retrieve              : IsGestionnaireOrAdmin → any
                            IsChefService        → own only (object-level)
    update/partial_update : IsGestionnaireOrAdmin
    destroy               : IsGestionnaireOrAdmin

    Custom actions
    --------------
    POST /demandes/{id}/valider/  — IsGestionnaireOrAdmin
    POST /demandes/{id}/refuser/  — IsGestionnaireOrAdmin
    """

    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return DemandeCreateSerializer
        return DemandeSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsChefService()]
        if self.action in ("update", "partial_update", "destroy", "valider", "refuser"):
            return [IsGestionnaireOrAdmin()]
        # list + retrieve: both roles allowed — queryset/object gate narrows access
        return [(IsGestionnaireOrAdmin | IsChefService)()]

    def get_queryset(self):
        qs = Demande.objects.select_related(
            "id_chef_demandeur",
            "id_service",
            "id_valide_par",
        ).prefetch_related(
            "lignes__id_ressource__id_categorie",
        )

        user = self.request.user
        # Chefs de service see only their own demandes
        if (
            user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "chef_service"
        ):
            qs = qs.filter(id_chef_demandeur=user)
        return qs

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        # Object-level guard for chef_service on retrieve
        if (
            self.action == "retrieve"
            and user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "chef_service"
        ):
            self.check_object_permissions(self.request, obj)
            # IsChefServiceOwner is checked explicitly here
            perm = IsChefServiceOwner()
            if not perm.has_object_permission(self.request, self, obj):
                self.permission_denied(self.request)
        return obj

    def perform_create(self, serializer):
        serializer.save(id_chef_demandeur=self.request.user)

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _notify_chef(demande: Demande, titre: str, message: str) -> None:
        """
        Send a web Notification to the chef who submitted the demande.
        Silently swallows all exceptions — notifications must not block the
        main action.
        """
        try:
            from apps.alerts.models import Notification  # noqa: PLC0415
            from django.contrib.contenttypes.models import ContentType  # noqa: PLC0415

            Notification.objects.create(
                id_destinataire=demande.id_chef_demandeur,
                type_notification="validation_requise",
                titre=titre,
                message=message,
                canal="web",
                content_type=ContentType.objects.get_for_model(Demande),
                object_id=demande.pk,
            )
        except Exception:
            pass

    # ── custom actions ────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="valider")
    def valider(self, request, pk=None):
        demande = self.get_object()

        if demande.statut not in ("en_cours",):
            return Response(
                {"detail": f"Impossible de valider une demande au statut '{demande.statut}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        demande.statut = "validee"
        demande.id_valide_par = request.user
        demande.date_validation = timezone.now()
        demande.save(update_fields=["statut", "id_valide_par_id", "date_validation"])

        self._notify_chef(
            demande,
            titre="Demande validée",
            message=f"Votre demande #{demande.id_demande} a été validée.",
        )

        return Response(DemandeSerializer(demande).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="refuser")
    def refuser(self, request, pk=None):
        demande = self.get_object()

        if demande.statut not in ("en_cours",):
            return Response(
                {"detail": f"Impossible de refuser une demande au statut '{demande.statut}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        commentaire = request.data.get("commentaire_validation", "")

        demande.statut = "refusee"
        demande.commentaire_validation = commentaire
        demande.save(update_fields=["statut", "commentaire_validation"])

        self._notify_chef(
            demande,
            titre="Demande refusée",
            message=(
                f"Votre demande #{demande.id_demande} a été refusée. "
                + (f"Motif : {commentaire}" if commentaire else "")
            ),
        )

        return Response(DemandeSerializer(demande).data, status=status.HTTP_200_OK)
