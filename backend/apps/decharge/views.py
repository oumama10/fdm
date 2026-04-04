import os

from django.http import FileResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from apps.core.permissions import (
    IsChefService,
    IsGestionnaireOrAdmin,
)

from .models import Decharge, SignatureDecharge
from .serializers import (
    DechargeCreateSerializer,
    DechargeSerializer,
    SignatureDechargeSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_decharge_or_404(decharge_id: int) -> Decharge:
    try:
        return Decharge.objects.select_related(
            "id_demande__id_chef_demandeur",
            "id_genere_par",
            "id_livre_a",
        ).prefetch_related(
            "lignes__id_ressource",
            "lignes__id_instance_ressource",
        ).get(pk=decharge_id)
    except Decharge.DoesNotExist:
        raise NotFound(detail=f"Décharge {decharge_id} introuvable.")


def _is_chef_owner(user, decharge: Decharge) -> bool:
    """True when *user* is the chef who submitted the linked demande."""
    return (
        user.is_authenticated
        and decharge.id_demande
        and decharge.id_demande.id_chef_demandeur_id == user.pk
    )


def _notify_chef(decharge: Decharge, titre: str, message: str) -> None:
    try:
        from apps.alerts.models import Notification          # noqa: PLC0415
        from django.contrib.contenttypes.models import ContentType  # noqa: PLC0415

        chef = decharge.id_demande.id_chef_demandeur if decharge.id_demande else None
        if chef is None:
            return
        Notification.objects.create(
            id_destinataire=chef,
            type_notification="decharge_prete",
            titre=titre,
            message=message,
            canal="web",
            content_type=ContentType.objects.get_for_model(Decharge),
            object_id=decharge.pk,
        )
    except Exception:
        pass


def _notify_gestionnaires(decharge: Decharge, titre: str, message: str) -> None:
    try:
        from apps.alerts.models import Notification          # noqa: PLC0415
        from apps.users.models import Utilisateur            # noqa: PLC0415
        from django.contrib.contenttypes.models import ContentType  # noqa: PLC0415

        gestionnaires = list(
            Utilisateur.objects.filter(
                id_role__nom_role="gestionnaire_magasin", actif=True
            ).only("id_utilisateur")
        )
        ct = ContentType.objects.get_for_model(Decharge)
        Notification.objects.bulk_create(
            [
                Notification(
                    id_destinataire=g,
                    type_notification="scan_recu",
                    titre=titre,
                    message=message,
                    canal="web",
                    content_type=ct,
                    object_id=decharge.pk,
                )
                for g in gestionnaires
            ]
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 1. DechargeViewSet
# ---------------------------------------------------------------------------


class DechargeViewSet(viewsets.ModelViewSet):
    """
    Permissions
    -----------
    create                    : IsGestionnaireOrAdmin
    list                      : IsGestionnaireOrAdmin → all
                                IsChefService        → own (demande owner)
    retrieve                  : IsGestionnaireOrAdmin | chef owner
    update / partial_update   : IsGestionnaireOrAdmin
    destroy                   : IsGestionnaireOrAdmin
    download_pdf              : IsGestionnaireOrAdmin | chef owner
    regenerate_pdf            : IsGestionnaireOrAdmin
    """

    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return DechargeCreateSerializer
        return DechargeSerializer

    def get_permissions(self):
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "regenerate_pdf",
        ):
            return [IsGestionnaireOrAdmin()]
        # list, retrieve, download_pdf: both roles; queryset/object gate narrows
        return [(IsGestionnaireOrAdmin | IsChefService)()]

    def get_queryset(self):
        qs = Decharge.objects.select_related(
            "id_demande__id_chef_demandeur",
            "id_genere_par",
            "id_livre_a",
        ).prefetch_related(
            "lignes__id_ressource",
            "lignes__id_instance_ressource",
        )

        user = self.request.user
        if (
            user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "chef_service"
        ):
            qs = qs.filter(id_demande__id_chef_demandeur=user)

        return qs

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        # For retrieve/download_pdf: chefs may only access their own décharges
        if self.action in ("retrieve", "download_pdf"):
            if user.id_role and user.id_role.nom_role == "chef_service":
                if not _is_chef_owner(user, obj):
                    raise PermissionDenied()
        return obj

    def perform_create(self, serializer):
        serializer.save(id_genere_par=self.request.user)

    # ── download_pdf ─────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="download_pdf")
    def download_pdf(self, request, pk=None):
        decharge = self.get_object()

        if not decharge.fichier_pdf:
            return Response(
                {"detail": "Le PDF n'a pas encore été généré."},
                status=status.HTTP_404_NOT_FOUND,
            )

        pdf_path = decharge.fichier_pdf.path
        if not os.path.isfile(pdf_path):
            return Response(
                {"detail": "Fichier PDF introuvable sur le serveur."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            open(pdf_path, "rb"),  # noqa: WPS515 — FileResponse closes the handle
            as_attachment=True,
            filename=os.path.basename(pdf_path),
            content_type="application/pdf",
        )

    # ── regenerate_pdf ────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="regenerate_pdf")
    def regenerate_pdf(self, request, pk=None):
        decharge = self.get_object()
        from apps.decharge.tasks import generate_decharge_pdf  # noqa: PLC0415

        generate_decharge_pdf.delay(decharge.pk)
        return Response(
            {"detail": "Régénération du PDF lancée."},
            status=status.HTTP_202_ACCEPTED,
        )


# ---------------------------------------------------------------------------
# 2. SignatureDechargeViewSet
# ---------------------------------------------------------------------------


class SignatureDechargeViewSet(viewsets.GenericViewSet):
    """
    Nested under /decharges/{decharge_pk}/signature/

    upload_scan  POST  IsChefService (must own the décharge)
    valider      POST  IsGestionnaireOrAdmin
    rejeter      POST  IsGestionnaireOrAdmin
    """

    serializer_class = SignatureDechargeSerializer

    def _get_signature(self, decharge_pk: int) -> SignatureDecharge:
        """Return the SignatureDecharge for *decharge_pk*, or 404."""
        try:
            return SignatureDecharge.objects.select_related(
                "id_decharge__id_demande__id_chef_demandeur",
                "id_chef_service",
                "id_valide_par",
            ).get(id_decharge_id=decharge_pk)
        except SignatureDecharge.DoesNotExist:
            raise NotFound(
                detail=f"Signature introuvable pour la décharge {decharge_pk}."
            )

    # ── upload_scan ───────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="detail")
    def detail(self, request, decharge_pk=None):
        signature = self._get_signature(decharge_pk)
        return Response(
            SignatureDechargeSerializer(signature).data,
            status=status.HTTP_200_OK,
        )

    # ── upload_scan ───────────────────────────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="upload_scan")
    def upload_scan(self, request, decharge_pk=None):
        # Permission: IsChefService only
        if not (
            request.user.is_authenticated
            and request.user.id_role
            and request.user.id_role.nom_role == "chef_service"
        ):
            raise PermissionDenied()

        signature = self._get_signature(decharge_pk)
        decharge = signature.id_decharge

        if not _is_chef_owner(request.user, decharge):
            raise PermissionDenied(
                detail="Vous n'êtes pas le chef demandeur de cette décharge."
            )

        if signature.statut not in ("en_attente",):
            return Response(
                {
                    "detail": (
                        f"Impossible d'uploader un scan pour une signature "
                        f"au statut '{signature.statut}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        scan_file = request.FILES.get("fichier_scan_signe")
        if not scan_file:
            return Response(
                {"detail": "Le fichier 'fichier_scan_signe' est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        observation = request.data.get("observation_chef", "")

        signature.fichier_scan_signe = scan_file
        signature.observation_chef = observation
        signature.statut = "signe"
        signature.date_signature = timezone.now()
        signature.save(
            update_fields=[
                "fichier_scan_signe",
                "observation_chef",
                "statut",
                "date_signature",
            ]
        )

        _notify_gestionnaires(
            decharge,
            titre="Scan décharge reçu",
            message=(
                f"Le chef a soumis le scan signé de la décharge "
                f"{decharge.numero_decharge}."
            ),
        )

        return Response(
            SignatureDechargeSerializer(signature).data,
            status=status.HTTP_200_OK,
        )

    # ── valider ───────────────────────────────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="valider")
    def valider(self, request, decharge_pk=None):
        if not (
            request.user.is_authenticated
            and request.user.id_role
            and request.user.id_role.nom_role in {"gestionnaire_magasin", "admin"}
        ):
            raise PermissionDenied()

        signature = self._get_signature(decharge_pk)

        if signature.statut != "signe":
            return Response(
                {
                    "detail": (
                        f"Seule une signature au statut 'signe' peut être validée "
                        f"(statut actuel : '{signature.statut}')."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        signature.statut = "valide"
        signature.id_valide_par = request.user
        signature.date_validation_systeme = timezone.now()
        # post_save signal (on_signature_valide) fires here and handles stock
        # updates, MouvementStock creation and demande status change.
        signature.save(
            update_fields=["statut", "id_valide_par_id", "date_validation_systeme"]
        )

        return Response(
            SignatureDechargeSerializer(signature).data,
            status=status.HTTP_200_OK,
        )

    # ── rejeter ───────────────────────────────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="rejeter")
    def rejeter(self, request, decharge_pk=None):
        if not (
            request.user.is_authenticated
            and request.user.id_role
            and request.user.id_role.nom_role in {"gestionnaire_magasin", "admin"}
        ):
            raise PermissionDenied()

        signature = self._get_signature(decharge_pk)

        if signature.statut not in ("signe", "en_attente"):
            return Response(
                {
                    "detail": (
                        f"Impossible de rejeter une signature au statut "
                        f"'{signature.statut}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Clear the uploaded scan so the chef can re-upload a corrected one
        if signature.fichier_scan_signe:
            try:
                signature.fichier_scan_signe.delete(save=False)
            except Exception:
                pass

        signature.statut = "rejete"
        signature.fichier_scan_signe = None
        signature.date_signature = None
        signature.save(
            update_fields=["statut", "fichier_scan_signe", "date_signature"]
        )

        _notify_chef(
            signature.id_decharge,
            titre="Signature décharge rejetée",
            message=(
                f"Votre scan pour la décharge "
                f"{signature.id_decharge.numero_decharge} a été rejeté. "
                "Veuillez soumettre un nouveau scan."
            ),
        )

        return Response(
            SignatureDechargeSerializer(signature).data,
            status=status.HTTP_200_OK,
        )
