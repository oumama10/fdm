from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models


class Categorie(models.Model):
    CATEGORIE_CHOICES = [
        ("Consommable", "Consommable"),
        ("Bien Inventaire", "Bien Inventaire"),
    ]

    id_categorie = models.AutoField(primary_key=True)
    nom_categorie = models.CharField(max_length=200, choices=CATEGORIE_CHOICES)
    description = models.TextField(blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = "categorie"
        verbose_name_plural = "categories"

    def __str__(self):
        return self.nom_categorie


class SousCategorie(models.Model):
    id_sous_categorie = models.AutoField(primary_key=True)
    nom_sous_categorie = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    id_categorie = models.ForeignKey(Categorie, on_delete=models.CASCADE)

    class Meta:
        verbose_name = "sous-categorie"
        verbose_name_plural = "sous-categories"

    def __str__(self):
        return self.nom_sous_categorie


class Ressource(models.Model):
    id_ressource = models.AutoField(primary_key=True)
    designation = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unite_mesure = models.CharField(max_length=20, default="unité")
    id_categorie = models.ForeignKey(Categorie, on_delete=models.CASCADE)
    id_sous_categorie = models.ForeignKey(
        SousCategorie,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "ressource"
        verbose_name_plural = "ressources"

    def __str__(self):
        return self.designation

    @property
    def is_consommable(self):
        return bool(
            self.id_categorie and self.id_categorie.nom_categorie == "Consommable"
        )

    @property
    def is_bien_inventaire(self):
        return not self.is_consommable


class Stock(models.Model):
    id_stock = models.AutoField(primary_key=True)
    id_ressource = models.OneToOneField(Ressource, on_delete=models.CASCADE)
    quantite_disponible = models.IntegerField(default=0)
    quantite_reservee = models.IntegerField(default=0)
    seuil_alerte = models.IntegerField(default=5)
    date_mise_a_jour = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "stock"
        verbose_name_plural = "stocks"

    def __str__(self):
        return f"Stock {self.id_ressource}"

    @property
    def quantite_reelle(self):
        return self.quantite_disponible - self.quantite_reservee

    def clean(self):
        super().clean()
        if self.id_ressource and self.id_ressource.is_bien_inventaire:
            raise ValidationError(
                {"id_ressource": "Le stock est reserve aux ressources consommables."}
            )


class InstanceRessource(models.Model):
    STATUT_CHOICES = [
        ("en_stock", "en_stock"),
        ("en_service", "en_service"),
        ("en_maintenance", "en_maintenance"),
        ("hors_service", "hors_service"),
        ("retire", "retire"),
    ]
    ETAT_CHOICES = [
        ("neuf", "neuf"),
        ("bon_etat", "bon_etat"),
        ("usage_normal", "usage_normal"),
        ("endommage", "endommage"),
        ("hors_service", "hors_service"),
    ]

    id_instance = models.AutoField(primary_key=True)
    numero_inventaire = models.CharField(max_length=50, unique=True)
    date_acquisition = models.DateField(null=True, blank=True)
    valeur_acquisition = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    statut = models.CharField(max_length=50, choices=STATUT_CHOICES, default="en_stock")
    etat = models.CharField(max_length=50, choices=ETAT_CHOICES, default="neuf")
    localisation_actuelle = models.CharField(max_length=200, blank=True)
    date_derniere_affectation = models.DateField(null=True, blank=True)
    observation = models.TextField(blank=True)
    id_ressource = models.ForeignKey(Ressource, on_delete=models.CASCADE)
    id_service_actuel = models.ForeignKey(
        "users.Service",
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
    quantite = models.IntegerField()
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

    def __str__(self):
        return f"{self.type_mouvement} - {self.id_ressource}"