from django.contrib import admin

from .models import ImportExcelBC, LotArticle, MarcheBC, MarcheEtape, StagingItem


class MarcheEtapeInline(admin.TabularInline):
    model = MarcheEtape
    extra = 0
    fields = ["ordre", "nom_etape", "statut", "date_debut", "date_fin"]
    ordering = ["ordre"]


@admin.register(MarcheBC)
class MarcheBCAdmin(admin.ModelAdmin):
    list_display = ["reference", "type_acquisition", "statut", "date_livraison_prevue", "id_fournisseur"]
    list_filter = ["type_acquisition", "statut"]
    search_fields = ["reference"]
    inlines = [MarcheEtapeInline]


@admin.register(ImportExcelBC)
class ImportExcelBCAdmin(admin.ModelAdmin):
    list_display = ["id_import", "titre_fichier", "id_marche", "statut_import", "source_type", "date_import"]
    list_filter = ["statut_import", "source_type"]


@admin.register(StagingItem)
class StagingItemAdmin(admin.ModelAdmin):
    list_display = ["designation_brute", "description", "designation_normalisee", "quantite", "statut"]
    list_filter = ["statut", "type_detecte"]
    search_fields = ["designation_brute", "designation_normalisee"]


@admin.register(LotArticle)
class LotArticleAdmin(admin.ModelAdmin):
    list_display = ["numero_lot", "designation", "id_marche", "quantite_commandee", "quantite_recue"]
    list_filter = ["id_marche"]
    search_fields = ["designation"]
