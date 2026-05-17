from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0009_stagingitem_rejection_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='marchebc',
            name='type_donateur',
            field=models.CharField(
                max_length=50,
                blank=True,
                choices=[
                    ('personne_physique', 'Personne Physique'),
                    ('organisation', 'Organisation'),
                    ('association', 'Association'),
                    ('gouvernement', 'Gouvernement'),
                    ('entreprise', 'Entreprise'),
                    ('autre', 'Autre'),
                ],
                help_text='Type de donateur (pour les donations)',
            ),
        ),
        migrations.AddField(
            model_name='marchebc',
            name='nom_donateur',
            field=models.CharField(
                max_length=255,
                blank=True,
                help_text='Nom du donateur (personne ou représentant)',
            ),
        ),
        migrations.AddField(
            model_name='marchebc',
            name='organisme_donateur',
            field=models.CharField(
                max_length=255,
                blank=True,
                help_text='Organisme ou entreprise du donateur',
            ),
        ),
        migrations.AddField(
            model_name='marchebc',
            name='contact_donateur',
            field=models.CharField(
                max_length=255,
                blank=True,
                help_text='Coordonnées de contact (email/téléphone)',
            ),
        ),
    ]
