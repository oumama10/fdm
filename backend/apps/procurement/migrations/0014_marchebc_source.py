from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0013_importexcelbc_statut_choices"),
    ]

    operations = [
        migrations.AddField(
            model_name="marchebc",
            name="source",
            field=models.CharField(
                choices=[("manuel", "manuel"), ("import", "import")],
                default="manuel",
                max_length=10,
            ),
        ),
    ]
