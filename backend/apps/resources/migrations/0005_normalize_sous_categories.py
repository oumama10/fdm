from django.db import migrations

from apps.resources.utils import normalize_key, normalize_sous_categorie_name


def normalize_and_dedupe_sous_categories(apps, schema_editor):
    Ressource = apps.get_model("resources", "Ressource")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    seen = {}

    for sous_categorie in SousCategorie.objects.select_related("id_categorie").order_by(
        "id_categorie_id",
        "id_sous_categorie",
    ):
        canonical_name = normalize_sous_categorie_name(sous_categorie.nom_sous_categorie)
        canonical_key = (sous_categorie.id_categorie_id, normalize_key(canonical_name))
        existing = seen.get(canonical_key)

        if existing is not None:
            Ressource.objects.filter(id_sous_categorie=sous_categorie).update(
                id_sous_categorie=existing
            )
            sous_categorie.delete()
            continue

        if sous_categorie.nom_sous_categorie != canonical_name:
            sous_categorie.nom_sous_categorie = canonical_name
            sous_categorie.save(update_fields=["nom_sous_categorie"])

        seen[canonical_key] = sous_categorie


class Migration(migrations.Migration):
    dependencies = [
        ("resources", "0004_backfill_instance_acquisition_date"),
    ]

    operations = [
        migrations.RunPython(normalize_and_dedupe_sous_categories, migrations.RunPython.noop),
    ]