from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("decharge", "0005_add_timestampedmodel"),
    ]

    operations = [
        migrations.AddField(
            model_name="decharge",
            name="statut",
            field=models.CharField(
                choices=[
                    ("generee", "Générée"),
                    ("en_attente_signature", "En attente de signature"),
                    ("signee", "Signée"),
                    ("livree", "Livrée"),
                ],
                default="generee",
                db_index=True,
                max_length=30,
            ),
        ),
    ]
