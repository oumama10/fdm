from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.procurement.models import ImportExcelBC, LotArticle, StagingItem
from apps.resources.models import InstanceRessource, MouvementStock, Stock


@receiver(post_save, sender=StagingItem)
def on_staging_approuve(sender, instance, **kwargs):
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
        existing_count = InstanceRessource.objects.filter(
            id_ressource=ressource
        ).count()
        instances = []
        for i in range(instance.quantite):
            sequence = existing_count + i + 1
            instances.append(
                InstanceRessource(
                    id_ressource=ressource,
                    id_lot=lot,
                    numero_inventaire=f"INV-{ressource.pk}-{sequence:04d}",
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
