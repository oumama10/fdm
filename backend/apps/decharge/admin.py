from django.contrib import admin

from .models import Decharge, LigneDecharge, SignatureDecharge


class LigneDechargeInline(admin.TabularInline):
    model = LigneDecharge
    extra = 0
    fields = ["id_ressource", "id_instance_ressource", "type_ligne", "quantite", "observation"]


@admin.register(Decharge)
class DechargeAdmin(admin.ModelAdmin):
    list_display = ["numero_decharge", "id_demande", "statut_signature", "date_generation"]
    search_fields = ["numero_decharge"]
    inlines = [LigneDechargeInline]
    readonly_fields = ["numero_decharge", "date_generation", "statut_signature"]


@admin.register(SignatureDecharge)
class SignatureDechargeAdmin(admin.ModelAdmin):
    list_display = ["id_decharge", "statut", "date_signature", "id_chef_service"]
    list_filter = ["statut"]


@admin.register(LigneDecharge)
class LigneDechargeAdmin(admin.ModelAdmin):
    list_display = ["id_ligne_decharge", "id_decharge", "id_ressource", "type_ligne", "quantite"]
    list_filter = ["type_ligne"]
