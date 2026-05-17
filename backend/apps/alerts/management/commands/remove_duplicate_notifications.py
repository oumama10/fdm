from django.core.management.base import BaseCommand

from apps.alerts.models import Notification, NotificationType


class Command(BaseCommand):
    help = "Remove duplicate notifications, keeping only the most recent one per group."

    def handle(self, *args, **options):
        from django.db.models import F

        total_deleted = 0

        # For each (destinataire, type, objet_id) group with multiple notifications,
        # keep the most recent and delete the rest.
        qs = (
            Notification.objects
            .values("destinataire_id", "type", "objet_id")
            .annotate(count=F("destinataire_id"))
            .filter(count__gt=0)
        )

        # Group notifications by (destinataire, type, objet_id)
        from django.db.models import Count

        duplicates = (
            Notification.objects
            .values("destinataire_id", "type", "objet_id")
            .annotate(notif_count=Count("id_notification"))
            .filter(notif_count__gt=1)
        )

        for group in duplicates:
            # Get all notifications in this group, ordered by created_at DESC
            notifs = Notification.objects.filter(
                destinataire_id=group["destinataire_id"],
                type=group["type"],
                objet_id=group["objet_id"],
            ).order_by("-created_at")

            # Delete all except the first (most recent)
            to_delete = notifs[1:]
            if to_delete:
                deleted_count = Notification.objects.filter(
                    pk__in=[n.pk for n in to_delete]
                ).delete()[0]
                total_deleted += deleted_count
                self.stdout.write(
                    self.style.WARNING(
                        f"  [{group['type']}] Deleted {deleted_count} duplicate(s) "
                        f"for user {group['destinataire_id']}, object {group['objet_id']}."
                    )
                )

        self.stdout.write(self.style.SUCCESS(f"Done. Total deleted: {total_deleted}."))
