from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.procurement.models import ImportExcelBC, LotArticle, MarcheBC, MarcheEtape, StagingItem


def _sync_marche_reference(marche, import_obj):
    """
    If MarcheBC was created with an auto-generated reference (IMPORT-* / MANUAL-*),
    replace it with the real reference extracted from the document.
    Silently skips on unique-constraint conflicts.
    """
    if not (marche and import_obj):
        return
    real_ref = (import_obj.reference_document or "").strip()
    if not real_ref:
        return
    if not marche.reference.startswith(("IMPORT-", "MANUAL-")):
        return
    if MarcheBC.objects.filter(reference=real_ref).exclude(pk=marche.pk).exists():
        return
    MarcheBC.objects.filter(pk=marche.pk).update(reference=real_ref)
    marche.reference = real_ref


def _find_or_create_ressource(instance):
    """Find or create a Ressource for a staging item. Returns None if cannot resolve."""
    from apps.resources.models import Categorie, Ressource

    ressource = instance.id_ressource_liee

    if ressource is None:
        nom = (instance.designation_normalisee or instance.designation_brute or "").strip()
        if nom:
            ressource = Ressource.objects.filter(designation__iexact=nom).first()
            if ressource:
                StagingItem.objects.filter(pk=instance.pk).update(id_ressource_liee=ressource)

    if ressource is None:
        nom = (instance.designation_normalisee or instance.designation_brute or "").strip()
        type_detecte = instance.type_detecte
        if nom and type_detecte in ("consommable", "bien_inventaire"):
            categorie = instance.id_categorie_suggeree
            if not categorie:
                cat_name = "Consommable" if type_detecte == "consommable" else "Bien Inventaire"
                categorie = Categorie.objects.filter(nom_categorie=cat_name).first()
            if categorie:
                ressource = Ressource.objects.create(
                    designation=nom,
                    id_categorie=categorie,
                    id_sous_categorie=instance.id_sous_categorie_suggeree,
                    unite_mesure=instance.unite or "unité",
                )
                StagingItem.objects.filter(pk=instance.pk).update(id_ressource_liee=ressource)

    return ressource


def _integrate_item_into_stock(staging_item, ressource, marche):
    """Create/update LotArticle and Stock/InstanceRessource for one staging item."""
    from django.contrib.contenttypes.models import ContentType

    from apps.resources.models import InstanceRessource, MouvementStock, Stock
    from apps.resources.signals import _notify_gestionnaires_for_stock

    lot, created = LotArticle.objects.get_or_create(
        id_marche=marche,
        id_ressource=ressource,
        defaults={
            "numero_lot": LotArticle.objects.filter(id_marche=marche).count() + 1,
            "designation": staging_item.designation_normalisee or staging_item.designation_brute,
            "quantite_commandee": staging_item.quantite,
            "quantite_recue": staging_item.quantite,
        },
    )
    if not created:
        LotArticle.objects.filter(pk=lot.pk).update(
            quantite_recue=F("quantite_recue") + staging_item.quantite
        )

    lot_ct = ContentType.objects.get_for_model(LotArticle)

    if ressource.is_consommable:
        stock, _ = Stock.objects.get_or_create(id_ressource=ressource)
        Stock.objects.filter(pk=stock.pk).update(
            quantite_disponible=F("quantite_disponible") + staging_item.quantite
        )
        _notify_gestionnaires_for_stock(stock.pk)
        MouvementStock.objects.create(
            type_mouvement="entree",
            quantite=staging_item.quantite,
            id_ressource=ressource,
            content_type=lot_ct,
            object_id=lot.pk,
        )
    else:
        from datetime import date as _date  # noqa: PLC0415

        yyyy = str(_date.today().year)
        base_count = InstanceRessource.objects.filter(
            numero_inventaire__startswith=f"INV-{yyyy}-"
        ).count()
        new_instances = [
            InstanceRessource(
                id_ressource=ressource,
                id_lot=lot,
                numero_inventaire=f"INV-{yyyy}-{base_count + i + 1:04d}",
                statut="en_stock",
                etat="neuf",
                date_acquisition=_date.today(),
            )
            for i in range(staging_item.quantite)
        ]
        if new_instances:
            InstanceRessource.objects.bulk_create(new_instances)
        MouvementStock.objects.create(
            type_mouvement="entree",
            quantite=staging_item.quantite,
            id_ressource=ressource,
            content_type=lot_ct,
            object_id=lot.pk,
        )


@receiver(post_save, sender=StagingItem)
def on_staging_approuve(sender, instance, **kwargs):
    if instance.statut != "approuve":
        return

    ressource = _find_or_create_ressource(instance)

    if ressource is None:
        _check_import_complete(instance)
        return

    import_obj = instance.id_import
    marche = import_obj.id_marche

    _integrate_item_into_stock(instance, ressource, marche)
    _check_import_complete(instance)


_RECEPTION_ETAPES = [
    "en_attente_livraison",
    "livraison_en_cours",
    "receptionne_magasin",
    "controle_qualite",
    "stocker_au_magasin",
]


def _complete_reception_etapes(marche):
    """Mark all pre-reception etapes as complete when a marché is received."""
    from django.utils import timezone  # noqa: PLC0415

    MarcheEtape.objects.filter(
        id_marche=marche,
        nom_etape__in=_RECEPTION_ETAPES,
    ).exclude(statut="complete").update(statut="complete", date_fin=timezone.now())


def _check_import_complete(staging_item):
    """Set import to valide when no items remain pending, and update the marché."""
    import_obj = staging_item.id_import

    still_pending = StagingItem.objects.filter(
        id_import=import_obj, statut="en_attente"
    ).exists()
    if still_pending:
        return

    all_approved = not StagingItem.objects.filter(
        id_import=import_obj, statut="rejete"
    ).exists()

    new_statut = "valide" if all_approved else "rejete"
    ImportExcelBC.objects.filter(pk=import_obj.pk).update(statut_import=new_statut)

    if all_approved:
        marche = import_obj.id_marche
        if marche and marche.statut != "receptionne_et_stocke":
            _sync_marche_reference(marche, import_obj)
            marche.statut = "receptionne_et_stocke"
            marche.save(update_fields=["statut", "reference"])
            _complete_reception_etapes(marche)
