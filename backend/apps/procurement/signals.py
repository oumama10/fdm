from datetime import date

from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.procurement.models import ImportExcelBC, LotArticle, StagingItem
from apps.resources.models import InstanceRessource, MouvementStock, Stock


def generate_numero_inventaire():
    """
    Format : INV-{YY}-{XXXX}
    Exemple : INV-26-0001, INV-26-0042
    YY   = 2 derniers chiffres de l'annee courante
    XXXX = sequence sur 4 chiffres, reset chaque annee
    """
    current_year = date.today().year
    yy = str(current_year)[-2:]

    count = InstanceRessource.objects.filter(
        numero_inventaire__startswith=f"INV-{yy}-"
    ).count()
    sequence = str(count + 1).zfill(4)
    return f"INV-{yy}-{sequence}"


@receiver(post_save, sender=StagingItem)
def on_staging_approuve(sender, instance, **kwargs):
    if getattr(instance, '_skip_stock_signal', False):
        return

    if instance.statut != "approuve" or not instance.id_ressource_liee_id:
        return

    ressource = instance.id_ressource_liee
    import_obj = instance.id_import
    marche = import_obj.id_marche

    # Determine or create the lot
    lot, _ = LotArticle.objects.get_or_create(
        id_marche=marche,
        id_ressource=ressource,
        defaults={
            "numero_lot": (
                LotArticle.objects.filter(id_marche=marche).count() + 1
            ),
            "designation": instance.designation_normalisee or instance.designation_brute,
            "quantite_commandee": instance.quantite,
            "quantite_recue": instance.quantite,
        },
    )

    if ressource.is_consommable:
        stock, _ = Stock.objects.get_or_create(id_ressource=ressource)
        Stock.objects.filter(pk=stock.pk).update(
            quantite_disponible=F("quantite_disponible") + instance.quantite
        )
        MouvementStock.objects.create(
            type_mouvement="entree",
            quantite=instance.quantite,
            id_ressource=ressource,
        )
    else:
        # Bien inventaire: one InstanceRessource per unit
        acquisition_date = marche.date_creation or marche.date_livraison_prevue
        instances = []
        for i in range(instance.quantite):
            instances.append(
                InstanceRessource(
                    id_ressource=ressource,
                    id_lot=lot,
                    numero_inventaire=generate_numero_inventaire(),
                    date_acquisition=acquisition_date,
                    statut="en_stock",
                    etat="neuf",
                )
            )
        InstanceRessource.objects.bulk_create(instances)
        MouvementStock.objects.create(
            type_mouvement="entree",
            quantite=instance.quantite,
            id_ressource=ressource,
        )

    # Mark import as validated if all staging items are approved
    all_approved = not StagingItem.objects.filter(
        id_import=import_obj
    ).exclude(statut="approuve").exists()
    if all_approved:
        ImportExcelBC.objects.filter(pk=import_obj.pk).update(
            statut_import="valide"
        )
        if import_obj.id_marche_id:
            marche.statut = "receptionne_et_stocke"
            marche.save(update_fields=["statut"])
