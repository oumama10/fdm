from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0007_normalize_sous_categories_consommable'),
    ]

    operations = [
        migrations.AlterField(
            model_name='instanceressource',
            name='numero_inventaire',
            field=models.CharField(
                max_length=50,
                unique=True,
                blank=True,
                help_text='Auto-generated in format INV-{YY}-{XXXX} if not provided',
            ),
        ),
    ]
