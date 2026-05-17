from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("returns", "0004_alter_retourmateriel_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="retourmateriel",
            name="statut",
            field=models.CharField(
                choices=[
                    ("en_attente", "en_attente"),
                    ("receptionne", "receptionne"),
                ],
                db_index=True,
                default="en_attente",
                max_length=20,
            ),
        ),
    ]
