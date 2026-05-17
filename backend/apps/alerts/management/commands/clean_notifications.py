from django.core.management.base import BaseCommand

from apps.alerts.models import Notification, NotificationType


class Command(BaseCommand):
    help = "Delete notifications whose parent object no longer exists."

    def handle(self, *args, **options):
        from apps.procurement.models import ImportExcelBC
        from apps.decharge.models import Decharge
        from apps.requests.models import Demande
        from apps.resources.models import Stock
        from apps.returns.models import RetourMateriel

        type_candidates = {
            NotificationType.DEMANDE_SOUMISE: (Demande, ImportExcelBC),
            NotificationType.DEMANDE_VALIDEE: (Demande,),
            NotificationType.DEMANDE_REJETEE: (Demande,),
            NotificationType.DECHARGE_GENEREE: (Decharge,),
            NotificationType.DECHARGE_SIGNEE: (Decharge,),
            NotificationType.RETOUR_ENREGISTRE: (RetourMateriel,),
            NotificationType.ALERTE_STOCK: (Stock,),
        }

        total_deleted = 0
        for notif_type, models in type_candidates.items():
            existing_ids = set()
            for model in models:
                existing_ids.update(model.objects.values_list("pk", flat=True))

            orphan_ids = list(
                Notification.objects.filter(type=notif_type, objet_id__isnull=False)
                .exclude(objet_id__in=existing_ids)
                .values_list("pk", flat=True)
            )
            if not orphan_ids:
                continue

            deleted, _ = Notification.objects.filter(pk__in=orphan_ids).delete()
            if deleted:
                self.stdout.write(
                    self.style.WARNING(f"[{notif_type}] {deleted} orphan notification(s) deleted.")
                )
            total_deleted += deleted

        self.stdout.write(self.style.SUCCESS(f"Done. Total deleted: {total_deleted}."))
