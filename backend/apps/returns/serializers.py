from rest_framework import serializers
from rest_framework.exceptions import ValidationError

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
    traite_par = _UtilisateurBriefSerializer(
        source="id_traite_par", read_only=True
    )
    service_nom = serializers.SerializerMethodField()

    def get_service_nom(self, obj):
        if obj.id_retourne_par and obj.id_retourne_par.id_service:
            return obj.id_retourne_par.id_service.nom_service
        return None

    class Meta:
        model = RetourMateriel
        fields = [
            "id_retour",
            "date_retour",
            "motif_retour",
            "statut",
            "date_reception",
            "decision",
            "justification_decision",
            "observation",
            "id_ressource",
            "ressource",
            "id_instance_ressource",
            "instance_ressource",
            "id_retourne_par",
            "retourne_par",
            "service_nom",
            "id_traite_par",
            "traite_par",
            "id_ligne_decharge_origine",
        ]
        read_only_fields = ["id_retour", "date_retour", "id_retourne_par", "statut", "date_reception"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        role = getattr(getattr(user, "id_role", None), "nom_role", None) if user else None

        if role == "chef_service":
            instance_ressource = attrs.get("id_instance_ressource")

            if self.instance is None:
                if not instance_ressource:
                    raise ValidationError({"id_instance_ressource": "Une instance est requise."})

                service_id = getattr(getattr(user, "id_service", None), "id_service", None)
                if service_id and instance_ressource.id_service_actuel_id != service_id:
                    raise ValidationError({"id_instance_ressource": "L'article doit appartenir à votre service."})

            # chef_service cannot write decision or justification_decision
            attrs.pop("decision", None)
            attrs.pop("justification_decision", None)

        return attrs
