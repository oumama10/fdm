from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class Role(models.Model):
    ROLE_CHOICES = [
        ("service_financiere", "service_financiere"),
        ("gestionnaire_magasin", "gestionnaire_magasin"),
        ("chef_service", "chef_service"),
        ("admin", "admin"),
    ]

    id_role = models.AutoField(primary_key=True)
    nom_role = models.CharField(max_length=100, unique=True, choices=ROLE_CHOICES)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name = "role"
        verbose_name_plural = "roles"

    def __str__(self):
        return self.nom_role


class Permission(models.Model):
    id_permission = models.AutoField(primary_key=True)
    module = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        unique_together = ("module", "action")
        verbose_name = "permission"
        verbose_name_plural = "permissions"

    def __str__(self):
        return f"{self.module} - {self.action}"


class RolePermission(models.Model):
    id_role = models.ForeignKey(Role, on_delete=models.CASCADE)
    id_permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    accorde = models.BooleanField(default=True)

    class Meta:
        unique_together = ("id_role", "id_permission")
        verbose_name = "permission de role"
        verbose_name_plural = "permissions de role"

    def __str__(self):
        return f"{self.id_role} - {self.id_permission}"


class Etablissement(models.Model):
    id_etablissement = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=200, unique=True)

    class Meta:
        verbose_name = "établissement"
        verbose_name_plural = "établissements"

    def __str__(self):
        return self.nom


class Batiment(models.Model):
    id_batiment = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=200)
    id_etablissement = models.ForeignKey(
        Etablissement, on_delete=models.CASCADE, related_name="batiments"
    )

    class Meta:
        verbose_name = "bâtiment"
        verbose_name_plural = "bâtiments"
        unique_together = ("nom", "id_etablissement")

    def __str__(self):
        return f"{self.nom} ({self.id_etablissement.nom})"


class Service(models.Model):
    TYPE_SERVICE_CHOICES = [
        ("administratif", "administratif"),
        ("chu", "chu"),
        ("decanat", "decanat"),
        ("pharmacie", "pharmacie"),
        ("dentaire", "dentaire"),
        ("labo", "labo"),
        ("association", "association"),
    ]

    id_service = models.AutoField(primary_key=True)
    nom_service = models.CharField(max_length=200)
    type_service = models.CharField(max_length=100, choices=TYPE_SERVICE_CHOICES)
    description = models.TextField(blank=True)
    lettre_nomination_chef = models.FileField(
        upload_to="services/nominations/",
        blank=True,
        null=True,
    )
    id_batiment = models.ForeignKey(
        Batiment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services",
    )

    class Meta:
        verbose_name = "service"
        verbose_name_plural = "services"

    def __str__(self):
        return self.nom_service


class Beneficiaire(models.Model):
    ROLE_CHOICES = [
        ("chef_service", "Chef de Service"),
        ("fonctionnaire", "Fonctionnaire"),
        ("secretariat", "Secrétariat"),
        ("salle_de_cours", "Salle de cours"),
        ("prof", "Prof"),
        ("personnel", "Personnel"),
    ]

    id_beneficiaire = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=200)
    role_type = models.CharField(max_length=30, choices=ROLE_CHOICES)
    id_service = models.ForeignKey(
        Service, on_delete=models.CASCADE, related_name="beneficiaires"
    )

    class Meta:
        verbose_name = "bénéficiaire"
        verbose_name_plural = "bénéficiaires"

    def __str__(self):
        return f"{self.nom} ({self.get_role_type_display()})"


class UtilisateurManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'adresse email est obligatoire.")
        nom_complet = extra_fields.pop("nom_complet", None)
        if not nom_complet:
            raise ValueError("Le nom complet est obligatoire.")
        email = self.normalize_email(email)
        user = self.model(email=email, nom_complet=nom_complet, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("actif", True)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Le superutilisateur doit avoir is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Le superutilisateur doit avoir is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    id_utilisateur = models.AutoField(primary_key=True)
    nom_complet = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    actif = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    titre_poste = models.CharField(max_length=100, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    id_role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    id_service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)

    objects = UtilisateurManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nom_complet"]

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self):
        return self.nom_complet

    @property
    def is_active(self):
        return self.actif

    @is_active.setter
    def is_active(self, value):
        self.actif = value

    def _has_role(self, role_name):
        return bool(self.id_role and self.id_role.nom_role == role_name)

    @property
    def is_gestionnaire(self):
        return self._has_role("gestionnaire_magasin")

    @property
    def is_chef_service(self):
        return self._has_role("chef_service")

    @property
    def is_financiere(self):
        return self._has_role("service_financiere")

    @property
    def is_fournisseur(self):
        return self._has_role("fournisseur")

    @property
    def is_admin(self):
        return self._has_role("admin")


class Fournisseur(models.Model):
    id_fournisseur = models.AutoField(primary_key=True)
    nom_societe = models.CharField(max_length=255)
    nom_responsable = models.CharField(max_length=200)
    email = models.EmailField()
    telephone = models.CharField(max_length=20, blank=True)
    adresse = models.TextField(blank=True)
    evaluation = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    id_utilisateur = models.OneToOneField(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fournisseur_profile",
    )

    class Meta:
        verbose_name = "fournisseur"
        verbose_name_plural = "fournisseurs"

    def __str__(self):
        return self.nom_societe
