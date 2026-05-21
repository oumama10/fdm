from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("requests", "0014_add_timestampedmodel"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="demande",
            index=models.Index(fields=["statut", "date_demande"], name="demande_statut_date_idx"),
        ),
        migrations.AddIndex(
            model_name="demande",
            index=models.Index(fields=["id_service", "statut"], name="demande_service_statut_idx"),
        ),
    ]
