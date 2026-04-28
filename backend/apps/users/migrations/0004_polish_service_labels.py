import unicodedata

from django.db import migrations


NORMALIZED_SERVICES = [
    {"nom_service": "Gastro-entérologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Pédiatrie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Néphrologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Neurologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Cardiologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Pneumologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Rhumatologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Radiothérapie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Neurochirurgie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Endocrinologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Médecine interne", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Hémato-onco-pédiatrique", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Dermatologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Chirurgie orthopédique", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Chirurgie pédiatrique", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Gynéco 1", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Gynéco 2", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Chirurgie générale A", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Chirurgie générale B", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Médecine légale", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Oncologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Laboratoire central", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Chirurgie vasculaire", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Urgences", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Psychiatrie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Ophtalmologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Traumato-orthopédie B3", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Chirurgie thoracique", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "CCV", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Médecine nucléaire", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "ORL", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Traumato-orthopédie B4", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Médecine du travail", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Centre de diagnostic", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Urologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Réa-Mère-Enfant", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Réa-Néonatal", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Anesth-Réa A4", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Anesth-Réa A1", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Radiologie", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Médecine de réadaptation", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "CHOAP", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Radiologie mère-enfant", "type_service": "chu", "description": "Service du CHU normalisé."},
    {"nom_service": "Décanat", "type_service": "decanat", "description": "Service FMPDF normalisé."},
    {"nom_service": "VD Pédagogie", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "VD Recherche", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "VD Pharmacie", "type_service": "pharmacie", "description": "Service FMPDF normalisé."},
    {"nom_service": "Secrétariat général", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "RH", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "Aff. Gen.", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "Économie", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "Informatique", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "Scolarité", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "3e Cycle", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "SGCE", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "CDIM", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Biophysique", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Microbiologie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Biologie moléculaire", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Pharmacologie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Physiologie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Épidémiologie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Anatomie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Histologie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Anatomo-pathologie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Biochimie et chimie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Équipement", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "Labo. Hématologie", "type_service": "labo", "description": "Service FMPDF normalisé."},
    {"nom_service": "Unité pharmacie", "type_service": "pharmacie", "description": "Service FMPDF normalisé."},
    {"nom_service": "Unité audit", "type_service": "administratif", "description": "Service FMPDF normalisé."},
    {"nom_service": "Magasin", "type_service": "administratif", "description": "Service FMPDF normalisé."},
]


def normalize_key(value):
    normalized = unicodedata.normalize("NFD", str(value).lower())
    return "".join(ch for ch in normalized if ch.isalnum() and unicodedata.category(ch) != "Mn")


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
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_seed_normalized_services"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
