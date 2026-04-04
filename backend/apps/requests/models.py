from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.urls import reverse


class Demande(models.Model):
    URGENCE_CHOICES = [
        ("normal", "normal"),
        ("moyen", "moyen"),
        ("urgent", "urgent"),
    ]
    STATUT_CHOICES = [
        ("en_cours", "en_cours"),
        ("validee", "validee"),
        ("en_preparation", "en_preparation"),
        ("complete_avec_decharge", "complete_avec_decharge"),
        ("partielle", "partielle"),
        ("refusee", "refusee"),
    ]

    id_demande = models.AutoField(primary_key=True)
    date_demande = models.DateTimeField(auto_now_add=True)
    urgence = models.CharField(max_length=10, choices=URGENCE_CHOICES, default="normal")
    statut = models.CharField(max_length=30, choices=STATUT_CHOICES, default="en_cours")
    justification = models.TextField(blank=True)
    date_validation = models.DateTimeField(null=True, blank=True)
    commentaire_validation = models.TextField(blank=True)
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

    def __str__(self):
        return f"Demande {self.id_demande}"

    @property
    def lien_suivi(self):
        return reverse("demande-detail", kwargs={"pk": self.pk})


class LigneDemande(models.Model):
    id_ligne = models.AutoField(primary_key=True)
    quantite_demandee = models.IntegerField()
    quantite_accordee = models.IntegerField(default=0)
    disponibilite_pct = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
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