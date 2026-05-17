from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0015_alter_seuil_alerte_nullable"),
    ]

    operations = [
        migrations.AlterField(
            model_name="instanceressource",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_stock", "en_stock"),
                    ("en_service", "en_service"),
                    ("en_maintenance", "en_maintenance"),
                    ("hors_service", "hors_service"),
                    ("retire", "retire"),
                ],
                db_index=True,
                default="en_stock",
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name="instanceressource",
            name="etat",
            field=models.CharField(
                choices=[
                    ("neuf", "neuf"),
                    ("bon_etat", "bon_etat"),
                    ("usage_normal", "usage_normal"),
                    ("endommage", "endommage"),
                    ("hors_service", "hors_service"),
                    ("retourne", "retourne"),
                ],
                db_index=True,
                default="neuf",
                max_length=50,
            ),
        ),
    ]
