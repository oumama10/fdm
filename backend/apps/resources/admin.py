from django.contrib import admin

from .models import (
    Categorie,
    InstanceRessource,
    MouvementStock,
    Ressource,
    SousCategorie,
    Stock,
    TypeArticle,
)


@admin.register(TypeArticle)
class TypeArticleAdmin(admin.ModelAdmin):
    list_display = ["nom_categorie", "actif"]
    list_filter = ["actif"]


@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display = ["nom_categorie", "id_type", "actif"]
    list_filter = ["id_type", "actif"]
    search_fields = ["nom_categorie"]


@admin.register(SousCategorie)
class SousCategorieAdmin(admin.ModelAdmin):
    list_display = ["nom_sous_categorie", "id_categorie"]
    list_filter = ["id_categorie"]


@admin.register(Ressource)
class RessourceAdmin(admin.ModelAdmin):
    list_display = ["designation", "id_type", "id_categorie", "id_sous_categorie", "unite_mesure"]
    list_filter = ["id_type", "id_categorie"]
    search_fields = ["designation"]


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ["id_ressource", "quantite_disponible", "seuil_alerte", "updated_at"]
    search_fields = ["id_ressource__designation"]


@admin.register(InstanceRessource)
class InstanceRessourceAdmin(admin.ModelAdmin):
    list_display = ["numero_inventaire", "id_ressource", "statut", "etat", "id_service_actuel"]
    list_filter = ["statut", "etat"]
    search_fields = ["numero_inventaire", "id_ressource__designation"]


@admin.register(MouvementStock)
class MouvementStockAdmin(admin.ModelAdmin):
    list_display = ["type_mouvement", "id_ressource", "quantite", "date_mouvement", "id_utilisateur"]
    list_filter = ["type_mouvement"]
