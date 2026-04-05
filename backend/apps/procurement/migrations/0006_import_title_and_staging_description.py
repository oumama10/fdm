from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0005_stagingitem_prix_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="importexcelbc",
            name="titre_fichier",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="stagingitem",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
    ]
