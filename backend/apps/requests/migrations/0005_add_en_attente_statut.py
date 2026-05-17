from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("requests", "0004_lignedemande_quantite_livree"),
    ]

    operations = [
        migrations.AlterField(
            model_name="demande",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_attente", "en_attente"),
                    ("en_cours", "en_cours"),
                    ("partielle", "partielle"),
                    ("totale", "totale"),
                    ("refusee", "refusee"),
                ],
                default="en_attente",
                max_length=30,
            ),
        ),
    ]
