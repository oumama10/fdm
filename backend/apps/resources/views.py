from rest_framework import mixins, viewsets
from django.db.models import F
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsGestionnaireOrAdmin

from .models import (
    Categorie,
    InstanceRessource,
    MouvementStock,
    Ressource,
    SousCategorie,
    Stock,
)
from .serializers import (
    CategorieSerializer,
    InstanceRessourceSerializer,
    MouvementStockSerializer,
    RessourceSerializer,
    SousCategorieSerializer,
    StockSerializer,
)


class _ReadUpdateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Generic base: list + retrieve + update/partial_update — no create or destroy."""


# ---------------------------------------------------------------------------
# Categorie
# ---------------------------------------------------------------------------


class CategorieViewSet(viewsets.ModelViewSet):
    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]


# ---------------------------------------------------------------------------
# SousCategorie
# ---------------------------------------------------------------------------


class SousCategorieViewSet(viewsets.ModelViewSet):
    serializer_class = SousCategorieSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = SousCategorie.objects.select_related("id_categorie").all()
        if id_categorie := self.request.query_params.get("id_categorie"):
            qs = qs.filter(id_categorie=id_categorie)
        return qs


# ---------------------------------------------------------------------------
# Ressource
# ---------------------------------------------------------------------------


class RessourceViewSet(viewsets.ModelViewSet):
    serializer_class = RessourceSerializer
    filter_backends = [SearchFilter]
    search_fields = ["designation"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = Ressource.objects.select_related(
            "id_categorie", "id_sous_categorie"
        ).all()
        params = self.request.query_params

        if id_categorie := params.get("id_categorie"):
            qs = qs.filter(id_categorie=id_categorie)

        # ?type=consommable | bien_inventaire
        type_param = params.get("type")
        if type_param == "consommable":
            qs = qs.filter(id_categorie__nom_categorie="Consommable")
        elif type_param == "bien_inventaire":
            qs = qs.filter(id_categorie__nom_categorie="Bien Inventaire")

        return qs


# ---------------------------------------------------------------------------
# Stock  (read + update only — no create, no delete)
# ---------------------------------------------------------------------------


class StockViewSet(_ReadUpdateViewSet):
    serializer_class = StockSerializer
    permission_classes = [IsGestionnaireOrAdmin]

    def get_queryset(self):
        qs = Stock.objects.select_related("id_ressource").all()
        alerte = self.request.query_params.get("alerte")
        if alerte and alerte.lower() == "true":
            qs = qs.filter(quantite_disponible__lte=F("seuil_alerte"))
        if id_ressource := self.request.query_params.get("id_ressource"):
            qs = qs.filter(id_ressource=id_ressource)
        return qs


# ---------------------------------------------------------------------------
# InstanceRessource
# ---------------------------------------------------------------------------


class InstanceRessourceViewSet(viewsets.ModelViewSet):
    serializer_class = InstanceRessourceSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = InstanceRessource.objects.select_related(
            "id_ressource",
            "id_service_actuel",
        )

        if user.id_role and user.id_role.nom_role == "chef_service":
            qs = qs.filter(
                id_service_actuel=user.id_service,
                statut="en_stock",
            )

        params = self.request.query_params

        if statut := params.get("statut"):
            qs = qs.filter(statut=statut)
        if etat := params.get("etat"):
            qs = qs.filter(etat=etat)
        if id_service_actuel := params.get("id_service_actuel"):
            qs = qs.filter(id_service_actuel=id_service_actuel)
        if id_ressource := params.get("id_ressource"):
            qs = qs.filter(id_ressource=id_ressource)

        return qs


# ---------------------------------------------------------------------------
# MouvementStock  (read-only)
# ---------------------------------------------------------------------------


class MouvementStockViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MouvementStockSerializer
    permission_classes = [IsGestionnaireOrAdmin]

    def get_queryset(self):
        qs = MouvementStock.objects.select_related(
            "id_ressource",
            "id_instance_ressource",
            "id_utilisateur",
            "content_type",
        ).all()
        params = self.request.query_params

        if id_ressource := params.get("id_ressource"):
            qs = qs.filter(id_ressource=id_ressource)
        if type_mouvement := params.get("type_mouvement"):
            qs = qs.filter(type_mouvement=type_mouvement)
        # date range: ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
        if date_from := params.get("date_from"):
            qs = qs.filter(date_mouvement__date__gte=date_from)
        if date_to := params.get("date_to"):
            qs = qs.filter(date_mouvement__date__lte=date_to)

        return qs
