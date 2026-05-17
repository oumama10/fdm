import re
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.resources.models import InstanceRessource

OLD_PATTERN = re.compile(r"^INV-\d+-\d{4}$")


class Command(BaseCommand):
    help = "Migrate inventory numbers from INV-{pk}-{n} to INV-{YYYY}-{n} format."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would change without writing to the database.",
        )
        parser.add_argument(
            "--year",
            type=int,
            default=date.today().year,
            help="Year to use in the new numbers (default: current year).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        yyyy = str(options["year"])

        old_instances = [
            inst
            for inst in InstanceRessource.objects.order_by("id_instance")
            if OLD_PATTERN.match(inst.numero_inventaire)
        ]

        if not old_instances:
            self.stdout.write(self.style.SUCCESS("No old-format inventory numbers found. Nothing to do."))
            return

        self.stdout.write(f"Found {len(old_instances)} instance(s) with old INV-<pk>-<n> format.")

        if dry_run:
            # Compute what the new numbers would be without touching the DB
            base = InstanceRessource.objects.filter(
                numero_inventaire__startswith=f"INV-{yyyy}-"
            ).count()
            for i, inst in enumerate(old_instances):
                new_num = f"INV-{yyyy}-{base + i + 1:04d}"
                self.stdout.write(f"  {inst.numero_inventaire}  ->  {new_num}")
            self.stdout.write(self.style.WARNING("Dry-run: no changes written."))
            return

        with transaction.atomic():
            # Step 1 — rename to a temporary value so uniqueness constraint
            # doesn't block us while we shuffle numbers.
            for inst in old_instances:
                inst.numero_inventaire = f"__MIG__{inst.pk}__"
                inst.save(update_fields=["numero_inventaire"])

            # Step 2 — determine the current highest sequence for this year
            # (counts only records that were NOT part of this migration).
            base = InstanceRessource.objects.filter(
                numero_inventaire__startswith=f"INV-{yyyy}-"
            ).count()

            # Step 3 — assign final sequential numbers
            for i, inst in enumerate(old_instances):
                new_num = f"INV-{yyyy}-{base + i + 1:04d}"
                inst.numero_inventaire = new_num
                inst.save(update_fields=["numero_inventaire"])
                self.stdout.write(f"  #{inst.pk}  ->  {new_num}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Migrated {len(old_instances)} inventory number(s) to INV-{yyyy}-xxxx format."
            )
        )
