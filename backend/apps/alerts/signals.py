from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db.models import Q

from apps.decharge.models import Decharge
from apps.procurement.models import ImportExcelBC
from apps.requests.models import Demande
from apps.resources.models import Stock
from apps.returns.models import RetourMateriel
from apps.alerts.models import NotificationType


def _delete_notifications(instance, *, notification_types, link_prefixes):
    from apps.alerts.models import Notification

    queryset = Notification.objects.filter(
        objet_id=instance.pk,
        type__in=notification_types,
    )
    if link_prefixes:
        link_filter = Q()
        for prefix in link_prefixes:
            link_filter |= Q(lien__startswith=prefix)
        queryset = queryset.filter(link_filter)
    queryset.delete()


@receiver(post_delete, sender=ImportExcelBC)
def delete_notifications_on_import_delete(sender, instance, **kwargs):
    _delete_notifications(
        instance,
        notification_types=(NotificationType.DEMANDE_SOUMISE,),
        link_prefixes=("/gestionnaire/donnees-extraites/",),
    )


@receiver(post_delete, sender=Demande)
def delete_notifications_on_demande_delete(sender, instance, **kwargs):
    _delete_notifications(
        instance,
        notification_types=(
            NotificationType.DEMANDE_SOUMISE,
            NotificationType.DEMANDE_VALIDEE,
            NotificationType.DEMANDE_REJETEE,
        ),
        link_prefixes=("/chef/demandes/", "/gestionnaire/demandes/"),
    )


@receiver(post_delete, sender=Decharge)
def delete_notifications_on_decharge_delete(sender, instance, **kwargs):
    _delete_notifications(
        instance,
        notification_types=(
            NotificationType.DECHARGE_GENEREE,
            NotificationType.DECHARGE_SIGNEE,
        ),
        link_prefixes=("/chef/decharges/", "/gestionnaire/decharges/"),
    )


@receiver(post_delete, sender=RetourMateriel)
def delete_notifications_on_retour_delete(sender, instance, **kwargs):
    _delete_notifications(
        instance,
        notification_types=(NotificationType.RETOUR_ENREGISTRE,),
        link_prefixes=("/gestionnaire/retours/",),
    )


@receiver(post_delete, sender=Stock)
def delete_notifications_on_stock_delete(sender, instance, **kwargs):
    _delete_notifications(
        instance,
        notification_types=(NotificationType.ALERTE_STOCK,),
        link_prefixes=("/gestionnaire/stock/",),
    )
