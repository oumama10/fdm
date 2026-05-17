from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.alerts.models import NotificationType
from apps.alerts.notification_service import create_notification
from apps.decharge.models import SignatureDecharge


@receiver(post_save, sender=SignatureDecharge)
def on_signature_valide(sender, instance, created, **kwargs):
    if instance.statut != "signe":
        return

    decharge = instance.id_decharge
    demande = decharge.id_demande

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
            objet_id=decharge.pk,
            lien=f"/gestionnaire/decharges/{decharge.pk}/",
        )
