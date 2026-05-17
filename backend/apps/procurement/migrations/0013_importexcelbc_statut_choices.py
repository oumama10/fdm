from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0012_stagingitem_sous_categorie'),
    ]

    operations = [
        migrations.AlterField(
            model_name='importexcelbc',
            name='statut_import',
            field=models.CharField(
                choices=[
                    ('en_attente', 'en_attente'),
                    ('brouillon', 'brouillon'),
                    ('en_revision', 'en_revision'),
                    ('valide', 'valide'),
                    ('non_conforme', 'non_conforme'),
                    ('autre', 'autre'),
                    ('rejete', 'rejete'),
                ],
                default='brouillon',
                max_length=20,
            ),
        ),
    ]
