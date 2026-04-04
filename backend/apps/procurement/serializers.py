from rest_framework import serializers
from django.db.models import Count, Q

from .models import (
    ImportExcelBC,
    LotArticle,
    MarcheBC,
    MarcheEtape,
    StagingItem,
)


# ---------------------------------------------------------------------------
# Nested read helpers
# ---------------------------------------------------------------------------


class _FournisseurBriefSerializer(serializers.Serializer):
    """Read-only representation of Fournisseur: {id_fournisseur, nom_societe}."""

    id_fournisseur = serializers.IntegerField()
    nom_societe = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    telephone = serializers.CharField(required=False, allow_blank=True)


class _RessourceBriefSerializer(serializers.Serializer):
    """Read-only representation of Ressource for LotArticle nesting."""

    id_ressource = serializers.IntegerField()
    designation = serializers.CharField()
    unite_mesure = serializers.CharField()


# ---------------------------------------------------------------------------
# MarcheEtape
# ---------------------------------------------------------------------------


class MarcheEtapeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarcheEtape
        fields = [
            "id_etape",
            "ordre",
            "nom_etape",
            "statut",
            "date_debut",
            "date_fin",
            "commentaire",
            "id_marche",
            "id_modifie_par",
        ]
        read_only_fields = ["id_etape"]


# ---------------------------------------------------------------------------
# MarcheBC
# ---------------------------------------------------------------------------


class MarcheBCSerializer(serializers.ModelSerializer):
    fournisseur = _FournisseurBriefSerializer(source="id_fournisseur", read_only=True)
    etapes = MarcheEtapeSerializer(many=True, read_only=True)

    class Meta:
        model = MarcheBC
        fields = [
            "id_marche",
            "reference",
            "type_acquisition",
            "date_creation",
            "delai_reception_jours",
            "date_livraison_prevue",
            "statut",
            "fichier_cps",
            "id_fournisseur",
            "fournisseur",
            "id_cree_par",
            "etapes",
        ]
        read_only_fields = [
            "id_marche",
            "date_creation",
            "delai_reception_jours",
            "date_livraison_prevue",
            "etapes",
        ]


# ---------------------------------------------------------------------------
# ImportExcelBC
# ---------------------------------------------------------------------------


class ImportExcelBCSerializer(serializers.ModelSerializer):
    staging_items_count = serializers.SerializerMethodField()

    class Meta:
        model = ImportExcelBC
        fields = [
            "id_import",
            "fichier_excel_original",
            "date_import",
            "statut_import",
            "source_type",
            "observations",
            "id_marche",
            "id_importe_par",
            "staging_items_count",
        ]
        read_only_fields = ["id_import", "date_import", "statut_import", "id_importe_par"]

    def get_staging_items_count(self, obj) -> int:
        return obj.staging_items.count()


class ImportExcelBCStatusSerializer(serializers.ModelSerializer):
    staging_items_count = serializers.SerializerMethodField()
    staging_items_approved_count = serializers.SerializerMethodField()

    class Meta:
        model = ImportExcelBC
        fields = [
            "id_import",
            "id_marche",
            "statut_import",
            "observations",
            "staging_items_count",
            "staging_items_approved_count",
        ]
        read_only_fields = fields

    def _get_counts(self, obj):
        counts = getattr(obj, "_staging_counts", None)
        if counts is not None:
            return counts

        counts = obj.staging_items.aggregate(
            total=Count("id_staging"),
            approved=Count("id_staging", filter=Q(statut="approuve")),
        )
        obj._staging_counts = counts
        return counts

    def get_staging_items_count(self, obj) -> int:
        return self._get_counts(obj).get("total", 0)

    def get_staging_items_approved_count(self, obj) -> int:
        return self._get_counts(obj).get("approved", 0)


# ---------------------------------------------------------------------------
# StagingItem
# ---------------------------------------------------------------------------


class StagingItemSerializer(serializers.ModelSerializer):
    needs_review = serializers.BooleanField(read_only=True)

    class Meta:
        model = StagingItem
        fields = [
            "id_staging",
            "designation_brute",
            "designation_normalisee",
            "quantite",
            "confiance_ia",
            "statut",
            "correction_gestionnaire",
            "id_import",
            "id_categorie_suggeree",
            "id_ressource_liee",
            "needs_review",
        ]
        read_only_fields = [
            "id_staging",
            "designation_brute",
            "confiance_ia",
            "id_import",
            "needs_review",
        ]

    def validate(self, attrs):
        # When the incoming update sets statut → 'approuve', the normalised
        # designation must already exist on the instance or be supplied now.
        incoming_statut = attrs.get("statut")
        if incoming_statut == "approuve":
            if not self.instance or not self.instance.id_ressource_liee:
                raise serializers.ValidationError(
                    {
                        "id_ressource_liee": (
                            "Vous devez lier une ressource existante avant d'approuver."
                        )
                    }
                )
            # Check the value being written, then fall back to current instance
            designation = attrs.get("designation_normalisee")
            if not designation and self.instance:
                designation = self.instance.designation_normalisee
            if not designation or not designation.strip():
                raise serializers.ValidationError(
                    {
                        "designation_normalisee": (
                            "Ce champ est obligatoire pour approuver un article."
                        )
                    }
                )
        return attrs


# ---------------------------------------------------------------------------
# LotArticle
# ---------------------------------------------------------------------------


class LotArticleSerializer(serializers.ModelSerializer):
    ressource = _RessourceBriefSerializer(source="id_ressource", read_only=True)

    class Meta:
        model = LotArticle
        fields = [
            "id_lot",
            "numero_lot",
            "designation",
            "quantite_commandee",
            "quantite_recue",
            "observation",
            "id_marche",
            "id_ressource",
            "ressource",
        ]
        read_only_fields = ["id_lot"]
