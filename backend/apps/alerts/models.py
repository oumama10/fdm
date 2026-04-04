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


class Notification(models.Model):
    TYPE_CHOICES = [
        ("alerte_stock", "alerte_stock"),
        ("alerte_delai", "alerte_delai"),
        ("demande_soumise", "demande_soumise"),
        ("decharge_prete", "decharge_prete"),
        ("scan_recu", "scan_recu"),
        ("validation_requise", "validation_requise"),
    ]
    CANAL_CHOICES = [
        ("web", "web"),
        ("email", "email"),
    ]

    id_notification = models.AutoField(primary_key=True)
    type_notification = models.CharField(max_length=30, choices=TYPE_CHOICES)
    titre = models.CharField(max_length=200)
    message = models.TextField()
    date_envoi = models.DateTimeField(auto_now_add=True)
    lu = models.BooleanField(default=False)
    date_lecture = models.DateTimeField(null=True, blank=True)
    canal = models.CharField(max_length=10, choices=CANAL_CHOICES, default="web")
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    objet_lie = GenericForeignKey("content_type", "object_id")
    id_destinataire = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    class Meta:
        verbose_name = "notification"
        verbose_name_plural = "notifications"

    def __str__(self):
        return f"{self.type_notification} - {self.titre}"


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
