import unicodedata

from django.db import migrations


def normalize_key(value):
    normalized = unicodedata.normalize("NFD", str(value).lower())
    return "".join(ch for ch in normalized if ch.isalnum() and unicodedata.category(ch) != "Mn")


def has_accent(value):
    return any(ord(ch) > 127 for ch in str(value))


def forwards(apps, schema_editor):
    Service = apps.get_model("users", "Service")
    Utilisateur = apps.get_model("users", "Utilisateur")
    Demande = apps.get_model("requests", "Demande")
    InstanceRessource = apps.get_model("resources", "InstanceRessource")

    services = list(Service.objects.all())
    grouped = {}
    for service in services:
        grouped.setdefault(normalize_key(service.nom_service), []).append(service)

    for services_group in grouped.values():
        if len(services_group) < 2:
            continue

        canonical = sorted(
            services_group,
            key=lambda service: (
                0 if has_accent(service.nom_service) else 1,
                len(str(service.nom_service)),
                service.id_service,
            ),
        )[0]
        duplicate_ids = [service.id_service for service in services_group if service.id_service != canonical.id_service]

        if not duplicate_ids:
            continue

        Utilisateur.objects.filter(id_service_id__in=duplicate_ids).update(id_service=canonical)
        Demande.objects.filter(id_service_id__in=duplicate_ids).update(id_service=canonical)
        InstanceRessource.objects.filter(id_service_actuel_id__in=duplicate_ids).update(id_service_actuel=canonical)

        Service.objects.filter(id_service__in=duplicate_ids).delete()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0005_dedupe_services"),
        ("requests", "0002_initial"),
        ("resources", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
