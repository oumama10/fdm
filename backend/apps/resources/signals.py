from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.alerts.models import Notification
from apps.resources.models import Stock
from apps.users.models import Utilisateur


@receiver(post_save, sender=Stock)
def on_stock_bas(sender, instance, **kwargs):
    if instance.quantite_disponible > instance.seuil_alerte:
        return

    gestionnaires = Utilisateur.objects.filter(
        id_role__nom_role="gestionnaire_magasin",
        actif=True,
    )
    designation = instance.id_ressource.designation
    notifications = [
        Notification(
            type_notification="alerte_stock",
            titre=f"Stock bas: {designation}",
            message=(
                f"Le stock de '{designation}' est descendu à "
                f"{instance.quantite_disponible} unité(s), "
                f"en dessous du seuil d'alerte ({instance.seuil_alerte})."
            ),
            id_destinataire=gestionnaire,
        )
        for gestionnaire in gestionnaires
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)
