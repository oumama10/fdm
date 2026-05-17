from django.db import migrations


def seed_dentistry_services(apps, schema_editor):
    """Seed dentistry and dental services."""
    Service = apps.get_model('users', 'Service')
    
    services_data = [
        {
            'nom_service': 'Dentisterie Clinique',
            'type_service': 'dentaire',
            'description': 'Service de Dentisterie Clinique',
        },
        {
            'nom_service': 'Dentisterie Conservatrice',
            'type_service': 'dentaire',
            'description': 'Service de Dentisterie Conservatrice et Esthétique',
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
    """Reverse: delete dentistry services."""
    Service = apps.get_model('users', 'Service')
    services_to_delete = [
        'Dentisterie Clinique',
        'Dentisterie Conservatrice',
    ]
    Service.objects.filter(nom_service__in=services_to_delete).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_seed_pharmacy_lab_services'),
    ]

    operations = [
        migrations.RunPython(seed_dentistry_services, reverse_seed),
    ]
