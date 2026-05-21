from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .models import (
    Categorie,
    InstanceRessource,
    MouvementStock,
    Ressource,
    SousCategorie,
    Stock,
    TypeArticle,
)
from .utils import normalize_key, normalize_sous_categorie_name


class TypeArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeArticle
        fields = ["id_type_article", "nom_categorie", "description", "actif"]
        read_only_fields = ["id_type_article"]


class CategorieSerializer(serializers.ModelSerializer):
    type_article = TypeArticleSerializer(source="id_type", read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Categorie
        fields = ["id_categorie", "nom_categorie", "description", "actif", "id_type", "type_article", "updated_at"]


class SousCategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = SousCategorie
        fields = [
            "id_sous_categorie",
            "nom_sous_categorie",
            "id_categorie",
        ]

    def validate(self, attrs):
        nom_sous_categorie = attrs.get(
            "nom_sous_categorie",
            getattr(self.instance, "nom_sous_categorie", ""),
        )
        id_categorie = attrs.get(
            "id_categorie",
            getattr(self.instance, "id_categorie", None),
        )

        normalized_name = normalize_sous_categorie_name(nom_sous_categorie)
        attrs["nom_sous_categorie"] = normalized_name

        if id_categorie and normalized_name:
            normalized_key = normalize_key(normalized_name)
            existing = SousCategorie.objects.filter(id_categorie=id_categorie)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)

            if any(
                normalize_key(item.nom_sous_categorie) == normalized_key
                for item in existing
            ):
                raise ValidationError(
                    {
                        "nom_sous_categorie": (
                            "Une sous-categorie normalisee identique existe deja pour cette categorie."
                        )
                    }
                )

        return attrs


class RessourceSerializer(serializers.ModelSerializer):
    type_article = TypeArticleSerializer(source="id_type", read_only=True)
    categorie = CategorieSerializer(source="id_categorie", read_only=True)
    sous_categorie = SousCategorieSerializer(source="id_sous_categorie", read_only=True)
    is_consommable = serializers.BooleanField(read_only=True)
    is_bien_inventaire = serializers.BooleanField(read_only=True)
    instances_en_stock = serializers.IntegerField(read_only=True)
    est_en_alerte = serializers.SerializerMethodField()

    def get_est_en_alerte(self, obj):
        if not obj.is_consommable:
            return False
        try:
            stock = obj.stock
        except Exception:
            return False
        if stock.seuil_alerte is None:
            return False
        return stock.quantite_disponible <= stock.seuil_alerte

    class Meta:
        model = Ressource
        fields = [
            "id_ressource",
            "designation",
            "marque",
            "description",
            "unite_mesure",
            "est_en_alerte",
            "instances_en_stock",
            "id_type",
            "type_article",
            "id_categorie",
            "categorie",
            "id_sous_categorie",
            "sous_categorie",
            "is_consommable",
            "is_bien_inventaire",
        ]


class StockSerializer(serializers.ModelSerializer):
    quantite_reelle = serializers.IntegerField(read_only=True)
    est_en_alerte = serializers.BooleanField(read_only=True)

    class Meta:
        model = Stock
        fields = [
            "id_stock",
            "id_ressource",
            "quantite_disponible",
            "quantite_reservee",
            "quantite_reelle",
            "seuil_alerte",
            "est_en_alerte",
            "updated_at",
        ]
        read_only_fields = ["id_stock", "updated_at", "quantite_reelle"]


class _EtablissementBriefSerializer(serializers.Serializer):
    id_etablissement = serializers.IntegerField()
    nom = serializers.CharField()


class _BatimentBriefSerializer(serializers.Serializer):
    id_batiment = serializers.IntegerField()
    nom = serializers.CharField()


class _ServiceBriefSerializer(serializers.Serializer):
    id_service = serializers.IntegerField()
    nom_service = serializers.CharField()
    id_batiment = _BatimentBriefSerializer(read_only=True)


class _BeneficiaireBriefSerializer(serializers.Serializer):
    id_beneficiaire = serializers.IntegerField()
    nom = serializers.CharField()
    role_type = serializers.CharField()


class _MarcheBriefSerializer(serializers.Serializer):
    id_marche = serializers.IntegerField()
    reference = serializers.CharField()
    date_creation = serializers.DateField(allow_null=True)
    date_livraison_prevue = serializers.DateField(allow_null=True)


class _LotBriefSerializer(serializers.Serializer):
    id_lot = serializers.IntegerField()
    numero_lot = serializers.IntegerField()
    id_marche = _MarcheBriefSerializer(read_only=True)


class InstanceRessourceSerializer(serializers.ModelSerializer):
    ressource = RessourceSerializer(source="id_ressource", read_only=True)
    lieu_affectation = serializers.SerializerMethodField()
    service_actuel = _ServiceBriefSerializer(source="id_service_actuel", read_only=True)
    destinataire = _BeneficiaireBriefSerializer(source="id_destinataire", read_only=True)
    date_acquisition_display = serializers.SerializerMethodField()
    reference_marche = serializers.SerializerMethodField()
    id_lot = _LotBriefSerializer(read_only=True)

    class Meta:
        model = InstanceRessource
        fields = [
            "id_instance",
            "numero_inventaire",
            "date_acquisition",
            "date_acquisition_display",
            "valeur_acquisition",
            "statut",
            "etat",
            "type_affectation",
            "date_derniere_affectation",
            "observation",
            "id_ressource",
            "ressource",
            "id_lieu_affectation",
            "lieu_affectation",
            "id_service_actuel",
            "service_actuel",
            "id_destinataire",
            "destinataire",
            "id_lot",
            "reference_marche",
        ]

    def get_lieu_affectation(self, obj):
        etab = obj.id_lieu_affectation
        if not etab:
            svc = obj.id_service_actuel
            etab = (
                svc
                and getattr(svc, "id_batiment", None)
                and getattr(svc.id_batiment, "id_etablissement", None)
            ) or None
        if etab:
            return {"id_etablissement": etab.pk, "nom": etab.nom}
        return None

    def get_date_acquisition_display(self, obj):
        if obj.date_acquisition:
            return obj.date_acquisition
        lot = getattr(obj, "id_lot", None)
        marche = getattr(lot, "id_marche", None) if lot else None
        if marche and marche.date_creation:
            return marche.date_creation
        if marche and marche.date_livraison_prevue:
            return marche.date_livraison_prevue
        return None

    def get_reference_marche(self, obj):
        lot = getattr(obj, "id_lot", None)
        marche = getattr(lot, "id_marche", None) if lot else None
        if marche:
            import_excel = getattr(marche, "import_excel", None)
            if import_excel and import_excel.reference_document:
                return import_excel.reference_document
            return marche.reference
        return None


class MouvementStockSerializer(serializers.ModelSerializer):
    reference = serializers.SerializerMethodField()
    lieu_affectation = serializers.SerializerMethodField()
    service_affectation = serializers.SerializerMethodField()
    destinataire_affectation = serializers.SerializerMethodField()

    class Meta:
        model = MouvementStock
        fields = [
            "id_mouvement",
            "type_mouvement",
            "quantite",
            "date_mouvement",
            "reference",
            "id_ressource",
            "id_instance_ressource",
            "lieu_affectation",
            "service_affectation",
            "destinataire_affectation",
        ]
        read_only_fields = ["id_mouvement", "date_mouvement", "reference"]

    def _get_source(self, obj):
        if hasattr(obj, "_preloaded_source"):
            return obj._preloaded_source, getattr(obj, "_preloaded_source_model", "")
        if obj.source is None:
            return None, ""
        return obj.source, (obj.content_type.model if obj.content_type else "")

    def get_reference(self, obj) -> str | None:
        source, model = self._get_source(obj)
        if source is None:
            return None
        try:
            if model == "lignedecharge":
                decharge = getattr(source, "id_decharge", None)
                if decharge:
                    return decharge.numero_decharge
            if model == "lotarticle":
                marche = getattr(source, "id_marche", None)
                if marche:
                    import_excel = getattr(marche, "import_excel", None)
                    if import_excel and import_excel.reference_document:
                        return import_excel.reference_document
                    return marche.reference
        except Exception:
            pass
        return None

    def _get_demande_for_sortie(self, obj):
        if obj.type_mouvement != "sortie":
            return None
        source, model = self._get_source(obj)
        if model != "lignedecharge" or source is None:
            return None
        try:
            return source.id_decharge.id_demande
        except Exception:
            return None

    def get_lieu_affectation(self, obj) -> str | None:
        demande = self._get_demande_for_sortie(obj)
        if demande is None:
            return None
        try:
            svc = demande.id_service
            etab = (
                svc
                and getattr(svc, "id_batiment", None)
                and getattr(svc.id_batiment, "id_etablissement", None)
            ) or None
            return etab.nom if etab else None
        except Exception:
            return None

    def get_service_affectation(self, obj) -> str | None:
        demande = self._get_demande_for_sortie(obj)
        if demande is None:
            return None
        try:
            return demande.id_service.nom_service
        except Exception:
            return None

    def get_destinataire_affectation(self, obj) -> str | None:
        demande = self._get_demande_for_sortie(obj)
        if demande is None:
            return None
        try:
            return demande.id_beneficiaire.nom
        except Exception:
            return None
