from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import SoftDeleteModel, TimestampedModel

UNITE_MESURE_CHOICES = [
    ("unite", "Unité"),
    ("kg", "Kilogramme"),
    ("litre", "Litre"),
    ("boite", "Boîte"),
    ("ramette", "Ramette"),
    ("autre", "Autre"),
]

_UNITE_NORMALISATION = {
    "u": "unite", "unité": "unite", "unite": "unite", "pièce": "unite",
    "piece": "unite", "pcs": "unite",
    "kg": "kg", "kilogram": "kg", "kilo": "kg", "kilogramme": "kg",
    "litre": "litre", "l": "litre", "liter": "litre", "litres": "litre",
    "boite": "boite", "boîte": "boite", "box": "boite",
    "ramette": "ramette",
}


def normalize_unite_mesure(raw: str) -> str:
    return _UNITE_NORMALISATION.get((raw or "").strip().lower(), "autre")


class TypeArticle(models.Model):
    TYPE_CHOICES = [
        ("consommable", "Consommable"),
        ("bien_inventaire", "Bien Inventaire"),
    ]

    id_type_article = models.AutoField(primary_key=True)
    nom_categorie = models.CharField(max_length=200, choices=TYPE_CHOICES)
    description = models.TextField(blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = "type article"
        verbose_name_plural = "types article"

    def __str__(self):
        return self.get_nom_categorie_display()


class Categorie(SoftDeleteModel):
    id_categorie = models.AutoField(primary_key=True)
    nom_categorie = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    id_type = models.ForeignKey(TypeArticle, on_delete=models.CASCADE)

    class Meta:
        verbose_name = "categorie"
        verbose_name_plural = "categories"

    def __str__(self):
        return self.nom_categorie


class SousCategorie(SoftDeleteModel):
    id_sous_categorie = models.AutoField(primary_key=True)
    nom_sous_categorie = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    id_categorie = models.ForeignKey(Categorie, on_delete=models.CASCADE)

    class Meta:
        verbose_name = "sous-categorie"
        verbose_name_plural = "sous-categories"

    def __str__(self):
        return self.nom_sous_categorie


class Ressource(SoftDeleteModel):
    id_ressource = models.AutoField(primary_key=True)
    designation = models.CharField(max_length=255)
    marque = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True)
    unite_mesure = models.CharField(max_length=20, choices=UNITE_MESURE_CHOICES, default="unite")
    id_type = models.ForeignKey(TypeArticle, on_delete=models.CASCADE)
    id_categorie = models.ForeignKey(
        Categorie,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    id_sous_categorie = models.ForeignKey(
        SousCategorie,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "ressource"
        verbose_name_plural = "ressources"
        indexes = [
            models.Index(fields=["id_type", "actif"], name="ressource_id_type_actif_idx"),
            models.Index(fields=["id_categorie", "id_sous_categorie"], name="ressource_id_cat_id_scat_idx"),
        ]

    def __str__(self):
        return self.designation

    @property
    def is_consommable(self):
        return bool(self.id_type and self.id_type.nom_categorie == "consommable")

    @property
    def is_bien_inventaire(self):
        return not self.is_consommable

    @property
    def est_en_alerte(self):
        if not self.is_consommable:
            return False
        try:
            stock = self.stock
        except Exception:
            return False
        if stock.seuil_alerte is None:
            return False
        return stock.quantite_disponible <= stock.seuil_alerte


class Stock(TimestampedModel):
    id_stock = models.AutoField(primary_key=True)
    id_ressource = models.OneToOneField(Ressource, on_delete=models.CASCADE)
    quantite_disponible = models.IntegerField(default=0)
    quantite_reservee = models.IntegerField(default=0)
    seuil_alerte = models.IntegerField(null=True, blank=True, default=None)

    class Meta:
        verbose_name = "stock"
        verbose_name_plural = "stocks"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantite_disponible__gte=0),
                name="stock_quantite_disponible_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(quantite_reservee__lte=models.F("quantite_disponible")),
                name="stock_quantite_reservee_lte_disponible",
            ),
        ]

    def __str__(self):
        return f"Stock {self.id_ressource}"

    @property
    def quantite_reelle(self):
        return self.quantite_disponible - self.quantite_reservee

    @property
    def est_en_alerte(self):
        if self.seuil_alerte is None:
            return False
        return self.quantite_disponible <= self.seuil_alerte

    def clean(self):
        super().clean()
        if self.id_ressource and self.id_ressource.is_bien_inventaire:
            raise ValidationError(
                {"id_ressource": "Le stock est reserve aux ressources consommables."}
            )


class InstanceRessource(TimestampedModel):
    STATUT_CHOICES = [
        ("en_stock",       "en_stock"),
        ("en_service",     "en_service"),
        ("en_maintenance", "en_maintenance"),
        ("debarras",       "debarras"),
    ]
    ETAT_CHOICES = [
        ("neuf", "neuf"),
        ("bon_etat", "bon_etat"),
        ("endommage", "endommage"),
        ("hors_service", "hors_service"),
        ("retourne", "retourne"),
    ]
    TYPE_AFFECTATION_CHOICES = [
        ("nouvelle_affectation", "Nouvelle Affectation"),
        ("reaffectation", "Réaffectation"),
    ]

    id_instance = models.AutoField(primary_key=True)
    numero_inventaire = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        help_text="Auto-generated in format INV-{YYYY}-{XXXX} if omitted",
    )
    date_acquisition = models.DateField(null=True, blank=True)
    valeur_acquisition = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    statut = models.CharField(max_length=50, choices=STATUT_CHOICES, default="en_stock", db_index=True)
    etat = models.CharField(max_length=50, choices=ETAT_CHOICES, default="neuf", db_index=True)
    date_derniere_affectation = models.DateField(null=True, blank=True)
    observation = models.TextField(blank=True)
    type_affectation = models.CharField(
        max_length=30,
        choices=TYPE_AFFECTATION_CHOICES,
        blank=True,
        default="",
    )
    id_ressource = models.ForeignKey(Ressource, on_delete=models.CASCADE)
    id_lieu_affectation = models.ForeignKey(
        "users.Etablissement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instances_affectees",
    )
    id_service_actuel = models.ForeignKey(
        "users.Service",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    id_destinataire = models.ForeignKey(
        "users.Beneficiaire",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    id_lot = models.ForeignKey(
        "procurement.LotArticle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="instances",
    )

    class Meta:
        verbose_name = "instance ressource"
        verbose_name_plural = "instances ressource"
        indexes = [
            models.Index(fields=["statut", "id_ressource"], name="instres_statut_res_idx"),
            models.Index(fields=["id_service_actuel", "statut"], name="instres_svc_statut_idx"),
        ]

    def __str__(self):
        return self.numero_inventaire

    def clean(self):
        super().clean()
        if self.id_ressource and self.id_ressource.is_consommable:
            raise ValidationError(
                {"id_ressource": "Une instance ne peut etre creee que pour un bien inventaire."}
            )


class MouvementStock(models.Model):
    TYPE_MOUVEMENT_CHOICES = [
        ("entree", "entree"),
        ("sortie", "sortie"),
        ("retour", "retour"),
        ("transfert", "transfert"),
        ("rebut", "rebut"),
    ]

    id_mouvement = models.AutoField(primary_key=True)
    type_mouvement = models.CharField(max_length=50, choices=TYPE_MOUVEMENT_CHOICES)
    quantite = models.PositiveIntegerField()
    date_mouvement = models.DateTimeField(auto_now_add=True)
    observation = models.TextField(blank=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    source = GenericForeignKey("content_type", "object_id")
    id_ressource = models.ForeignKey(Ressource, on_delete=models.CASCADE)
    id_instance_ressource = models.ForeignKey(
        InstanceRessource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    id_utilisateur = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "mouvement de stock"
        verbose_name_plural = "mouvements de stock"
        indexes = [
            models.Index(fields=["id_ressource", "date_mouvement"], name="mouvementstock_res_date_idx"),
            models.Index(fields=["content_type", "object_id"], name="mouvementstock_ct_objid_idx"),
        ]

    def __str__(self):
        return f"{self.type_mouvement} - {self.id_ressource}"

    def save(self, *args, **kwargs):
        if self.date_mouvement and timezone.is_naive(self.date_mouvement):
            self.date_mouvement = timezone.make_aware(self.date_mouvement)
        super().save(*args, **kwargs)
