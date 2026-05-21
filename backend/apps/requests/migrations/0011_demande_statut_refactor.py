from django.db import migrations, models


def remap_statut_forward(apps, schema_editor):
    Demande = apps.get_model('requests', 'Demande')
    mapping = {
        'en_attente': 'en_cours',
        'totale': 'traite',
        'partielle': 'traite',
        'refusee': 'refuse',
    }
    for old, new in mapping.items():
        Demande.objects.filter(statut=old).update(statut=new)


def remap_statut_backward(apps, schema_editor):
    Demande = apps.get_model('requests', 'Demande')
    mapping = {
        'en_cours': 'en_attente',
        'traite': 'totale',
        'en_instance': 'en_attente',
        'refuse': 'refusee',
    }
    for old, new in mapping.items():
        Demande.objects.filter(statut=old).update(statut=new)


class Migration(migrations.Migration):

    dependencies = [
        ('requests', '0010_etablissement_batiment_beneficiaire'),
    ]

    operations = [
        migrations.AlterField(
            model_name='demande',
            name='statut',
            field=models.CharField(
                db_index=True,
                default='en_cours',
                max_length=30,
                choices=[
                    ('en_cours', 'en_cours'),
                    ('traite', 'traite'),
                    ('en_instance', 'en_instance'),
                    ('refuse', 'refuse'),
                ],
            ),
        ),
        migrations.RunPython(remap_statut_forward, remap_statut_backward),
    ]
