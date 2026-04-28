from django.db import migrations


NORMALIZED_SERVICES = [
    {"nom_service": "Gastro-entero", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Pediatrie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Nephrologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Neurologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Cardiologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Pneumologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Rhumatologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Radiotherapie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Neurochirurgie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Endocrinologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Medecine interne", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Hemato-onco-pediatrique", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Dermatologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Chirurgie orthopedique", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Chirurgie pediatrique", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Gyneco 1", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Gyneco 2", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Chirurgie generale A", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Chirurgie generale B", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Medecine legale", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Oncologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Laboratoire central", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Chirurgie vasculaire", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Urgences", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Psychiatrie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Ophtalmologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Traumato-orthopedie B3", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Chirurgie thoracique", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "CCV", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Medecine nucleaire", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "ORL", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Traumato-orthopedie B4", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Medecine du travail", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Centre de diagnostic", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Urologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Nephrologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Rea-Mere-enfant", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Rea-Neonatal", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Anesth-rea A4", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Anesth-rea A1", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Radiologie", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Medecine de readaptation", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "CHOAP", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Radiologie mere-enfant", "type_service": "chu", "description": "Service du CHU normalise."},
    {"nom_service": "Decanat", "type_service": "decanat", "description": "Service FMPDF normalise."},
    {"nom_service": "VD Pedagogie", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "VD Recherche", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "VD Pharmacie", "type_service": "pharmacie", "description": "Service FMPDF normalise."},
    {"nom_service": "Sec Generale", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "RH", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "Aff Gen", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "Economie", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "Informatique", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "Scolarite", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "3e Cycle", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "SGCE", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "CDIM", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Biophysique", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Microbiologie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Biologie moleculaire", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Pharmacologie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Physiologie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Epidemiologie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Anatomie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Histologie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Anatomo-pathologie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Biochimie et chimie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Equipement", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "Labo. Hematologie", "type_service": "labo", "description": "Service FMPDF normalise."},
    {"nom_service": "Unite pharmacie", "type_service": "pharmacie", "description": "Service FMPDF normalise."},
    {"nom_service": "Unite audit", "type_service": "administratif", "description": "Service FMPDF normalise."},
    {"nom_service": "Magasin", "type_service": "administratif", "description": "Service FMPDF normalise."},
]


def normalize_key(value):
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def forwards(apps, schema_editor):
    Service = apps.get_model("users", "Service")
    existing_services = list(Service.objects.all())

    for service_data in NORMALIZED_SERVICES:
        target_key = normalize_key(service_data["nom_service"])
        matches = [service for service in existing_services if normalize_key(service.nom_service) == target_key]

        if matches:
            for service in matches:
                changed_fields = []
                if service.nom_service != service_data["nom_service"]:
                    service.nom_service = service_data["nom_service"]
                    changed_fields.append("nom_service")
                if service.type_service != service_data["type_service"]:
                    service.type_service = service_data["type_service"]
                    changed_fields.append("type_service")
                if service.description != service_data["description"]:
                    service.description = service_data["description"]
                    changed_fields.append("description")
                if changed_fields:
                    service.save(update_fields=changed_fields)
        else:
            service = Service.objects.create(**service_data)
            existing_services.append(service)


def backwards(apps, schema_editor):
    # Keep the reference data in place on reverse migration.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_utilisateur_is_staff"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
