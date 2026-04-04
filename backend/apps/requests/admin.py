from django.contrib import admin

from .models import Demande, LigneDemande


class LigneDemandeInline(admin.TabularInline):
    model = LigneDemande
    extra = 0
    fields = ["id_ressource", "quantite_demandee", "quantite_accordee", "disponibilite_pct", "observation"]


@admin.register(Demande)
class DemandeAdmin(admin.ModelAdmin):
    list_display = ["id_demande", "id_chef_demandeur", "id_service", "urgence", "statut", "date_demande"]
    list_filter = ["statut", "urgence"]
    search_fields = ["id_chef_demandeur__nom_complet", "id_chef_demandeur__email"]
    inlines = [LigneDemandeInline]


@admin.register(LigneDemande)
class LigneDemandeAdmin(admin.ModelAdmin):
    list_display = ["id_ligne", "id_demande", "id_ressource", "quantite_demandee", "quantite_accordee"]
