from django.db import migrations


def seed_medical_departments(apps, schema_editor):
    """Seed medical department services (CHU type)."""
    Service = apps.get_model('users', 'Service')
    
    services_data = [
        {
            'nom_service': 'CHU - Médecine Interne',
            'type_service': 'chu',
            'description': 'Service de Médecine Interne',
        },
        {
            'nom_service': 'CHU - Urgences',
            'type_service': 'chu',
            'description': 'Service des Urgences',
        },
        {
            'nom_service': 'CHU - Chirurgie',
            'type_service': 'chu',
            'description': 'Service de Chirurgie',
        },
        {
            'nom_service': 'CHU - Pédiatrie',
            'type_service': 'chu',
            'description': 'Service de Pédiatrie',
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
    """Reverse: delete medical department services."""
    Service = apps.get_model('users', 'Service')
    services_to_delete = [
        'CHU - Médecine Interne',
        'CHU - Urgences',
        'CHU - Chirurgie',
        'CHU - Pédiatrie',
    ]
    Service.objects.filter(nom_service__in=services_to_delete).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_seed_chu_services'),
    ]

    operations = [
        migrations.RunPython(seed_medical_departments, reverse_seed),
    ]
