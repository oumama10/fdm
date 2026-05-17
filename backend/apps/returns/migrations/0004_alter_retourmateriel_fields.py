from django.db import migrations, models


def fix_motifs(apps, schema_editor):
    RetourMateriel = apps.get_model("returns", "RetourMateriel")
    RetourMateriel.objects.filter(motif_retour="endommage").update(motif_retour="panne")
    RetourMateriel.objects.filter(motif_retour="autre").update(motif_retour="inutilise")


def fix_statuts(apps, schema_editor):
    RetourMateriel = apps.get_model("returns", "RetourMateriel")
    RetourMateriel.objects.filter(statut="receptione").update(statut="receptionne")


class Migration(migrations.Migration):

    dependencies = [
        ("returns", "0003_retourmateriel_statut_date_reception"),
    ]

    operations = [
        migrations.RunPython(fix_motifs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="retourmateriel",
            name="motif_retour",
            field=models.CharField(
                max_length=20,
                choices=[
                    ("panne", "panne"),
                    ("inutilise", "inutilise"),
                ],
            ),
        ),
        migrations.RunPython(fix_statuts, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="retourmateriel",
            name="statut",
            field=models.CharField(
                max_length=20,
                choices=[
                    ("en_attente", "en_attente"),
                    ("receptionne", "receptionne"),
                ],
                default="en_attente",
            ),
        ),
    ]
