from datetime import timedelta

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class MarcheBC(models.Model):
    TYPE_ACQUISITION_CHOICES = [
        ("marche", "marche"),
        ("bon_commande", "bon_commande"),
        ("donation", "donation"),
    ]
    STATUT_CHOICES = [
        ("en_attente_livraison", "en attente de livraison"),
        ("receptionne_et_stocke", "Réception et stockée"),
        ("refuse", "refus (motif)"),
    ]
    DELAIS_PAR_TYPE = {
        "marche": 90,
        "bon_commande": None,  # variable — from extraction or manual input
        "donation": 0,
    }

    SOURCE_CHOICES = [
        ("manuel", "manuel"),
        ("import", "import"),
    ]

    id_marche = models.AutoField(primary_key=True)
    reference = models.CharField(max_length=100, unique=True)
    type_acquisition = models.CharField(max_length=20, choices=TYPE_ACQUISITION_CHOICES)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default="manuel", db_index=True)
    date_creation = models.DateField(auto_now_add=True)
    date_attribution = models.DateField(null=True, blank=True)
    marque = models.CharField(max_length=255, blank=True, default="")
    comite_conformite = models.TextField(blank=True, default="")
    delai_reception_jours = models.IntegerField(null=True, blank=True)
    date_livraison_prevue = models.DateField(null=True, blank=True)
    statut = models.CharField(
        max_length=30,
        choices=STATUT_CHOICES,
        default="en_attente_livraison",
        db_index=True,
    )
    motif_rejet = models.TextField(blank=True, default="")
    fichier_cps = models.FileField(upload_to="marches/cps/", blank=True, null=True)
    type_donateur = models.CharField(max_length=50, blank=True, default="")
    nom_donateur = models.CharField(max_length=255, blank=True, default="")
    organisme_donateur = models.CharField(max_length=255, blank=True, default="")
    contact_donateur = models.CharField(max_length=255, blank=True, default="")
    id_fournisseur = models.ForeignKey(
        "users.Fournisseur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    id_cree_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "marche ou bon de commande"
        verbose_name_plural = "marches et bons de commande"

    def __str__(self):
        return self.reference

    def save(self, *args, **kwargs):
        if self.type_acquisition == "marche":
            self.delai_reception_jours = 90
        elif self.type_acquisition == "donation":
            self.delai_reception_jours = 0
        # bon_commande: use the assigned delai_reception_jours (from extraction or manual)
        # No hardcoded fallback — it stays None if not provided
        
        base_date = self.date_attribution or self.date_creation or timezone.localdate()
        if self.delai_reception_jours is not None:
            self.date_livraison_prevue = base_date + timedelta(days=self.delai_reception_jours)
        super().save(*args, **kwargs)
        if is_creation:
            MarcheEtape.create_default_etapes(self)


class MarcheEtape(models.Model):
    NOM_ETAPE_CHOICES = [
        ("marche_cree", "marche_cree"),
        ("contrat_signe", "contrat_signe"),
        ("en_attente_livraison", "en_attente_livraison"),
        ("livraison_en_cours", "livraison_en_cours"),
        ("receptionne_magasin", "receptionne_magasin"),
        ("controle_qualite", "controle_qualite"),
        ("bl_valide", "bl_valide"),
        ("stocker_au_magasin", "stocker_au_magasin"),
        ("paiement_en_cours", "paiement_en_cours"),
        ("paiement_effectue", "paiement_effectue"),
    ]
    STATUT_CHOICES = [
        ("en_attente", "en_attente"),
        ("en_cours", "en_cours"),
        ("complete", "complete"),
        ("bloque", "bloque"),
    ]

    id_etape = models.AutoField(primary_key=True)
    ordre = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    nom_etape = models.CharField(max_length=30, choices=NOM_ETAPE_CHOICES)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="en_attente")
    date_debut = models.DateTimeField(null=True, blank=True)
    date_fin = models.DateTimeField(null=True, blank=True)
    commentaire = models.TextField(blank=True)
    id_marche = models.ForeignKey(MarcheBC, on_delete=models.CASCADE, related_name="etapes")
    id_modifie_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["ordre"]
        verbose_name = "etape de marche"
        verbose_name_plural = "etapes de marche"

    def __str__(self):
        return f"{self.id_marche} - {self.nom_etape}"

    @classmethod
    def create_default_etapes(cls, marche):
        default_etapes = [
            (1, "marche_cree"),
<<<<<<< HEAD
            (2, "contrat_signe"),
            (3, "en_attente_livraison"),
            (4, "livraison_en_cours"),
            (5, "receptionne_magasin"),
            (6, "controle_qualite"),
            (7, "bl_valide"),
        ]
        now = timezone.now()
        etapes = []
        for ordre, nom_etape in default_etapes:
            etapes.append(
                cls(
                    ordre=ordre,
                    nom_etape=nom_etape,
                    statut="complete" if ordre == 1 else "en_attente",
                    date_debut=now if ordre == 1 else None,
                    date_fin=now if ordre == 1 else None,
                    id_marche=marche,
                )
            )
        cls.objects.bulk_create(etapes)


class ImportExcelBC(models.Model):
    STATUT_IMPORT_CHOICES = [
        ("en_attente", "en_attente"),
        ("brouillon", "brouillon"),
        ("en_revision", "en_revision"),
        ("valide", "valide"),
        ("non_conforme", "non_conforme"),
        ("autre", "autre"),
        ("rejete", "rejete"),
    ]
    SOURCE_TYPE_CHOICES = [
        ("bc", "bc"),
        ("marche", "marche"),
        ("donation", "donation"),
    ]
    FILE_TYPE_CHOICES = [
        ("xlsx", "Excel"),
        ("pdf", "PDF"),
    ]

    id_import = models.AutoField(primary_key=True)
    fichier_excel_original = models.FileField(upload_to="marches/uploads/")
    titre_fichier = models.CharField(max_length=255, blank=True, default="")
    date_import = models.DateTimeField(auto_now_add=True)
    reference_document = models.CharField(max_length=150, blank=True, default="")
    fournisseur_denomination = models.CharField(max_length=255, blank=True, default="")
    fournisseur_telephone = models.CharField(max_length=50, blank=True, default="")
    fournisseur_email = models.EmailField(blank=True, default="")
    fournisseur_adresse = models.TextField(blank=True, default="")
    delai_execution = models.CharField(max_length=255, blank=True, default="")
    statut_import = models.CharField(
        max_length=20,
        choices=STATUT_IMPORT_CHOICES,
        default="brouillon",
        db_index=True,
    )
    file_type = models.CharField(
        max_length=10,
        choices=FILE_TYPE_CHOICES,
        default="xlsx",
    )
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES)
    observations = models.TextField(blank=True)
    id_marche = models.OneToOneField(
        MarcheBC,
        on_delete=models.CASCADE,
        related_name="import_excel",
    )
    id_importe_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "import excel"
        verbose_name_plural = "imports excel"

    def __str__(self):
        return f"Import {self.id_import}"


class StagingItem(models.Model):
    TYPE_DETECTE_CHOICES = [
        ("", ""),
        ("consommable", "consommable"),
        ("bien_inventaire", "bien_inventaire"),
    ]
    STATUT_CHOICES = [
        ("en_attente", "en_attente"),
        ("approuve", "approuve"),
        ("rejete", "rejete"),
        ("modifie", "modifie"),
    ]

    id_staging = models.AutoField(primary_key=True)
    designation_brute = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    designation_normalisee = models.CharField(max_length=255, blank=True)
    quantite = models.IntegerField(default=0)
    type_detecte = models.CharField(max_length=20, choices=TYPE_DETECTE_CHOICES, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="en_attente", db_index=True)
    correction_gestionnaire = models.TextField(blank=True)
    motif_rejet = models.CharField(max_length=255, blank=True, default="")
    commentaire_rejet = models.TextField(blank=True, default="")
    prix_unitaire_ht = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    prix_total_ht = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    unite = models.CharField(max_length=20, blank=True, default="U")
    id_import = models.ForeignKey(
        ImportExcelBC,
        on_delete=models.CASCADE,
        related_name="staging_items",
    )
    id_categorie_suggeree = models.ForeignKey(
        "resources.Categorie",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    id_sous_categorie_suggeree = models.ForeignKey(
        "resources.SousCategorie",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staging_items",
    )
    id_ressource_liee = models.ForeignKey(
        "resources.Ressource",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "element de staging"
        verbose_name_plural = "elements de staging"

    def __str__(self):
        return self.designation_brute

    @property
    def needs_review(self):
        return self.statut == "en_attente"


class LotArticle(models.Model):
    id_lot = models.AutoField(primary_key=True)
    numero_lot = models.IntegerField()
    designation = models.CharField(max_length=255)
    quantite_commandee = models.IntegerField()
    quantite_recue = models.IntegerField(default=0)
    observation = models.TextField(blank=True)
    id_marche = models.ForeignKey(MarcheBC, on_delete=models.CASCADE, related_name="lots")
    id_ressource = models.ForeignKey("resources.Ressource", on_delete=models.CASCADE)

    class Meta:
        unique_together = ("id_marche", "numero_lot")
        verbose_name = "lot d'article"
        verbose_name_plural = "lots d'articles"

    def __str__(self):
        return f"Lot {self.numero_lot} - {self.designation}"