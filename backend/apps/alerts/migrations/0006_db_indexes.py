from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("alerts", "0005_alter_notification_niveau_alter_notification_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="lu",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AlterField(
            model_name="notification",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="notification",
            name="type",
            field=models.CharField(
                choices=[
                    ("demande_soumise", "Demande soumise"),
                    ("demande_validee", "Demande validée"),
                    ("demande_rejetee", "Demande rejetée"),
                    ("decharge_generee", "Décharge générée"),
                    ("decharge_signee", "Décharge signée"),
                    ("retour_enregistre", "Retour enregistré"),
                    ("alerte_stock", "Alerte stock"),
                    ("import_staging", "Import en attente de révision"),
                ],
                db_index=True,
                default="alerte_stock",
                max_length=30,
            ),
        ),
    ]
