from django.db import migrations


def backfill_type_affectation(apps, schema_editor):
    InstanceRessource = apps.get_model("resources", "InstanceRessource")
    InstanceRessource.objects.filter(
        id_service_actuel__isnull=False,
        type_affectation="",
    ).update(type_affectation="nouvelle_affectation")


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0020_backfill_lieu_affectation"),
    ]

    operations = [
        migrations.RunPython(backfill_type_affectation, migrations.RunPython.noop),
    ]
