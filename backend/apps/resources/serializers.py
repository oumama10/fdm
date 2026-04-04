from rest_framework import serializers

from .models import (
    Categorie,
    InstanceRessource,
    MouvementStock,
    Ressource,
    SousCategorie,
    Stock,
)


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ["id_categorie", "nom_categorie", "description", "actif"]


class SousCategorieSerializer(serializers.ModelSerializer):
    # Nested read; id_categorie remains writable as a plain PK integer.
    categorie = CategorieSerializer(source="id_categorie", read_only=True)

    class Meta:
        model = SousCategorie
        fields = [
            "id_sous_categorie",
            "nom_sous_categorie",
            "description",
            "id_categorie",
            "categorie",
        ]


class RessourceSerializer(serializers.ModelSerializer):
    categorie = CategorieSerializer(source="id_categorie", read_only=True)
    sous_categorie = SousCategorieSerializer(source="id_sous_categorie", read_only=True)
    is_consommable = serializers.BooleanField(read_only=True)
    is_bien_inventaire = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ressource
        fields = [
            "id_ressource",
            "designation",
            "description",
            "unite_mesure",
            "id_categorie",
            "categorie",
            "id_sous_categorie",
            "sous_categorie",
            "is_consommable",
            "is_bien_inventaire",
        ]


class StockSerializer(serializers.ModelSerializer):
    quantite_reelle = serializers.IntegerField(read_only=True)

    class Meta:
        model = Stock
        fields = [
            "id_stock",
            "id_ressource",
            "quantite_disponible",
            "quantite_reservee",
            "seuil_alerte",
            "date_mise_a_jour",
            "quantite_reelle",
        ]
        read_only_fields = ["id_stock", "date_mise_a_jour"]


class _ServiceBriefSerializer(serializers.Serializer):
    """Minimal read-only representation of a Service (id + nom_service)."""

    id_service = serializers.IntegerField()
    nom_service = serializers.CharField()


class InstanceRessourceSerializer(serializers.ModelSerializer):
    ressource = RessourceSerializer(source="id_ressource", read_only=True)
    service_actuel = _ServiceBriefSerializer(source="id_service_actuel", read_only=True)

    class Meta:
        model = InstanceRessource
        fields = [
            "id_instance",
            "numero_inventaire",
            "date_acquisition",
            "valeur_acquisition",
            "statut",
            "etat",
            "localisation_actuelle",
            "date_derniere_affectation",
            "observation",
            "id_ressource",
            "ressource",
            "id_service_actuel",
            "service_actuel",
            "id_lot",
        ]


class MouvementStockSerializer(serializers.ModelSerializer):
    # Generic FK target — serialised as a lightweight dict.
    source_object = serializers.SerializerMethodField()

    class Meta:
        model = MouvementStock
        fields = [
            "id_mouvement",
            "type_mouvement",
            "quantite",
            "date_mouvement",
            "observation",
            "content_type",
            "object_id",
            "source_object",
            "id_ressource",
            "id_instance_ressource",
            "id_utilisateur",
        ]
        read_only_fields = ["id_mouvement", "date_mouvement", "source_object"]

    def get_source_object(self, obj) -> dict | None:
        if obj.source is None:
            return None
        return {
            "model": obj.content_type.model if obj.content_type else None,
            "id": obj.object_id,
            "display": str(obj.source),
        }
