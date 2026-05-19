from django.db import migrations


def backfill_lieu_affectation(apps, schema_editor):
    InstanceRessource = apps.get_model("resources", "InstanceRessource")

    instances = InstanceRessource.objects.select_related(
        "id_service_actuel__id_batiment__id_etablissement"
    ).filter(
        id_service_actuel__isnull=False,
        id_lieu_affectation__isnull=True,
    )

    to_update = []
    for inst in instances:
        etab = (
            inst.id_service_actuel
            and inst.id_service_actuel.id_batiment
            and inst.id_service_actuel.id_batiment.id_etablissement
        )
        if etab:
            inst.id_lieu_affectation = etab
            to_update.append(inst)

    if to_update:
        InstanceRessource.objects.bulk_update(to_update, ["id_lieu_affectation_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0019_instance_affectation_fields"),
    ]

    operations = [
        migrations.RunPython(backfill_lieu_affectation, migrations.RunPython.noop),
    ]
