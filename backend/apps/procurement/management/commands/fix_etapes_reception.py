from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.procurement.models import MarcheBC, MarcheEtape
from apps.procurement.signals import _RECEPTION_ETAPES


class Command(BaseCommand):
    help = "Backfill reception etapes for marchés already in receptionne_et_stocke."

    def handle(self, *args, **options):
        marches = MarcheBC.objects.filter(statut="receptionne_et_stocke").prefetch_related("etapes")
        total = marches.count()
        self.stdout.write(f"Found {total} received marchés to check.")

        fixed_marches = 0
        fixed_etapes = 0

        for marche in marches:
            ref_etape = marche.etapes.filter(nom_etape="receptionne_magasin").first()
            date_fin = ref_etape.date_fin if (ref_etape and ref_etape.date_fin) else timezone.now()

            updated = MarcheEtape.objects.filter(
                id_marche=marche,
                nom_etape__in=_RECEPTION_ETAPES,
            ).exclude(statut="complete").update(statut="complete", date_fin=date_fin)

            if updated:
                fixed_marches += 1
                fixed_etapes += updated
                self.stdout.write(
                    self.style.SUCCESS(f"  FIXED #{marche.id_marche} {marche.reference!r} — {updated} etape(s)")
                )

        self.stdout.write(
            self.style.SUCCESS(f"\nDone. {fixed_etapes} etapes fixed on {fixed_marches}/{total} marchés.")
        )
