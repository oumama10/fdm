from django.utils.timezone import now
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import (
    IsChefService,
    IsGestionnaireOrAdmin,
)
from apps.resources.models import InstanceRessource, MouvementStock

from .models import RetourMateriel
from .serializers import RetourMaterielSerializer

# Maps motif → (instance.etat, instance.statut)
_MOTIF_ETAT = {
    "panne":      ("hors_service", "en_maintenance"),
    "inutilise":  ("retourne",     "en_stock"),
    "endommage":  ("endommage",    "en_maintenance"),
    "autre":      ("retourne",     "en_stock"),
}


class RetourMaterielViewSet(viewsets.ModelViewSet):
    """
    Permissions per action
    ----------------------
    create        : IsChefService | IsGestionnaireOrAdmin
    list/retrieve : IsGestionnaireOrAdmin → all; IsChefService → own
    partial_update: IsGestionnaireOrAdmin
    destroy       : IsGestionnaireOrAdmin
    receptionner  : IsGestionnaireOrAdmin
    """

    serializer_class = RetourMaterielSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action == "create":
            return [(IsChefService | IsGestionnaireOrAdmin)()]
        if self.action in ("partial_update", "destroy", "receptionner"):
            return [IsGestionnaireOrAdmin()]
        return [(IsGestionnaireOrAdmin | IsChefService)()]

    def get_queryset(self):
        qs = RetourMateriel.objects.select_related(
            "id_ressource",
            "id_instance_ressource",
            "id_retourne_par__id_service",
            "id_traite_par",
        )
        user = self.request.user
        if (
            user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "chef_service"
        ):
            qs = qs.filter(id_retourne_par=user)
        return qs

    def perform_create(self, serializer):
        from apps.alerts.models import NotificationType  # noqa: PLC0415
        from apps.alerts.notification_service import create_notification  # noqa: PLC0415
        from apps.users.models import Utilisateur  # noqa: PLC0415

        user = self.request.user
        if user.id_role and user.id_role.nom_role == "chef_service":
            retour = serializer.save(id_retourne_par=user, decision="")
        else:
            kwargs = {}
            decision = serializer.validated_data.get("decision", "")
            if decision:
                kwargs["id_traite_par"] = user
            if not serializer.validated_data.get("id_retourne_par"):
                kwargs["id_retourne_par"] = user
            retour = serializer.save(**kwargs)

        try:
            designation = retour.id_ressource.designation if retour.id_ressource else "matériel"
            retourne_par = retour.id_retourne_par
            nom = retourne_par.nom_complet if retourne_par else "Un utilisateur"
            gestionnaires = Utilisateur.objects.filter(
                id_role__nom_role="gestionnaire_magasin", actif=True
            ).only("id_utilisateur")
            for gestionnaire in gestionnaires:
                create_notification(
                    gestionnaire,
                    NotificationType.RETOUR_ENREGISTRE,
                    f"{nom} a enregistré un retour de '{designation}'.",
                    content_object=retour,
                    lien=f"/gestionnaire/retours/{retour.pk}/",
                )
        except Exception:
            pass

    def perform_update(self, serializer):
        decision = serializer.validated_data.get("decision", "")
        if decision:
            serializer.save(id_traite_par=self.request.user)
        else:
            serializer.save()

    @action(detail=True, methods=["post"], url_path="receptionner")
    def receptionner(self, request, pk=None):
        retour = self.get_object()

        if retour.statut != "en_attente":
            return Response(
                {"detail": "Ce retour est déjà traité."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if retour.motif_retour not in _MOTIF_ETAT:
            return Response(
                {"detail": f"Motif '{retour.motif_retour}' non géré par cette action."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nouvel_etat, nouveau_statut = _MOTIF_ETAT[retour.motif_retour]

        if retour.id_instance_ressource:
            InstanceRessource.objects.filter(
                pk=retour.id_instance_ressource_id
            ).update(etat=nouvel_etat, statut=nouveau_statut)

            MouvementStock.objects.create(
                type_mouvement="retour",
                quantite=1,
                id_ressource=retour.id_ressource,
                id_instance_ressource=retour.id_instance_ressource,
                id_utilisateur=request.user,
            )

        retour.statut = "receptionne"
        retour.date_reception = now()
        retour.id_traite_par = request.user
        retour.save(update_fields=["statut", "date_reception", "id_traite_par_id"])

        return Response(
            {"detail": "Retour réceptionné.", "nouvel_etat": nouvel_etat},
            status=status.HTTP_200_OK,
        )
