from django.db import migrations, models


def align_demande_statuses(apps, schema_editor):
    Demande = apps.get_model("requests", "Demande")

    Demande.objects.filter(statut__in=["validee", "en_preparation", "complete_avec_decharge"]).update(
        statut="totale"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("requests", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="demande",
            name="beneficiaire_detail",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="demande",
            name="beneficiaire_nom",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="demande",
            name="beneficiaire_type",
            field=models.CharField(blank=True, choices=[("personnel", "personnel"), ("unite", "unite"), ("lieu", "lieu")], default="", max_length=20),
        ),
        migrations.AddField(
            model_name="demande",
            name="type_demandeur",
            field=models.CharField(choices=[("service", "service"), ("decanat", "decanat"), ("pharmacie", "pharmacie"), ("dentaire", "dentaire"), ("labo", "labo"), ("association", "association"), ("chu", "chu")], default="service", max_length=20),
        ),
        migrations.AlterField(
            model_name="demande",
            name="statut",
            field=models.CharField(choices=[("en_cours", "en_cours"), ("partielle", "partielle"), ("totale", "totale"), ("refusee", "refusee")], default="en_cours", max_length=30),
        ),
        migrations.RunPython(align_demande_statuses, migrations.RunPython.noop),
    ]
