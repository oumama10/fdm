from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0021_backfill_type_affectation"),
    ]

    operations = [
        migrations.AddField(
            model_name="ressource",
            name="marque",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
