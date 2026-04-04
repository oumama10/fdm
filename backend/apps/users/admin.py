from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Fournisseur, Role, RolePermission, Service, Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    list_display = ["email", "nom_complet", "id_role", "id_service", "actif"]
    list_filter = ["id_role", "id_service", "actif"]
    search_fields = ["email", "nom_complet"]
    ordering = ["email"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Informations personnelles", {"fields": ("nom_complet", "titre_poste")}),
        ("Affectation", {"fields": ("id_role", "id_service")}),
        ("Permissions", {"fields": ("actif", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_creation")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "nom_complet", "password1", "password2"),
        }),
    )
    readonly_fields = ["date_creation", "last_login"]
    # UserAdmin expects USERNAME_FIELD
    USERNAME_FIELD = "email"


@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ["nom_societe", "email", "evaluation", "id_utilisateur"]
    search_fields = ["nom_societe", "email"]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["nom_service", "type_service"]
    list_filter = ["type_service"]
    search_fields = ["nom_service"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["nom_role", "description"]


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ["id_role", "id_permission", "accorde"]
    list_filter = ["accorde"]
