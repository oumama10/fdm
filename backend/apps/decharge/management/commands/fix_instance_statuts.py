from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = (
        "One-shot fix: for every signed decharge, set linked bien-inventaire "
        "instances to statut='en_service' with the correct id_service_actuel."
    )

    def handle(self, *args, **options):
        from apps.decharge.models import Decharge, LigneDecharge  # noqa: PLC0415
        from apps.resources.models import InstanceRessource  # noqa: PLC0415

        updated = 0
        skipped = 0

        with transaction.atomic():
            # All decharges whose linked signature has statut="signe"
            signed_decharges = Decharge.objects.filter(
                signature__statut="signe"
            ).select_related(
                "id_demande__id_service",
            ).prefetch_related(
                "lignes__id_instance_ressource",
            )

            for decharge in signed_decharges:
                service = (
                    decharge.id_demande.id_service if decharge.id_demande else None
                )
                if service is None:
                    skipped += 1
                    continue

                instance_ids = [
                    ligne.id_instance_ressource_id
                    for ligne in decharge.lignes.all()
                    if ligne.type_ligne == "bien_inventaire"
                    and ligne.id_instance_ressource_id is not None
                ]
                if not instance_ids:
                    continue

                n = InstanceRessource.objects.filter(
                    pk__in=instance_ids
                ).exclude(statut="en_service").update(
                    statut="en_service",
                    id_service_actuel=service,
                )
                updated += n

        self.stdout.write(f"  Instances set to en_service: {updated}")
        if skipped:
            self.stdout.write(f"  Decharges skipped (no service): {skipped}")

        # Verification
        signed_instance_ids = set()
        for decharge in Decharge.objects.filter(signature__statut="signe").prefetch_related("lignes"):
            for ligne in decharge.lignes.all():
                if ligne.type_ligne == "bien_inventaire" and ligne.id_instance_ressource_id:
                    signed_instance_ids.add(ligne.id_instance_ressource_id)

        wrong = InstanceRessource.objects.filter(
            pk__in=signed_instance_ids
        ).exclude(statut="en_service").count()

        if wrong == 0:
            self.stdout.write(
                self.style.SUCCESS("OK — all instances from signed decharges are en_service.")
            )
        else:
            self.stdout.write(
                self.style.ERROR(f"WARN — {wrong} instances from signed decharges are NOT en_service.")
            )
