from django.db import models
from django.urls import reverse
from django.utils import timezone


class Demande(models.Model):
    URGENCE_CHOICES = [
        ("normal", "normal"),
        ("moyen", "moyen"),
        ("urgent", "urgent"),
    ]
    STATUT_CHOICES = [
        ("en_attente", "en_attente"),
        ("partielle", "partielle"),
        ("totale", "totale"),
        ("refusee", "refusee"),
    ]

    id_demande = models.AutoField(primary_key=True)
    numero = models.CharField(max_length=30, unique=True, null=True, blank=True)
    date_demande = models.DateTimeField(auto_now_add=True, db_index=True)
    urgence = models.CharField(max_length=10, choices=URGENCE_CHOICES, default="normal")
    statut = models.CharField(max_length=30, choices=STATUT_CHOICES, default="en_attente", db_index=True)
    type_demandeur = models.CharField(max_length=30, default="chef_service")
    beneficiaire_type = models.CharField(max_length=30, default="service")
    beneficiaire_nom = models.CharField(max_length=200, blank=True)
    beneficiaire_detail = models.TextField(blank=True)
    justification = models.TextField(blank=True)
    date_validation = models.DateTimeField(null=True, blank=True)
    commentaire_validation = models.TextField(blank=True)
    motif_refus = models.TextField(blank=True)
    id_chef_demandeur = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.CASCADE,
        related_name="demandes_soumises",
    )
    id_service = models.ForeignKey("users.Service", on_delete=models.CASCADE)
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

    def save(self, *args, **kwargs):
        if not self.pk and not self.numero:
            year = timezone.localdate().year
            prefix = f"DEM-{year}-"
            last = (
                Demande.objects.filter(numero__startswith=prefix)
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

    def __str__(self):
        return f"Demande {self.numero or self.id_demande}"

    @property
    def lien_suivi(self):
        return reverse("demande-detail", kwargs={"pk": self.pk})


class LigneDemande(models.Model):
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
    id_ressource = models.ForeignKey("resources.Ressource", on_delete=models.CASCADE)

    class Meta:
        verbose_name = "ligne de demande"
        verbose_name_plural = "lignes de demande"

    def __str__(self):
        return f"Ligne {self.id_ligne} - {self.id_ressource}"