from datetime import datetime

from django.db.models import Q
from django.utils.timezone import make_aware
from rest_framework import permissions, viewsets

from apps.alerts.models import JournalAudit
from apps.core.permissions import IsAdmin

from .models import Batiment, Beneficiaire, Etablissement, Fournisseur, Role, Service, Utilisateur
from .serializers import (
    BatimentSerializer,
    BeneficiaireSerializer,
    EtablissementSerializer,
    FournisseurSerializer,
    JournalAuditSerializer,
    RoleSerializer,
    ServiceSerializer,
    UtilisateurAdminSerializer,
)


class UtilisateurViewSet(viewsets.ModelViewSet):
    serializer_class = UtilisateurAdminSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        qs = (
            Utilisateur.objects.select_related("id_role", "id_service")
            .prefetch_related("fournisseur_profile")
            .order_by("-date_creation")
        )

        role_id = self.request.query_params.get("id_role")
        service_id = self.request.query_params.get("id_service")
        actif = self.request.query_params.get("actif")
        email = self.request.query_params.get("email")

        if role_id:
            qs = qs.filter(id_role_id=role_id)
        if service_id:
            qs = qs.filter(id_service_id=service_id)
        if actif is not None and actif != "":
            actif_bool = str(actif).lower() in {"1", "true", "yes", "oui"}
            qs = qs.filter(actif=actif_bool)
        if email:
            qs = qs.filter(email__iexact=email)

        return qs


class EtablissementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EtablissementSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Etablissement.objects.all().order_by("nom")


class BatimentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BatimentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Batiment.objects.select_related("id_etablissement").order_by("nom")
        id_etablissement = self.request.query_params.get("id_etablissement")
        if id_etablissement:
            qs = qs.filter(id_etablissement_id=id_etablissement)
        return qs


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    queryset = Service.objects.all().order_by("nom_service")

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = Service.objects.select_related("id_batiment__id_etablissement").order_by("nom_service")
        id_batiment = self.request.query_params.get("id_batiment")
        id_etablissement = self.request.query_params.get("id_etablissement")
        if id_batiment:
            qs = qs.filter(id_batiment_id=id_batiment)
        elif id_etablissement:
            qs = qs.filter(id_batiment__id_etablissement_id=id_etablissement)
        return qs


class BeneficiaireViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BeneficiaireSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Beneficiaire.objects.select_related("id_service").order_by("role_type", "nom")
        id_service = self.request.query_params.get("id_service")
        if id_service:
            qs = qs.filter(id_service_id=id_service)
        return qs


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Role.objects.all().order_by("nom_role")


class FournisseurViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FournisseurSerializer
    permission_classes = [IsAdmin]
    queryset = Fournisseur.objects.all().order_by("nom_societe")


class JournalAuditViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = JournalAuditSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = JournalAudit.objects.select_related("id_utilisateur", "id_utilisateur__id_role", "id_utilisateur__id_service").order_by("-date_action")

        utilisateur_id = self.request.query_params.get("id_utilisateur")
        table_cible = self.request.query_params.get("table_cible")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        search = self.request.query_params.get("search")

        if utilisateur_id:
            qs = qs.filter(id_utilisateur_id=utilisateur_id)
        if table_cible:
            qs = qs.filter(table_cible__iexact=table_cible)
        if date_from:
            try:
                dt_from = make_aware(datetime.fromisoformat(date_from)) if "T" in date_from else make_aware(datetime.fromisoformat(f"{date_from}T00:00:00"))
                qs = qs.filter(date_action__gte=dt_from)
            except ValueError:
                pass
        if date_to:
            try:
                dt_to = make_aware(datetime.fromisoformat(date_to)) if "T" in date_to else make_aware(datetime.fromisoformat(f"{date_to}T23:59:59"))
                qs = qs.filter(date_action__lte=dt_to)
            except ValueError:
                pass
        if search:
            qs = qs.filter(
                Q(type_action__icontains=search)
                | Q(table_cible__icontains=search)
                | Q(id_utilisateur__nom_complet__icontains=search)
            )

        return qs
