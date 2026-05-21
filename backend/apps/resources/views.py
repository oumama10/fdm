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
    TypeArticle,
)
from .serializers import (
    CategorieSerializer,
    InstanceRessourceSerializer,
    MouvementStockSerializer,
    RessourceSerializer,
    SousCategorieSerializer,
    StockSerializer,
    TypeArticleSerializer,
)


class _ReadUpdateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Generic base: list + retrieve + update/partial_update — no create or destroy."""


# ---------------------------------------------------------------------------
# TypeArticle  (read-only — only 2 rows: consommable / bien_inventaire)
# ---------------------------------------------------------------------------


class TypeArticleViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = TypeArticleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TypeArticle.objects.all()


# ---------------------------------------------------------------------------
# Categorie  (business categories, children of TypeArticle)
# ---------------------------------------------------------------------------


class CategorieViewSet(viewsets.ModelViewSet):
    serializer_class = CategorieSerializer

    def get_queryset(self):
        qs = Categorie.objects.select_related("id_type").all()
        id_type = self.request.query_params.get("id_type")
        type_nom = self.request.query_params.get("type")
        actif = self.request.query_params.get("actif")

        if id_type:
            qs = qs.filter(id_type_id=id_type)
        if type_nom:
            qs = qs.filter(id_type__nom_categorie=type_nom.lower())
        if actif is not None:
            normalized = str(actif).strip().lower()
            if normalized in ("true", "1", "yes"):
                qs = qs.filter(actif=True)
            elif normalized in ("false", "0", "no"):
                qs = qs.filter(actif=False)
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

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        qs = SousCategorie.objects.select_related("id_categorie").all()
        cat_id = self.request.query_params.get("id_categorie") or self.request.query_params.get("categorie")
        if cat_id:
            qs = qs.filter(id_categorie_id=cat_id)
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
            "id_type", "id_categorie", "id_sous_categorie"
        ).annotate(
            instances_en_stock=Count(
                "instanceressource",
                filter=Q(instanceressource__statut="en_stock"),
            )
        )
        params = self.request.query_params

        id_type = params.get("id_type")
        cat_id = params.get("id_categorie") or params.get("categorie")
        scat_id = params.get("id_sous_categorie") or params.get("sous_categorie")

        if id_type:
            qs = qs.filter(id_type_id=id_type)
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
        if type_param:
            qs = qs.filter(id_type__nom_categorie=type_param.lower())

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

    def perform_update(self, serializer):
        serializer.validated_data.pop("type_affectation", None)
        instance = serializer.instance
        if not instance.type_affectation:
            serializer.save(type_affectation="nouvelle_affectation")
        else:
            serializer.save()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsGestionnaireOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = InstanceRessource.objects.select_related(
            "id_ressource",
            "id_lieu_affectation",
            "id_service_actuel__id_batiment__id_etablissement",
            "id_destinataire",
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
            "content_type",
        ).order_by("-date_mouvement")
        params = self.request.query_params

        if id_ressource := params.get("id_ressource"):
            qs = qs.filter(id_ressource=id_ressource)
        if id_instance := params.get("id_instance"):
            qs = qs.filter(id_instance_ressource=id_instance)
        if type_mouvement := params.get("type_mouvement"):
            qs = qs.filter(type_mouvement=type_mouvement)
        if date_from := params.get("date_from"):
            qs = qs.filter(date_mouvement__date__gte=date_from)
        if date_to := params.get("date_to"):
            qs = qs.filter(date_mouvement__date__lte=date_to)

        return qs

    def list(self, request, *args, **kwargs):
        from django.contrib.contenttypes.models import ContentType
        from apps.decharge.models import LigneDecharge
        from apps.procurement.models import LotArticle

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        items = list(page if page is not None else queryset)

        try:
            ligne_ct = ContentType.objects.get_for_model(LigneDecharge)
            lot_ct = ContentType.objects.get_for_model(LotArticle)
        except Exception:
            ligne_ct = lot_ct = None

        ligne_ids = [m.object_id for m in items if ligne_ct and m.content_type_id == ligne_ct.id and m.object_id]
        lot_ids = [m.object_id for m in items if lot_ct and m.content_type_id == lot_ct.id and m.object_id]

        lignes_by_id = {}
        lots_by_id = {}

        if ligne_ids:
            lignes_by_id = {
                l.pk: l
                for l in LigneDecharge.objects.filter(pk__in=ligne_ids).select_related(
                    "id_decharge__id_demande__id_service__id_batiment__id_etablissement",
                    "id_decharge__id_demande__id_beneficiaire",
                )
            }

        if lot_ids:
            lots_by_id = {
                lot.pk: lot
                for lot in LotArticle.objects.filter(pk__in=lot_ids).select_related(
                    "id_marche__import_excel",
                )
            }

        for m in items:
            if ligne_ct and m.content_type_id == ligne_ct.id:
                m._preloaded_source = lignes_by_id.get(m.object_id)
                m._preloaded_source_model = "lignedecharge"
            elif lot_ct and m.content_type_id == lot_ct.id:
                m._preloaded_source = lots_by_id.get(m.object_id)
                m._preloaded_source_model = "lotarticle"
            else:
                m._preloaded_source = None
                m._preloaded_source_model = ""

        serializer = self.get_serializer(items, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsGestionnaireOrAdmin])
def stock_summary(request):
    total_consommables = Ressource.objects.filter(id_type__nom_categorie="consommable").count()
    total_instances = InstanceRessource.objects.count()

    cons_alerts = Stock.objects.filter(
        seuil_alerte__isnull=False,
        quantite_disponible__lte=F("seuil_alerte"),
    ).count()

    bi_alerts = (
        Ressource.objects.filter(
            id_type__nom_categorie="bien_inventaire",
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
