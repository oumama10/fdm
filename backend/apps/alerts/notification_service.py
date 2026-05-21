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
    content_object=None,
    window_minutes=None,
):
    """
    Create a notification, skipping if an identical one was already sent
    within *window_minutes* (same destinataire + type + content_type + objet_id).

    Pass *content_object* as the related model instance; content_type and
    objet_id are derived from it automatically.

    Returns the Notification instance, or None if deduplicated.
    """
    from django.contrib.contenttypes.models import ContentType  # noqa: PLC0415

    content_type = None
    objet_id = None
    if content_object is not None:
        content_type = ContentType.objects.get_for_model(content_object)
        objet_id = content_object.pk

    window_minutes = _get_window_minutes(notification_type, window_minutes)

    already_exists = Notification.objects.filter(
        destinataire=destinataire,
        type=notification_type,
        content_type=content_type,
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
        content_type=content_type,
        objet_id=objet_id,
    )
