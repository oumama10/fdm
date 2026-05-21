from django.db import models, transaction

from apps.core.models import TimestampedModel
from django.urls import reverse
from django.utils import timezone


class Demande(TimestampedModel):
    URGENCE_CHOICES = [
        ("normal", "normal"),
        ("moyen", "moyen"),
        ("urgent", "urgent"),
    ]
    STATUT_CHOICES = [
        ("en_cours", "en_cours"),
        ("traite", "traite"),
        ("en_instance", "en_instance"),
        ("refuse", "refuse"),
    ]

    id_demande = models.AutoField(primary_key=True)
    numero = models.CharField(max_length=30, unique=True, null=True, blank=True)
    date_demande = models.DateTimeField(auto_now_add=True, db_index=True)
    urgence = models.CharField(max_length=10, choices=URGENCE_CHOICES, default="normal")
    statut = models.CharField(max_length=30, choices=STATUT_CHOICES, default="en_cours", db_index=True)
    type_demandeur = models.CharField(max_length=30, default="chef_service")
    justification = models.TextField(blank=True)
    date_validation = models.DateTimeField(null=True, blank=True)
    commentaire_validation = models.TextField(blank=True)
    motif_refus = models.TextField(blank=True)
    id_chef_demandeur = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.PROTECT,
        related_name="demandes_soumises",
    )
    id_service = models.ForeignKey("users.Service", on_delete=models.CASCADE)
    id_beneficiaire = models.ForeignKey(
        "users.Beneficiaire",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demandes",
    )
    id_valide_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="demandes_validees",
    )

    class Meta:
        verbose_name = "demande"
        verbose_name_plural = "demandes"
        indexes = [
            models.Index(fields=["statut", "date_demande"], name="demande_statut_date_idx"),
            models.Index(fields=["id_service", "statut"], name="demande_service_statut_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self.pk and not self.numero:
            year = timezone.localdate().year
            prefix = f"DEM-{year}-"
            with transaction.atomic():
                last = (
                    Demande.objects.select_for_update()
                    .filter(numero__startswith=prefix)
                    .order_by("-numero")
                    .first()
                )
                seq = 1
                if last and last.numero:
                    try:
                        seq = int(last.numero.split("-")[-1]) + 1
                    except (ValueError, IndexError):
                        seq = 1
                self.numero = f"{prefix}{seq:04d}"
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"Demande {self.numero or self.id_demande}"

    @property
    def lien_suivi(self):
        return reverse("demande-detail", kwargs={"pk": self.pk})


class LigneDemande(TimestampedModel):
    id_ligne = models.AutoField(primary_key=True)
    quantite_demandee = models.IntegerField()
    quantite_accordee = models.IntegerField(default=0)
    quantite_livree = models.IntegerField(default=0)
    observation = models.TextField(blank=True)
    id_demande = models.ForeignKey(
        Demande,
        on_delete=models.CASCADE,
        related_name="lignes",
    )
    id_ressource = models.ForeignKey("resources.Ressource", on_delete=models.PROTECT)

    class Meta:
        verbose_name = "ligne de demande"
        verbose_name_plural = "lignes de demande"

    def __str__(self):
        return f"Ligne {self.id_ligne} - {self.id_ressource}"