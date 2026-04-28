from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("requests", "0003_demande_requester_and_status_alignment"),
        ("procurement", "0012_add_donateur_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="marchebc",
            name="beneficiaire_commande",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="marchebc",
            name="date_signature_commande",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="marchebc",
            name="id_demande_source",
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="commande_interne", to="requests.demande"),
        ),
        migrations.AddField(
            model_name="marchebc",
            name="statut_signature_commande",
            field=models.CharField(choices=[("non_signe", "non_signe"), ("signe", "signe")], default="non_signe", max_length=20),
        ),
    ]
