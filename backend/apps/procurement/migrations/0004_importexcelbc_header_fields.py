from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0003_importexcelbc_file_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="importexcelbc",
            name="reference_document",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="importexcelbc",
            name="fournisseur_denomination",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="importexcelbc",
            name="fournisseur_telephone",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="importexcelbc",
            name="fournisseur_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="importexcelbc",
            name="fournisseur_adresse",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="importexcelbc",
            name="delai_execution",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
