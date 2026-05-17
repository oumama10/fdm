from django.db import migrations, models


def backfill_statut(apps, schema_editor):
    RetourMateriel = apps.get_model("returns", "RetourMateriel")
    RetourMateriel.objects.exclude(decision="").update(statut="receptione")


class Migration(migrations.Migration):

    dependencies = [
        ("returns", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="retourmateriel",
            name="statut",
            field=models.CharField(
                choices=[("en_attente", "en_attente"), ("receptione", "receptione")],
                default="en_attente",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="retourmateriel",
            name="date_reception",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_statut, migrations.RunPython.noop),
    ]
