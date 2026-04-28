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
    import_excel = serializers.SerializerMethodField()

    class Meta:
        model = MarcheBC
        fields = [
            "id_marche",
            "reference",
            "type_acquisition",
            "type_donateur",
            "nom_donateur",
            "organisme_donateur",
            "contact_donateur",
            "beneficiaire_commande",
            "statut_signature_commande",
            "date_signature_commande",
            "date_creation",
            "delai_reception_jours",
            "date_livraison_prevue",
            "statut",
            "fichier_cps",
            "id_demande_source",
            "id_fournisseur",
            "fournisseur",
            "id_cree_par",
            "etapes",
            "import_excel",
        ]
        read_only_fields = [
            "id_marche",
            "date_creation",
            "delai_reception_jours",
            "date_livraison_prevue",
            "etapes",
        ]

    def validate(self, attrs):
        data = dict(attrs)
        if self.instance is not None:
            data.setdefault("type_acquisition", self.instance.type_acquisition)
            data.setdefault("nom_donateur", self.instance.nom_donateur)

        if data.get("type_acquisition") == "donation" and not str(
            data.get("nom_donateur") or ""
        ).strip():
            raise serializers.ValidationError(
                {"nom_donateur": "Le nom du donateur est obligatoire pour un don."}
            )
        return attrs

    def get_import_excel(self, obj):
        import_obj = getattr(obj, "import_excel", None)
        if not import_obj:
            return None
        return {
            "id_import": import_obj.id_import,
            "titre_fichier": import_obj.titre_fichier,
            "statut_import": import_obj.statut_import,
            "file_type": import_obj.file_type,
            "reference_document": import_obj.reference_document,
            "fournisseur_denomination": import_obj.fournisseur_denomination,
            "fournisseur_telephone": import_obj.fournisseur_telephone,
            "fournisseur_email": import_obj.fournisseur_email,
            "fournisseur_adresse": import_obj.fournisseur_adresse,
            "delai_execution": import_obj.delai_execution,
            "observations": import_obj.observations,
        }


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
            "titre_fichier",
            "date_import",
            "reference_document",
            "fournisseur_denomination",
            "fournisseur_telephone",
            "fournisseur_email",
            "fournisseur_adresse",
            "delai_execution",
            "statut_import",
            "file_type",
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
            "titre_fichier",
            "reference_document",
            "fournisseur_denomination",
            "fournisseur_telephone",
            "fournisseur_email",
            "fournisseur_adresse",
            "delai_execution",
            "statut_import",
            "file_type",
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
            "description",
            "designation_normalisee",
            "quantite",
            "statut",
            "correction_gestionnaire",
            "motif_rejet",
            "commentaire_rejet",
            "prix_unitaire_ht",
            "prix_total_ht",
            "unite",
            "id_import",
            "id_categorie_suggeree",
            "id_ressource_liee",
            "needs_review",
        ]
        read_only_fields = [
            "id_staging",
            "designation_brute",
            "id_import",
            "needs_review",
        ]

    def validate(self, attrs):
        # When the incoming update sets statut → 'approuve', the normalised
        # designation must already exist on the instance or be supplied now.
        incoming_statut = attrs.get("statut")
        if incoming_statut == "approuve":
            linked_resource = attrs.get("id_ressource_liee")
            if not linked_resource and self.instance:
                linked_resource = self.instance.id_ressource_liee

            if not linked_resource:
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
