from rest_framework import serializers

from .models import AlerteDelai, Notification


class _MarcheBriefSerializer(serializers.Serializer):
    id_marche = serializers.IntegerField()
    reference = serializers.CharField()
    type_acquisition = serializers.CharField()


class AlerteDelaiSerializer(serializers.ModelSerializer):
    jours_restants = serializers.IntegerField(read_only=True)
    marche = _MarcheBriefSerializer(source="id_marche", read_only=True)
    fournisseur = serializers.SerializerMethodField()

    def get_fournisseur(self, obj):
        fournisseur = getattr(obj.id_marche, "id_fournisseur", None)
        return fournisseur.nom_societe if fournisseur else ""

    class Meta:
        model = AlerteDelai
        fields = [
            "id_alerte",
            "date_echeance",
            "niveau_alerte",
            "date_alerte",
            "penalite_applicable",
            "acquitte",
            "id_marche",
            "marche",
            "fournisseur",
            "jours_restants",
        ]
        read_only_fields = [
            "id_alerte",
            "date_echeance",
            "niveau_alerte",
            "date_alerte",
            "penalite_applicable",
            "id_marche",
            "jours_restants",
        ]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id_notification",
            "type_notification",
            "titre",
            "message",
            "date_envoi",
            "lu",
            "date_lecture",
            "canal",
            "content_type",
            "object_id",
            "id_destinataire",
        ]
        read_only_fields = [
            "id_notification",
            "type_notification",
            "titre",
            "message",
            "date_envoi",
            "date_lecture",
            "canal",
            "content_type",
            "object_id",
            "id_destinataire",
        ]
