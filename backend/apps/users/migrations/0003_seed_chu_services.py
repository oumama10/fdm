from django.db import migrations


def seed_chu_services(apps, schema_editor):
    """Seed initial CHU (university hospital) services."""
    Service = apps.get_model('users', 'Service')
    
    services_data = [
        {
            'nom_service': 'Administration',
            'type_service': 'administratif',
            'description': 'Service administratif central du CHU',
        },
        {
            'nom_service': 'Décanat de Médecine',
            'type_service': 'decanat',
            'description': 'Décanat de la Faculté de Médecine',
        },
        {
            'nom_service': 'Décanat de Pharmacie',
            'type_service': 'decanat',
            'description': 'Décanat de la Faculté de Pharmacie',
        },
        {
            'nom_service': 'Décanat de Dentisterie',
            'type_service': 'decanat',
            'description': 'Décanat de la Faculté de Dentisterie',
        },
    ]
    
    for data in services_data:
        Service.objects.get_or_create(
            nom_service=data['nom_service'],
            defaults={
                'type_service': data['type_service'],
                'description': data['description'],
            }
        )


def reverse_seed(apps, schema_editor):
    """Reverse: optionally delete seeded services."""
    Service = apps.get_model('users', 'Service')
    services_to_delete = [
        'Administration',
        'Décanat de Médecine',
        'Décanat de Pharmacie',
        'Décanat de Dentisterie',
    ]
    Service.objects.filter(nom_service__in=services_to_delete).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_utilisateur_is_staff'),
    ]

    operations = [
        migrations.RunPython(seed_chu_services, reverse_seed),
    ]
