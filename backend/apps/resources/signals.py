from datetime import date

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.alerts.models import NotificationType
from apps.alerts.notification_service import create_notification
from apps.resources.models import Stock, InstanceRessource
from apps.users.models import Utilisateur


def generate_numero_inventaire():
    """
    Format : INV-{YYYY}-{XXXX}
    Exemple : INV-2026-0001, INV-2026-0042
    YYYY = année complète 4 chiffres
    XXXX = séquence 4 chiffres, reset chaque année
    """
    current_year = date.today().year
    yyyy = str(current_year)

    count = InstanceRessource.objects.filter(
        numero_inventaire__startswith=f'INV-{yyyy}-'
    ).count()

    sequence = str(count + 1).zfill(4)
    return f'INV-{yyyy}-{sequence}'


@receiver(pre_save, sender=InstanceRessource)
def auto_generate_numero_inventaire(sender, instance, **kwargs):
    """Auto-generate inventory number if not provided."""
    if not instance.numero_inventaire or instance.numero_inventaire.strip() == '':
        instance.numero_inventaire = generate_numero_inventaire()


@receiver(pre_save, sender=Stock)
def cache_previous_stock_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_stock_state = None
        return

    instance._previous_stock_state = Stock.objects.filter(pk=instance.pk).values(
        "quantite_disponible",
        "seuil_alerte",
    ).first()


def _notify_gestionnaires_for_stock(stock_id: int) -> None:
    stock = Stock.objects.select_related("id_ressource").filter(pk=stock_id).first()
    if not stock or stock.seuil_alerte is None:
        return
    if stock.quantite_disponible > stock.seuil_alerte:
        return

    gestionnaires = Utilisateur.objects.filter(
        id_role__nom_role="gestionnaire_magasin",
        actif=True,
    )
    designation = stock.id_ressource.designation
    for gestionnaire in gestionnaires:
        create_notification(
            gestionnaire,
            NotificationType.ALERTE_STOCK,
            (
                f"Le stock de '{designation}' est descendu à "
                f"{stock.quantite_disponible} unité(s), "
                f"en dessous du seuil d'alerte ({stock.seuil_alerte})."
            ),
            objet_id=stock.id_stock,
            lien=f"/gestionnaire/stock/{stock.id_stock}/",
            window_minutes=1440,
        )


@receiver(post_save, sender=Stock)
def on_stock_bas(sender, instance, **kwargs):
    if instance.seuil_alerte is None:
        return
    if instance.quantite_disponible > instance.seuil_alerte:
        return

    previous = getattr(instance, "_previous_stock_state", None)
    if previous and previous.get("seuil_alerte") is not None:
        previous_alert = previous["quantite_disponible"] <= previous["seuil_alerte"]
        current_alert = instance.quantite_disponible <= instance.seuil_alerte
        if previous_alert and current_alert:
            return

    gestionnaires = Utilisateur.objects.filter(
        id_role__nom_role="gestionnaire_magasin",
        actif=True,
    )
    _notify_gestionnaires_for_stock(instance.id_stock)
