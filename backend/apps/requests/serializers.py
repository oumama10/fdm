from rest_framework import serializers

from .models import Demande, LigneDemande


# ---------------------------------------------------------------------------
# Nested read helpers
# ---------------------------------------------------------------------------


class _RessourceBriefSerializer(serializers.Serializer):
    """Read-only: {id_ressource, designation, categorie_nom, sous_categorie_nom, sous_categorie_parent_nom, unite_mesure}."""

    id_ressource = serializers.IntegerField()
    designation = serializers.CharField()
    unite_mesure = serializers.CharField()
    categorie_nom = serializers.SerializerMethodField()
    sous_categorie_nom = serializers.SerializerMethodField()
    sous_categorie_parent_nom = serializers.SerializerMethodField()

    def get_categorie_nom(self, obj) -> str:
        return obj.id_categorie.nom_categorie if obj.id_categorie else ""

    def get_sous_categorie_nom(self, obj) -> str:
        return obj.id_sous_categorie.nom_sous_categorie if obj.id_sous_categorie else ""

    def get_sous_categorie_parent_nom(self, obj) -> str:
        sc = obj.id_sous_categorie
        if sc and sc.id_parent_sous_categorie:
            return sc.id_parent_sous_categorie.nom_sous_categorie
        return ""


class _UtilisateurBriefSerializer(serializers.Serializer):
    """Read-only: {id_utilisateur, nom_complet}."""

    id_utilisateur = serializers.IntegerField()
    nom_complet = serializers.CharField()


class _ServiceBriefSerializer(serializers.Serializer):
    """Read-only: {id_service, nom_service}."""

    id_service = serializers.IntegerField()
    nom_service = serializers.CharField()


class _CommandeInterneBriefSerializer(serializers.Serializer):
    id_marche = serializers.IntegerField()
    reference = serializers.CharField()
    statut_signature_commande = serializers.CharField()
    date_signature_commande = serializers.DateTimeField(allow_null=True)


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
            "disponibilite_pct",
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
    commande_interne = _CommandeInterneBriefSerializer(read_only=True)

    class Meta:
        model = Demande
        fields = [
            "id_demande",
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
            "id_chef_demandeur",
            "chef_demandeur",
            "id_service",
            "service",
            "id_valide_par",
            "commande_interne",
            "lignes",
            "lien_suivi",
        ]
        read_only_fields = [
            "id_demande",
            "date_demande",
            "statut",
            "date_validation",
            "id_valide_par",
            "lien_suivi",
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
    - disponibilite_pct is computed per ligne from live stock/instance data.
    """

    lignes = _LigneCreateSerializer(many=True, write_only=True)
    lien_suivi = serializers.CharField(read_only=True)

    class Meta:
        model = Demande
        fields = [
            "id_demande",
            "urgence",
            "type_demandeur",
            "beneficiaire_type",
            "beneficiaire_nom",
            "beneficiaire_detail",
            "justification",
            "id_service",
            "lignes",
            "lien_suivi",
        ]
        read_only_fields = ["id_demande", "lien_suivi"]

    def validate(self, attrs):
        service = attrs.get("id_service")
        type_demandeur = attrs.get("type_demandeur")
        beneficiaire_type = str(attrs.get("beneficiaire_type") or "").strip()
        beneficiaire_nom = str(attrs.get("beneficiaire_nom") or "").strip()
        expected_demandeur = "Chef de service"

        if service and type_demandeur:
            expected_type = service.type_service
            if expected_type == "administratif":
                expected_type = "service"
            if type_demandeur != expected_type:
                raise serializers.ValidationError(
                    {
                        "type_demandeur": (
                            "Le type de demandeur doit correspondre au type du service selectionne."
                        )
                    }
                )

        if not beneficiaire_type:
            raise serializers.ValidationError(
                {"beneficiaire_type": "Le type de beneficiaire est obligatoire."}
            )
        if not beneficiaire_nom:
            raise serializers.ValidationError(
                {"beneficiaire_nom": "Le beneficiaire est obligatoire."}
            )

        if beneficiaire_nom != expected_demandeur:
            raise serializers.ValidationError(
                {
                    "beneficiaire_nom": (
                        "Seul 'Chef de service' est autorise comme demandeur."
                    )
                }
            )

        attrs["beneficiaire_type"] = beneficiaire_type
        attrs["beneficiaire_nom"] = expected_demandeur
        attrs["beneficiaire_detail"] = str(attrs.get("beneficiaire_detail") or "").strip()
        return attrs

    # ── availability helper ───────────────────────────────────────────────────

    @staticmethod
    def _compute_disponibilite(ressource, quantite_demandee: int) -> int:
        """
        Return an integer percentage [0–100] representing how much of
        *quantite_demandee* is currently available.

        Consommable  → compares against Stock.quantite_disponible.
        Bien inventaire → counts InstanceRessource with statut='en_stock'.
        """
        from apps.resources.models import InstanceRessource, Stock  # noqa: PLC0415

        if ressource.is_consommable:
            try:
                stock = Stock.objects.get(id_ressource=ressource)
                disponible = max(stock.quantite_disponible, 0)
            except Stock.DoesNotExist:
                disponible = 0
        else:
            disponible = InstanceRessource.objects.filter(
                id_ressource=ressource, statut="en_stock"
            ).count()

        if quantite_demandee <= 0:
            return 0
        return min(int((disponible / quantite_demandee) * 100), 100)

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
            dispo_pct = self._compute_disponibilite(ressource, quantite)
            lignes_bulk.append(
                LigneDemande(
                    id_demande=demande,
                    id_ressource=ressource,
                    quantite_demandee=quantite,
                    disponibilite_pct=dispo_pct,
                )
            )
        LigneDemande.objects.bulk_create(lignes_bulk)
        return demande
