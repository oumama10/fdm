from django.core.management.base import BaseCommand

from apps.procurement.models import MarcheBC


class Command(BaseCommand):
    help = "Replace auto-generated MarcheBC references (IMPORT-*/MANUAL-*) with the real document reference."

    def handle(self, *args, **options):
        fixed = 0
        skipped_no_ref = 0
        skipped_conflict = 0

        candidates = MarcheBC.objects.filter(
            reference__startswith="IMPORT-"
        ).select_related("import_excel")
        candidates |= MarcheBC.objects.filter(
            reference__startswith="MANUAL-"
        ).select_related("import_excel")

        for marche in candidates.distinct():
            import_obj = getattr(marche, "import_excel", None)
            real_ref = (import_obj.reference_document if import_obj else "").strip()

            if not real_ref:
                skipped_no_ref += 1
                self.stdout.write(f"  SKIP #{marche.id_marche} {marche.reference!r} — no reference_document")
                continue

            conflict = MarcheBC.objects.filter(reference=real_ref).exclude(pk=marche.pk).exists()
            if conflict:
                skipped_conflict += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"  CONFLICT #{marche.id_marche} {marche.reference!r} -> {real_ref!r} already taken"
                    )
                )
                continue

            old = marche.reference
            MarcheBC.objects.filter(pk=marche.pk).update(reference=real_ref)
            fixed += 1
            self.stdout.write(self.style.SUCCESS(f"  FIXED #{marche.id_marche} {old!r} -> {real_ref!r}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. {fixed} fixed, {skipped_no_ref} skipped (no ref), {skipped_conflict} skipped (conflict)."
            )
        )
