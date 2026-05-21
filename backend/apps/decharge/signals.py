from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.alerts.models import NotificationType
from apps.alerts.notification_service import create_notification
from apps.decharge.models import Decharge, SignatureDecharge


@receiver(pre_save, sender=Decharge)
def on_decharge_pre_save(sender, instance, **kwargs):
    """Transition statut → 'livree' when date_livraison is first set."""
    if not instance.pk or instance.date_livraison is None:
        return
    try:
        old = Decharge.objects.only("date_livraison").get(pk=instance.pk)
    except Decharge.DoesNotExist:
        return
    if old.date_livraison is None:
        instance.statut = "livree"


@receiver(post_save, sender=SignatureDecharge)
def on_signature_valide(sender, instance, created, **kwargs):
    if instance.statut != "signe":
        return

    decharge = instance.id_decharge
    demande = decharge.id_demande

    # Transition Decharge statut → 'signee'
    Decharge.objects.filter(pk=decharge.pk).update(statut="signee")

    # Update quantite_livree on each LigneDemande and recalculate demande progression.
    # Stock was already decremented at valider() time (Option A).
    from apps.decharge.views import _update_demande_delivery_on_signature_validated  # noqa: PLC0415
    _update_demande_delivery_on_signature_validated(decharge)

    chef = instance.id_chef_service or (demande.id_chef_demandeur if demande else None)
    if chef:
        create_notification(
            chef,
            NotificationType.DECHARGE_SIGNEE,
            f"La décharge {decharge.numero_decharge} a été signée.",
            content_object=decharge,
            lien=f"/gestionnaire/decharges/{decharge.pk}/",
        )
