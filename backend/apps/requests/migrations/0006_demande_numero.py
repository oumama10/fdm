from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("requests", "0005_add_en_attente_statut"),
    ]

    operations = [
        migrations.AddField(
            model_name="demande",
            name="numero",
            field=models.CharField(blank=True, max_length=30, null=True, unique=True),
        ),
    ]
