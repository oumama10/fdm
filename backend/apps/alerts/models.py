from datetime import date

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class AlerteDelai(models.Model):
    NIVEAU_CHOICES = [
        ("info", "info"),
        ("warning", "warning"),
        ("critique", "critique"),
    ]

    id_alerte = models.AutoField(primary_key=True)
    date_echeance = models.DateField()
    niveau_alerte = models.CharField(max_length=20, choices=NIVEAU_CHOICES)
    date_alerte = models.DateTimeField(auto_now_add=True)
    penalite_applicable = models.BooleanField(default=False)
    acquitte = models.BooleanField(default=False)
    id_marche = models.ForeignKey(
        "procurement.MarcheBC",
        on_delete=models.CASCADE,
        related_name="alertes",
    )

    class Meta:
        verbose_name = "alerte delai"
        verbose_name_plural = "alertes delai"

    def __str__(self):
        return f"Alerte {self.niveau_alerte} - {self.id_marche}"

    @property
    def jours_restants(self):
        return (self.date_echeance - date.today()).days


class NotificationType(models.TextChoices):
    DEMANDE_SOUMISE    = "demande_soumise", "Demande soumise"
    DEMANDE_VALIDEE    = "demande_validee", "Demande validée"
    DEMANDE_REJETEE    = "demande_rejetee", "Demande rejetée"
    DECHARGE_GENEREE   = "decharge_generee", "Décharge générée"
    DECHARGE_SIGNEE    = "decharge_signee", "Décharge signée"
    RETOUR_ENREGISTRE  = "retour_enregistre", "Retour enregistré"
    ALERTE_STOCK       = "alerte_stock", "Alerte stock"
    IMPORT_STAGING     = "import_staging", "Import en attente de révision"


class NotificationNiveau(models.TextChoices):
    INFO    = "info", "Info"
    SUCCESS = "success", "Succès"
    WARNING = "warning", "Avertissement"
    DANGER  = "danger", "Danger"


# Mapping type → niveau
NOTIFICATION_TYPE_TO_NIVEAU = {
    NotificationType.DEMANDE_SOUMISE:    NotificationNiveau.INFO,
    NotificationType.DEMANDE_VALIDEE:    NotificationNiveau.SUCCESS,
    NotificationType.DEMANDE_REJETEE:    NotificationNiveau.DANGER,
    NotificationType.DECHARGE_GENEREE:   NotificationNiveau.SUCCESS,
    NotificationType.DECHARGE_SIGNEE:    NotificationNiveau.SUCCESS,
    NotificationType.RETOUR_ENREGISTRE:  NotificationNiveau.WARNING,
    NotificationType.ALERTE_STOCK:       NotificationNiveau.WARNING,
    NotificationType.IMPORT_STAGING:     NotificationNiveau.INFO,
}


class Notification(models.Model):
    id_notification = models.AutoField(primary_key=True)
    destinataire = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.ALERTE_STOCK,
        db_index=True,
    )
    niveau = models.CharField(
        max_length=20,
        choices=NotificationNiveau.choices,
        default=NotificationNiveau.INFO,
    )
    message = models.CharField(max_length=500)
    lien = models.CharField(max_length=500, blank=True, null=True)
    lu = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    objet_id = models.IntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "notification"
        verbose_name_plural = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} - {self.message[:50]}"


class JournalAudit(models.Model):
    id_log = models.AutoField(primary_key=True)
    type_action = models.CharField(max_length=100)
    table_cible = models.CharField(max_length=100)
    id_enregistrement_cible = models.IntegerField()
    ancienne_valeur = models.TextField(blank=True)
    nouvelle_valeur = models.TextField(blank=True)
    date_action = models.DateTimeField(auto_now_add=True)
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    id_utilisateur = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "journal d'audit"
        verbose_name_plural = "journaux d'audit"

    def __str__(self):
        return f"{self.type_action} - {self.table_cible} #{self.id_enregistrement_cible}"

