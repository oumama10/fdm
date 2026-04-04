from rest_framework import serializers

from .models import RetourMateriel


class _RessourceBriefSerializer(serializers.Serializer):
    id_ressource = serializers.IntegerField()
    designation = serializers.CharField()
    unite_mesure = serializers.CharField()


class _InstanceBriefSerializer(serializers.Serializer):
    id_instance = serializers.IntegerField()
    numero_inventaire = serializers.CharField()
    etat = serializers.CharField()


class _UtilisateurBriefSerializer(serializers.Serializer):
    id_utilisateur = serializers.IntegerField()
    nom_complet = serializers.CharField()


class RetourMaterielSerializer(serializers.ModelSerializer):
    ressource = _RessourceBriefSerializer(source="id_ressource", read_only=True)
    instance_ressource = _InstanceBriefSerializer(
        source="id_instance_ressource", read_only=True
    )
    retourne_par = _UtilisateurBriefSerializer(
        source="id_retourne_par", read_only=True
    )

    class Meta:
        model = RetourMateriel
        fields = [
            "id_retour",
            "date_retour",
            "motif_retour",
            "decision",
            "justification_decision",
            "observation",
            "id_ressource",
            "ressource",
            "id_instance_ressource",
            "instance_ressource",
            "id_retourne_par",
            "retourne_par",
            "id_traite_par",
        ]
        read_only_fields = ["id_retour", "date_retour", "id_retourne_par"]
