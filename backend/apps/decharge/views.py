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


def _update_demande_delivery_on_signature_validated(decharge: Decharge) -> None:
    """
    Called once when a SignatureDecharge reaches statut='signe'.
    Sets quantite_livree = quantite_accordee for every LigneDemande,
    then updates the demande statut accordingly.
    """
    if not decharge.id_demande:
        return

    try:
        from django.db.models import F  # noqa: PLC0415

        demande = decharge.id_demande

        # One bulk query: quantite_livree mirrors quantite_accordee exactly.
        # Using instance counts from LigneDecharge would be wrong for bien_inventaire
        # because each instance creates a separate row (quantite=1 each).
        demande.lignes.update(quantite_livree=F("quantite_accordee"))

        # Recalculate demande status
        all_lignes = list(demande.lignes.all())
        if any(l.quantite_livree > 0 for l in all_lignes):
            new_statut = "traite"
        else:
            return  # nothing delivered — leave statut unchanged

        demande.statut = new_statut
        demande.save(update_fields=["statut"])

    except Exception:
        pass



def _notify_chef(decharge: Decharge, notification_type, message: str) -> None:
    try:
        from apps.alerts.notification_service import create_notification  # noqa: PLC0415

        chef = decharge.id_demande.id_chef_demandeur if decharge.id_demande else None
        if chef is None:
            return
        create_notification(
            chef,
            notification_type,
            message,
            content_object=decharge,
            lien=f"/chef/decharges/{decharge.pk}/",
        )
    except Exception:
        pass


def _notify_gestionnaires(decharge: Decharge, titre: str, message: str) -> None:
    try:
        from apps.alerts.models import NotificationType      # noqa: PLC0415
        from apps.alerts.notification_service import create_notification  # noqa: PLC0415
        from apps.users.models import Utilisateur            # noqa: PLC0415

        gestionnaires = list(
            Utilisateur.objects.filter(
                id_role__nom_role="gestionnaire_magasin", actif=True
            ).only("id_utilisateur")
        )
        for gestionnaire in gestionnaires:
            create_notification(
                gestionnaire,
                NotificationType.DECHARGE_SIGNEE,
                message,
                content_object=decharge,
                lien=f"/gestionnaire/decharges/{decharge.pk}/",
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
            "id_demande__id_service",
            "id_genere_par",
            "id_livre_a",
            "signature",
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
        # For retrieve/download_pdf/pdf/types: chefs may only access their own décharges
        if self.action in ("retrieve", "download_pdf", "pdf", "types"):
            if user.id_role and user.id_role.nom_role == "chef_service":
                if not _is_chef_owner(user, obj):
                    raise PermissionDenied()
        return obj

    def perform_create(self, serializer):
        serializer.save(id_genere_par=self.request.user)

    # ── download_pdf ─────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="download_pdf")
    def download_pdf(self, request, pk=None):
        from django.http import HttpResponse  # noqa: PLC0415

        decharge = self.get_object()

        pdf_path = decharge.fichier_pdf.path if decharge.fichier_pdf else None

        if pdf_path and os.path.isfile(pdf_path):
            return FileResponse(
                open(pdf_path, "rb"),  # noqa: WPS515 — FileResponse closes the handle
                as_attachment=True,
                filename=os.path.basename(pdf_path),
                content_type="application/pdf",
            )

        # PDF not on disk — generate synchronously and stream directly
        try:
            from apps.decharge.tasks.pdf_task import _build_pdf_bytes  # noqa: PLC0415
            pdf_bytes = _build_pdf_bytes(decharge)
        except Exception as exc:
            return Response(
                {"detail": f"Erreur lors de la génération du PDF : {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        fname = f"decharge-{decharge.pk}.pdf"
        response["Content-Disposition"] = f'attachment; filename="{fname}"'
        return response

    # ── pdf (always-fresh generation, optional type filter) ──────────────────

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        from django.http import HttpResponse                      # noqa: PLC0415
        from apps.decharge.tasks.pdf_task import _build_pdf_bytes  # noqa: PLC0415

        decharge = self.get_object()
        type_filter = request.query_params.get("type")  # 'consommable' | 'bien_inventaire' | None

        lignes = None
        if type_filter in ("consommable", "bien_inventaire"):
            lignes = list(
                decharge.lignes.select_related(
                    "id_ressource__id_sous_categorie__id_categorie",
                    "id_ressource__id_type",
                    "id_instance_ressource",
                ).filter(type_ligne=type_filter)
            )

        try:
            pdf_bytes = _build_pdf_bytes(decharge, lignes=lignes)
        except Exception as exc:
            return Response(
                {"detail": f"Erreur lors de la génération du PDF : {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        suffix = f"-{type_filter}" if type_filter else ""
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="decharge-{decharge.numero_decharge}{suffix}.pdf"'
        )
        return response

    # ── types (ligne type composition) ───────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="types")
    def types(self, request, pk=None):
        decharge = self.get_object()
        type_set = set(decharge.lignes.values_list("type_ligne", flat=True))
        has_consommable     = "consommable"     in type_set
        has_bien_inventaire = "bien_inventaire" in type_set
        return Response({
            "has_consommable":     has_consommable,
            "has_bien_inventaire": has_bien_inventaire,
            "is_mixed":            has_consommable and has_bien_inventaire,
        })

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

    detail    GET   authenticated (owner or gestionnaire)
    confirmer POST  IsGestionnaireOrAdmin — seul clic non_signe → signe
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

    # ── detail ────────────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="detail")
    def get_detail(self, request, decharge_pk=None):
        signature = self._get_signature(decharge_pk)
        return Response(
            SignatureDechargeSerializer(signature).data,
            status=status.HTTP_200_OK,
        )

    # ── confirmer (non_signe → signe, déclenche le signal stock) ─────────────

    @action(detail=False, methods=["post"], url_path="confirmer")
    def confirmer(self, request, decharge_pk=None):
        """Gestionnaire confirme la signature physique — non_signe → signe."""
        if not (
            request.user.is_authenticated
            and request.user.id_role
            and request.user.id_role.nom_role in {"gestionnaire_magasin", "admin"}
        ):
            raise PermissionDenied()

        signature = self._get_signature(decharge_pk)

        if signature.statut != "non_signe":
            return Response(
                {
                    "detail": (
                        f"Seule une signature 'non_signe' peut être confirmée "
                        f"(statut actuel : '{signature.statut}')."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        signature.statut = "signe"
        signature.id_valide_par = request.user
        signature.date_signature = timezone.now()
        signature.date_validation_systeme = timezone.now()
        # post_save signal on_signature_valide fires here → quantite_livree + demande statut + notification
        signature.save(
            update_fields=[
                "statut",
                "id_valide_par_id",
                "date_signature",
                "date_validation_systeme",
            ]
        )

        # Release the stock reservation: quantite_reservee was incremented at valider() time.
        # Now that the items are physically delivered, we drop the reservation.
        # (quantite_disponible was already decremented at valider() — no change here.)
        try:
            from django.db.models import F as _F                   # noqa: PLC0415
            from apps.resources.models import Stock as _Stock      # noqa: PLC0415
            from .models import LigneDecharge as _LD               # noqa: PLC0415

            lignes = _LD.objects.filter(
                id_decharge=signature.id_decharge
            ).select_related("id_ressource__id_type")

            for ligne in lignes:
                if ligne.type_ligne == "consommable" and ligne.quantite > 0:
                    _Stock.objects.filter(id_ressource=ligne.id_ressource).update(
                        quantite_reservee=_F("quantite_reservee") - ligne.quantite
                    )
        except Exception:
            pass  # non-blocking — reservation cleanup is best-effort at sign time

        return Response(
            SignatureDechargeSerializer(signature).data,
            status=status.HTTP_200_OK,
        )
