from rest_framework import serializers

from .models import Demande, LigneDemande


# ---------------------------------------------------------------------------
# Nested read helpers
# ---------------------------------------------------------------------------


class _RessourceBriefSerializer(serializers.Serializer):
    """Read-only brief resource info for demande lines."""

    id_ressource = serializers.IntegerField()
    designation = serializers.CharField()
    unite_mesure = serializers.CharField()
    reference = serializers.SerializerMethodField()
    categorie_nom = serializers.SerializerMethodField()
    sous_categorie_nom = serializers.SerializerMethodField()
    categorie_metier_nom = serializers.SerializerMethodField()

    def get_reference(self, obj) -> str:
        return f"ART-{obj.pk:03d}"

    def get_categorie_nom(self, obj) -> str:
        return obj.id_categorie.nom_categorie if obj.id_categorie else ""

    def get_sous_categorie_nom(self, obj) -> str:
        sc = obj.id_sous_categorie
        return sc.nom_sous_categorie if sc else ""

    def get_categorie_metier_nom(self, obj) -> str:
        sc = obj.id_sous_categorie
        if not sc:
            return ""
        parent = sc.id_parent_sous_categorie
        return parent.nom_sous_categorie if parent else sc.nom_sous_categorie


class _UtilisateurBriefSerializer(serializers.Serializer):
    """Read-only: {id_utilisateur, nom_complet}."""

    id_utilisateur = serializers.IntegerField()
    nom_complet = serializers.CharField()


class _ServiceBriefSerializer(serializers.Serializer):
    """Read-only: {id_service, nom_service}."""

    id_service = serializers.IntegerField()
    nom_service = serializers.CharField()


# ---------------------------------------------------------------------------
# LigneDemande
# ---------------------------------------------------------------------------


class LigneDemandeSerializer(serializers.ModelSerializer):
    ressource = _RessourceBriefSerializer(source="id_ressource", read_only=True)

    class Meta:
        model = LigneDemande
        fields = [
            "id_ligne",
            "quantite_demandee",
            "quantite_accordee",
            "quantite_livree",
            "observation",
            "id_demande",
            "id_ressource",
            "ressource",
        ]
        read_only_fields = ["id_ligne", "id_demande"]


# ---------------------------------------------------------------------------
# Demande — full read serializer
# ---------------------------------------------------------------------------


class DemandeSerializer(serializers.ModelSerializer):
    lignes = LigneDemandeSerializer(many=True, read_only=True)
    lien_suivi = serializers.CharField(read_only=True)
    chef_demandeur = _UtilisateurBriefSerializer(
        source="id_chef_demandeur", read_only=True
    )
    service = _ServiceBriefSerializer(source="id_service", read_only=True)
    decharge_id = serializers.SerializerMethodField()

    def get_decharge_id(self, obj):
        try:
            return obj.decharge.pk
        except Exception:
            return None

    class Meta:
        model = Demande
        fields = [
            "id_demande",
            "numero",
            "date_demande",
            "urgence",
            "statut",
            "type_demandeur",
            "beneficiaire_type",
            "beneficiaire_nom",
            "beneficiaire_detail",
            "justification",
            "date_validation",
            "commentaire_validation",
            "motif_refus",
            "id_chef_demandeur",
            "chef_demandeur",
            "id_service",
            "service",
            "id_valide_par",
            "lignes",
            "lien_suivi",
            "decharge_id",
        ]
        read_only_fields = [
            "id_demande",
            "numero",
            "date_demande",
            "statut",
            "date_validation",
            "id_valide_par",
            "lien_suivi",
            "decharge_id",
        ]


# ---------------------------------------------------------------------------
# Demande — create serializer
# ---------------------------------------------------------------------------


class _LigneCreateSerializer(serializers.Serializer):
    id_ressource = serializers.IntegerField()
    quantite_demandee = serializers.IntegerField(min_value=1)


class DemandeCreateSerializer(serializers.ModelSerializer):
    """
    Accepted body:
    {
        "urgence": "...",
        "justification": "...",
        "id_service": <int>,
        "lignes": [{"id_ressource": <int>, "quantite_demandee": <int>}, ...]
    }

    On creation:
    - id_chef_demandeur is injected from request.user (via view's perform_create).
    """

    lignes = _LigneCreateSerializer(many=True, write_only=True)

    class Meta:
        model = Demande
        fields = [
            "urgence",
            "type_demandeur",
            "beneficiaire_type",
            "beneficiaire_nom",
            "beneficiaire_detail",
            "justification",
            "id_service",
            "lignes",
        ]

    # ── create ───────────────────────────────────────────────────────────────

    def create(self, validated_data):
        from apps.resources.models import Ressource  # noqa: PLC0415

        lignes_data = validated_data.pop("lignes")
        demande = Demande.objects.create(**validated_data)

        lignes_bulk = []
        for ligne_data in lignes_data:
            ressource_id = ligne_data["id_ressource"]
            quantite = ligne_data["quantite_demandee"]
            try:
                ressource = Ressource.objects.select_related("id_categorie").get(
                    pk=ressource_id
                )
            except Ressource.DoesNotExist:
                raise serializers.ValidationError(
                    {"lignes": f"Ressource id={ressource_id} introuvable."}
                )
            lignes_bulk.append(
                LigneDemande(
                    id_demande=demande,
                    id_ressource=ressource,
                    quantite_demandee=quantite,
                )
            )
        LigneDemande.objects.bulk_create(lignes_bulk)
        return demande
