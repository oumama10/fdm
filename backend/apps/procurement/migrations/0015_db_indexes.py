from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0014_marchebc_source"),
    ]

    operations = [
        migrations.AlterField(
            model_name="marchebc",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_attente_livraison", "en_attente_livraison"),
                    ("receptionne_et_stocke", "receptionne_et_stocke"),
                    ("non_conforme", "non_conforme"),
                ],
                db_index=True,
                default="en_attente_livraison",
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="marchebc",
            name="source",
            field=models.CharField(
                choices=[
                    ("manuel", "manuel"),
                    ("import", "import"),
                ],
                db_index=True,
                default="manuel",
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name="importexcelbc",
            name="statut_import",
            field=models.CharField(
                choices=[
                    ("en_attente", "en_attente"),
                    ("brouillon", "brouillon"),
                    ("en_revision", "en_revision"),
                    ("valide", "valide"),
                    ("non_conforme", "non_conforme"),
                    ("autre", "autre"),
                    ("rejete", "rejete"),
                ],
                db_index=True,
                default="brouillon",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="stagingitem",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_attente", "en_attente"),
                    ("approuve", "approuve"),
                    ("rejete", "rejete"),
                    ("modifie", "modifie"),
                ],
                db_index=True,
                default="en_attente",
                max_length=20,
            ),
        ),
    ]
