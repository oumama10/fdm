from rest_framework import viewsets

from apps.core.permissions import (
    IsChefService,
    IsGestionnaireOrAdmin,
)

from .models import RetourMateriel
from .serializers import RetourMaterielSerializer


class RetourMaterielViewSet(viewsets.ModelViewSet):
    """
    Permissions per action
    ----------------------
    create        : IsChefService | IsGestionnaireOrAdmin
                    Chef → id_retourne_par forced to request.user, decision=''
                    Gestionnaire → may set decision immediately
    list          : IsGestionnaireOrAdmin → all
                    IsChefService        → own (id_retourne_par=user)
    retrieve      : same visibility as list
    update (PATCH): IsGestionnaireOrAdmin
                    Sets id_traite_par automatically when decision is provided
    destroy       : IsGestionnaireOrAdmin
    """

    serializer_class = RetourMaterielSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action == "create":
            return [(IsChefService | IsGestionnaireOrAdmin)()]
        if self.action in ("partial_update", "destroy"):
            return [IsGestionnaireOrAdmin()]
        # list + retrieve
        return [(IsGestionnaireOrAdmin | IsChefService)()]

    def get_queryset(self):
        qs = RetourMateriel.objects.select_related(
            "id_ressource",
            "id_instance_ressource",
            "id_retourne_par",
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
        user = self.request.user
        # Chefs always own the return; gestionnaires may specify id_retourne_par
        # via the request body, but if omitted it defaults to the submitter.
        if user.id_role and user.id_role.nom_role == "chef_service":
            serializer.save(id_retourne_par=user, decision="")
        else:
            # Gestionnaire: inject traite_par when decision is provided at creation
            kwargs = {}
            decision = serializer.validated_data.get("decision", "")
            if decision:
                kwargs["id_traite_par"] = user
            if not serializer.validated_data.get("id_retourne_par"):
                kwargs["id_retourne_par"] = user
            serializer.save(**kwargs)

    def perform_update(self, serializer):
        # Inject id_traite_par whenever a decision is being set
        decision = serializer.validated_data.get("decision", "")
        if decision:
            serializer.save(id_traite_par=self.request.user)
        else:
            serializer.save()
        # The returns signal (on_retour_decision) fires via post_save and
        # handles InstanceRessource.etat + MouvementStock updates automatically.
