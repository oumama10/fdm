from datetime import timedelta

from django.utils.timezone import now

from .models import NOTIFICATION_TYPE_TO_NIVEAU, Notification, NotificationType


DEFAULT_NOTIFICATION_WINDOW_MINUTES = 5
STOCK_NOTIFICATION_WINDOW_MINUTES = 24 * 60


def _get_window_minutes(notification_type, window_minutes=None):
    if window_minutes is not None:
        return window_minutes
    if notification_type == NotificationType.ALERTE_STOCK:
        return STOCK_NOTIFICATION_WINDOW_MINUTES
    return DEFAULT_NOTIFICATION_WINDOW_MINUTES


def create_notification(
    destinataire,
    notification_type,
    message,
    lien=None,
    objet_id=None,
    window_minutes=None,
):
    """
    Create a notification, skipping if an identical one was already sent
    within *window_minutes* (same destinataire + type + objet_id).

    Returns the Notification instance, or None if deduplicated.
    """
    window_minutes = _get_window_minutes(notification_type, window_minutes)

    already_exists = Notification.objects.filter(
        destinataire=destinataire,
        type=notification_type,
        objet_id=objet_id,
        created_at__gte=now() - timedelta(minutes=window_minutes),
    ).exists()
    if already_exists:
        return None

    niveau = NOTIFICATION_TYPE_TO_NIVEAU.get(
        notification_type,
        NOTIFICATION_TYPE_TO_NIVEAU.get(NotificationType.DEMANDE_SOUMISE),
    )

    return Notification.objects.create(
        destinataire=destinataire,
        type=notification_type,
        niveau=niveau,
        message=message,
        lien=lien,
        objet_id=objet_id,
    )
