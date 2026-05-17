from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0015_db_indexes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="marchebc",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_attente_livraison", "en_attente_livraison"),
                    ("receptionne_et_stocke", "receptionne_et_stocke"),
                ],
                db_index=True,
                default="en_attente_livraison",
                max_length=30,
            ),
        ),
    ]
