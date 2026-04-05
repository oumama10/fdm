from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0004_importexcelbc_header_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="stagingitem",
            name="prix_total_ht",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="stagingitem",
            name="prix_unitaire_ht",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="stagingitem",
            name="unite",
            field=models.CharField(blank=True, default="U", max_length=20),
        ),
    ]
