from django.db import migrations, models


def forward_data(apps, schema_editor):
    ImportExcelBC = apps.get_model('procurement', 'ImportExcelBC')
    StagingItem = apps.get_model('procurement', 'StagingItem')

    ImportExcelBC.objects.filter(statut_import='brouillon').update(statut_import='en_attente')
    ImportExcelBC.objects.filter(statut_import='rejete').update(statut_import='autre')

    StagingItem.objects.filter(motif_rejet='en_attente_livraison').update(motif_rejet='document_invalide')


def backward_data(apps, schema_editor):
    ImportExcelBC = apps.get_model('procurement', 'ImportExcelBC')
    StagingItem = apps.get_model('procurement', 'StagingItem')

    ImportExcelBC.objects.filter(statut_import='en_attente').update(statut_import='brouillon')
    ImportExcelBC.objects.filter(statut_import='autre').update(statut_import='rejete')

    StagingItem.objects.filter(motif_rejet='document_invalide').update(motif_rejet='en_attente_livraison')


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0010_alter_stagingitem_motif_rejet'),
    ]

    operations = [
        migrations.RunPython(forward_data, backward_data),
        migrations.AlterField(
            model_name='importexcelbc',
            name='statut_import',
            field=models.CharField(
                choices=[
                    ('en_attente', 'en_attente'),
                    ('en_revision', 'en_revision'),
                    ('valide', 'valide'),
                    ('non_conforme', 'non_conforme'),
                    ('autre', 'autre'),
                ],
                default='en_attente',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='stagingitem',
            name='motif_rejet',
            field=models.CharField(
                blank=True,
                choices=[
                    ('non_conforme', 'non_conforme'),
                    ('document_invalide', 'document_invalide'),
                    ('autre', 'autre'),
                ],
                default='',
                max_length=40,
            ),
        ),
    ]
