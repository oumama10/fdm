from django.core.management.base import BaseCommand

from apps.procurement.models import MarcheBC


class Command(BaseCommand):
    help = "Set source=import on marchés created via the PDF/import workflow, source=manuel on all others."

    def handle(self, *args, **options):
        # A marché is from import if:
        # - its reference starts with "IMPORT-", OR
        # - it has an associated ImportExcelBC record
        import_ids = set(
            MarcheBC.objects.filter(
                import_excel__isnull=False
            ).values_list("id_marche", flat=True)
        )
        import_ids |= set(
            MarcheBC.objects.filter(
                reference__startswith="IMPORT-"
            ).values_list("id_marche", flat=True)
        )

        updated_import = MarcheBC.objects.filter(id_marche__in=import_ids).update(source="import")
        updated_manuel = MarcheBC.objects.exclude(id_marche__in=import_ids).update(source="manuel")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {updated_import} marked source=import, {updated_manuel} marked source=manuel."
            )
        )
