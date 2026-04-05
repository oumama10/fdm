from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="importexcelbc",
            name="file_type",
            field=models.CharField(
                choices=[("xlsx", "Excel"), ("pdf", "PDF")],
                default="xlsx",
                max_length=10,
            ),
        ),
    ]
