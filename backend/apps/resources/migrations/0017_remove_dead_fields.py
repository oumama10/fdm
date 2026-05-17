from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0016_db_indexes"),
    ]

    operations = [
        # Remove Stock.quantite_reservee
        migrations.RemoveField(
            model_name="stock",
            name="quantite_reservee",
        ),
        # Remove usage_normal from InstanceRessource.etat choices
        migrations.AlterField(
            model_name="instanceressource",
            name="etat",
            field=models.CharField(
                choices=[
                    ("neuf", "neuf"),
                    ("bon_etat", "bon_etat"),
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
