from django.db import migrations, models


def map_legacy_statuts(apps, schema_editor):
    Demande = apps.get_model("requests", "Demande")

    status_map = {
        "validee": "totale",
        "en_preparation": "en_cours",
        "complete": "totale",
        "complete_avec_decharge": "totale",
    }

    for old_value, new_value in status_map.items():
        Demande.objects.filter(statut=old_value).update(statut=new_value)


def reverse_map_legacy_statuts(apps, schema_editor):
    Demande = apps.get_model("requests", "Demande")
    Demande.objects.filter(statut="totale").update(statut="validee")


class Migration(migrations.Migration):

    dependencies = [
        ("requests", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="demande",
            name="beneficiaire_detail",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="demande",
            name="beneficiaire_nom",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="demande",
            name="beneficiaire_type",
            field=models.CharField(default="service", max_length=30),
        ),
        migrations.AddField(
            model_name="demande",
            name="motif_refus",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="demande",
            name="type_demandeur",
            field=models.CharField(default="chef_service", max_length=30),
        ),
        migrations.RunPython(map_legacy_statuts, reverse_map_legacy_statuts),
        migrations.AlterField(
            model_name="demande",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_cours", "en_cours"),
                    ("partielle", "partielle"),
                    ("totale", "totale"),
                    ("refusee", "refusee"),
                ],
                default="en_cours",
                max_length=30,
            ),
        ),
    ]
