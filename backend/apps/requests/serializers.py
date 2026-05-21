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
        return obj.id_type.nom_categorie if obj.id_type else ""

    def get_sous_categorie_nom(self, obj) -> str:
        sc = obj.id_sous_categorie
        return sc.nom_sous_categorie if sc else ""

    def get_categorie_metier_nom(self, obj) -> str:
        cat = obj.id_categorie
        if cat:
            return cat.nom_categorie
        sc = obj.id_sous_categorie
        return sc.nom_sous_categorie if sc else ""


class _UtilisateurBriefSerializer(serializers.Serializer):
    """Read-only: user info for demande detail."""

    id_utilisateur = serializers.IntegerField()
    nom_complet = serializers.CharField()
    email = serializers.EmailField()
    service_nom = serializers.SerializerMethodField()
    role_nom = serializers.SerializerMethodField()

    def get_service_nom(self, obj):
        return obj.id_service.nom_service if obj.id_service else None

    def get_role_nom(self, obj):
        return obj.id_role.nom_role if obj.id_role else None


class _ServiceBriefSerializer(serializers.Serializer):
    """Read-only: service with hierarchy info."""

    id_service = serializers.IntegerField()
    nom_service = serializers.CharField()
    batiment_nom = serializers.SerializerMethodField()
    etablissement_nom = serializers.SerializerMethodField()

    def get_batiment_nom(self, obj):
        return obj.id_batiment.nom if obj.id_batiment else None

    def get_etablissement_nom(self, obj):
        if obj.id_batiment and obj.id_batiment.id_etablissement:
            return obj.id_batiment.id_etablissement.nom
        return None


class _BeneficiaireBriefSerializer(serializers.Serializer):
    """Read-only: {id_beneficiaire, nom, role_type}."""

    id_beneficiaire = serializers.IntegerField()
    nom = serializers.CharField()
    role_type = serializers.CharField()


# ---------------------------------------------------------------------------
# LigneDemande
# ---------------------------------------------------------------------------


class LigneDemandeSerializer(serializers.ModelSerializer):
    ressource = _RessourceBriefSerializer(source="id_ressource", read_only=True)
    disponibilite_pct = serializers.SerializerMethodField()

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
            "disponibilite_pct",
        ]
        read_only_fields = ["id_ligne", "id_demande"]

    def get_disponibilite_pct(self, obj) -> int:
        from apps.resources.models import Stock, InstanceRessource
        
        ressource = obj.id_ressource
        if not ressource:
            return 0
            
        qty_demande = obj.quantite_demandee
        if qty_demande <= 0:
            return 100
            
        if ressource.is_consommable:
            stock = Stock.objects.filter(id_ressource=ressource).first()
            available = stock.quantite_disponible if stock else 0
        else:
            available = InstanceRessource.objects.filter(
                id_ressource=ressource,
                statut="en_stock"
            ).count()
            
        pct = int((available / qty_demande) * 100)
        return min(100, pct)



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
    beneficiaire = _BeneficiaireBriefSerializer(source="id_beneficiaire", read_only=True)
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
            "id_beneficiaire",
            "beneficiaire",
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
            "id_beneficiaire",
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
