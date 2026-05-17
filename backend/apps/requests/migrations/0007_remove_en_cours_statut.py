from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("requests", "0006_demande_numero"),
    ]

    operations = [
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
                default="en_attente",
                max_length=30,
            ),
        ),
    ]
