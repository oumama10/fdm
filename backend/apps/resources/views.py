from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, F, Q
from rest_framework.filters import SearchFilter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import IsGestionnaireOrAdmin, IsGestionnaireOrFinanciereOrAdmin

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
    serializer_class = CategorieSerializer

    def get_queryset(self):
        qs = Categorie.objects.all()
        is_consommable = self.request.query_params.get("is_consommable")
        if is_consommable is None:
            return qs

        normalized = str(is_consommable).strip().lower()
        if normalized in ("true", "1", "yes"):
            return qs.filter(nom_categorie="Consommable")
        if normalized in ("false", "0", "no"):
            return qs.filter(nom_categorie="Bien Inventaire")
        return qs

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]


# ---------------------------------------------------------------------------
# SousCategorie
# ---------------------------------------------------------------------------


class SousCategorieViewSet(viewsets.ModelViewSet):
    serializer_class = SousCategorieSerializer

    @staticmethod
    def _is_true(value):
        return str(value).strip().lower() in ("true", "1", "yes")

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = SousCategorie.objects.select_related("id_categorie", "id_parent_sous_categorie").all()
        cat_id = self.request.query_params.get("id_categorie") or self.request.query_params.get("categorie")
        parent_id = self.request.query_params.get("parent")
        roots_only = self.request.query_params.get("roots_only")

        if cat_id:
            qs = qs.filter(id_categorie_id=cat_id)
        if parent_id is not None:
            normalized_parent = str(parent_id).strip().lower()
            if normalized_parent in ("", "null", "none"):
                qs = qs.filter(id_parent_sous_categorie__isnull=True)
            else:
                qs = qs.filter(id_parent_sous_categorie_id=parent_id)
        if self._is_true(roots_only):
            qs = qs.filter(id_parent_sous_categorie__isnull=True)

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
        ).annotate(
            instances_en_stock=Count(
                "instanceressource",
                filter=Q(instanceressource__statut="en_stock"),
            )
        )
        params = self.request.query_params

        cat_id = params.get("id_categorie") or params.get("categorie")
        scat_id = params.get("id_sous_categorie") or params.get("sous_categorie")

        if cat_id:
            qs = qs.filter(id_categorie_id=cat_id)
        if scat_id:
            scat_value = str(scat_id).strip()
            if scat_value.isdigit():
                qs = qs.filter(id_sous_categorie_id=scat_value)
            else:
                qs = qs.filter(
                    id_sous_categorie__nom_sous_categorie__icontains=scat_value
                )

        # ?type=consommable | bien_inventaire
        type_param = params.get("type")
        if type_param == "consommable":
            qs = qs.filter(id_categorie__nom_categorie="Consommable")
        elif type_param == "bien_inventaire":
            qs = qs.filter(id_categorie__nom_categorie="Bien Inventaire")

        return qs

    @action(detail=True, methods=["patch"], url_path="set_seuil",
            permission_classes=[IsGestionnaireOrAdmin])
    def set_seuil(self, request, pk=None):
        if "seuil_alerte" not in request.data:
            return Response(
                {"detail": "seuil_alerte requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        val = request.data.get("seuil_alerte")
        if val is not None:
            try:
                val = int(val)
                if val < 0:
                    raise ValueError
            except (ValueError, TypeError):
                return Response(
                    {"detail": "seuil_alerte doit être un entier positif ou null."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        ressource = self.get_object()
        ressource.seuil_alerte = val
        ressource.save(update_fields=["seuil_alerte"])
        return Response(RessourceSerializer(self.get_queryset().get(pk=ressource.pk)).data)


# ---------------------------------------------------------------------------
# Stock  (read + update only — no create, no delete)
# ---------------------------------------------------------------------------


class StockViewSet(_ReadUpdateViewSet):
    serializer_class = StockSerializer
    permission_classes = [IsGestionnaireOrFinanciereOrAdmin]

    def get_queryset(self):
        qs = Stock.objects.select_related("id_ressource").all()
        alerte = self.request.query_params.get("alerte")
        if alerte and alerte.lower() == "true":
            qs = qs.filter(
                seuil_alerte__isnull=False,
                quantite_disponible__lte=F("seuil_alerte"),
            )
        if id_ressource := self.request.query_params.get("id_ressource"):
            qs = qs.filter(id_ressource=id_ressource)
        if search := self.request.query_params.get("search"):
            qs = qs.filter(id_ressource__designation__icontains=search)
        if sous_categorie := self.request.query_params.get("sous_categorie"):
            scat_value = str(sous_categorie).strip()
            if scat_value.isdigit():
                qs = qs.filter(id_ressource__id_sous_categorie_id=scat_value)
            else:
                qs = qs.filter(
                    id_ressource__id_sous_categorie__nom_sous_categorie__icontains=scat_value
                )
        return qs

    @action(detail=True, methods=["patch"], url_path="set_seuil")
    def set_seuil(self, request, pk=None):
        if "seuil_alerte" not in request.data:
            return Response(
                {"detail": "seuil_alerte requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        val = request.data.get("seuil_alerte")
        if val is not None:
            try:
                val = int(val)
                if val < 0:
                    raise ValueError
            except (ValueError, TypeError):
                return Response(
                    {"detail": "seuil_alerte doit être un entier positif ou null."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        stock = self.get_object()
        stock.seuil_alerte = val
        stock.save(update_fields=["seuil_alerte"])
        return Response(StockSerializer(stock).data)


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
            "id_lot__id_marche",
        )

        if user.id_role and user.id_role.nom_role == "chef_service":
            if str(self.request.query_params.get("scope", "")).strip().lower() == "retours":
                qs = qs.filter(id_service_actuel=user.id_service, statut="en_service")
            else:
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


@api_view(["GET"])
@permission_classes([IsGestionnaireOrAdmin])
def stock_summary(request):
    total_consommables = Ressource.objects.filter(id_categorie__nom_categorie="Consommable").count()
    total_instances = InstanceRessource.objects.count()

    cons_alerts = Stock.objects.filter(
        seuil_alerte__isnull=False,
        quantite_disponible__lte=F("seuil_alerte"),
    ).count()

    bi_alerts = (
        Ressource.objects.filter(
            id_categorie__nom_categorie="Bien Inventaire",
            seuil_alerte__isnull=False,
        )
        .annotate(
            instances_en_stock=Count(
                "instanceressource",
                filter=Q(instanceressource__statut="en_stock"),
            )
        )
        .filter(instances_en_stock__lte=F("seuil_alerte"))
        .count()
    )

    return Response(
        {
            "total_consommables": total_consommables,
            "total_biens_inventaire": total_instances,
            "alertes_stock": cons_alerts + bi_alerts,
        }
    )
