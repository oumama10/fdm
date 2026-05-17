from django.db import migrations


def seed_pharmacy_lab_services(apps, schema_editor):
    """Seed pharmacy and laboratory services."""
    Service = apps.get_model('users', 'Service')
    
    services_data = [
        {
            'nom_service': 'Pharmacie Centrale',
            'type_service': 'pharmacie',
            'description': 'Service de Pharmacie Centrale du CHU',
        },
        {
            'nom_service': 'Pharmacie Hospitalière',
            'type_service': 'pharmacie',
            'description': 'Service de Pharmacie Hospitalière',
        },
        {
            'nom_service': 'Laboratoire Biologie Clinique',
            'type_service': 'labo',
            'description': 'Service de Biologie Clinique',
        },
        {
            'nom_service': 'Laboratoire Microbiologie',
            'type_service': 'labo',
            'description': 'Service de Microbiologie',
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
    """Reverse: delete pharmacy and lab services."""
    Service = apps.get_model('users', 'Service')
    services_to_delete = [
        'Pharmacie Centrale',
        'Pharmacie Hospitalière',
        'Laboratoire Biologie Clinique',
        'Laboratoire Microbiologie',
    ]
    Service.objects.filter(nom_service__in=services_to_delete).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_seed_medical_departments'),
    ]

    operations = [
        migrations.RunPython(seed_pharmacy_lab_services, reverse_seed),
    ]
