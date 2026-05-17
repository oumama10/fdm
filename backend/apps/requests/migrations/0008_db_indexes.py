from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("requests", "0007_remove_en_cours_statut"),
    ]

    operations = [
        migrations.AlterField(
            model_name="demande",
            name="date_demande",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="demande",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_attente", "en_attente"),
                    ("partielle", "partielle"),
                    ("totale", "totale"),
                    ("refusee", "refusee"),
                ],
                db_index=True,
                default="en_attente",
                max_length=30,
            ),
        ),
    ]
