from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.core.models import TimestampedModel
from django.db.models import Q
from django.utils import timezone


class Decharge(TimestampedModel):
    STATUT_CHOICES = [
        ("generee", "Générée"),
        ("en_attente_signature", "En attente de signature"),
        ("signee", "Signée"),
        ("livree", "Livrée"),
    ]

    id_decharge = models.AutoField(primary_key=True)
    numero_decharge = models.CharField(max_length=50, unique=True)
    statut = models.CharField(
        max_length=30,
        choices=STATUT_CHOICES,
        default="generee",
        db_index=True,
    )
    date_generation = models.DateTimeField(auto_now_add=True)
    date_livraison = models.DateField(null=True, blank=True)
    fichier_pdf = models.FileField(upload_to="decharges/pdf/", null=True, blank=True)
    observation = models.TextField(blank=True)
    id_demande = models.OneToOneField(
        "requests.Demande",
        on_delete=models.CASCADE,
        related_name="decharge",
    )
    id_genere_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="decharges_generees",
    )
    id_livre_a = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="decharges_livrees",
    )

    class Meta:
        verbose_name = "decharge"
        verbose_name_plural = "decharges"

    def __str__(self):
        return self.numero_decharge

    @property
    def statut_signature(self):
        try:
            return self.signature.statut
        except SignatureDecharge.DoesNotExist:
            return "non_generee"

    def save(self, *args, **kwargs):
        if not self.numero_decharge:
            current_year = timezone.localdate().year
            prefix = f"DCH-{current_year}-"
            with transaction.atomic():
                last_decharge = (
                    Decharge.objects.select_for_update()
                    .filter(numero_decharge__startswith=prefix)
                    .order_by("-numero_decharge")
                    .first()
                )
                next_sequence = 1
                if last_decharge:
                    next_sequence = int(last_decharge.numero_decharge.split("-")[-1]) + 1
                self.numero_decharge = f"{prefix}{next_sequence:04d}"
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)


class LigneDecharge(TimestampedModel):
    TYPE_LIGNE_CHOICES = [
        ("bien_inventaire", "bien_inventaire"),
        ("consommable", "consommable"),
    ]

    id_ligne_decharge = models.AutoField(primary_key=True)
    quantite = models.IntegerField()
    type_ligne = models.CharField(max_length=20, choices=TYPE_LIGNE_CHOICES)
    observation = models.TextField(blank=True)
    id_decharge = models.ForeignKey(
        Decharge,
        on_delete=models.CASCADE,
        related_name="lignes",
    )
    id_ressource = models.ForeignKey("resources.Ressource", on_delete=models.CASCADE)
    id_instance_ressource = models.ForeignKey(
        "resources.InstanceRessource",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "ligne de decharge"
        verbose_name_plural = "lignes de decharge"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(type_ligne="bien_inventaire", id_instance_ressource__isnull=False)
                    | Q(type_ligne="consommable", id_instance_ressource__isnull=True)
                ),
                name="decharge_instance_required_by_type",
            ),
        ]

    def __str__(self):
        return f"Ligne {self.id_ligne_decharge} - {self.id_ressource}"

    def clean(self):
        super().clean()
        if self.type_ligne == "bien_inventaire" and self.id_instance_ressource is None:
            raise ValidationError(
                {"id_instance_ressource": "Une ligne de bien inventaire doit reference une instance de ressource."}
            )
        if self.type_ligne == "consommable" and self.id_instance_ressource is not None:
            raise ValidationError(
                {"id_instance_ressource": "Une ligne de consommable ne doit pas reference une instance de ressource."}
            )


class SignatureDecharge(TimestampedModel):
    STATUT_CHOICES = [
        ("non_signe", "non_signe"),
        ("signe", "signe"),
    ]

    id_signature = models.AutoField(primary_key=True)
    date_signature = models.DateTimeField(null=True, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="non_signe")
    date_validation_systeme = models.DateTimeField(null=True, blank=True)
    id_decharge = models.OneToOneField(
        Decharge,
        on_delete=models.CASCADE,
        related_name="signature",
    )
    id_chef_service = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signatures_soumises",
    )
    id_valide_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signatures_validees",
    )

    class Meta:
        verbose_name = "signature de decharge"
        verbose_name_plural = "signatures de decharge"

    def __str__(self):
        return f"Signature {self.id_signature} - {self.id_decharge}"