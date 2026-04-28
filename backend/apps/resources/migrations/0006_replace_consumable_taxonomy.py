from django.db import migrations


NEW_CONSUMABLE_CATEGORIES = [
    "Fourniture De Bureau",
    "Toners",
    "Papiers Et Enveloppes",
    "Produits Hygieniques",
    "Accessoires Electriques",
    "Accessoires Plomberies",
    "Accessoires De Sports",
    "Consommation Et Pause",
]


def forward_replace_consumable_taxonomy(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")
    Ressource = apps.get_model("resources", "Ressource")

    consumable_category, _ = Categorie.objects.get_or_create(
        nom_categorie="Consommable",
        defaults={"description": "Consommable", "actif": True},
    )

    # Remove existing links for consumables before replacing taxonomy.
    Ressource.objects.filter(id_categorie=consumable_category).update(id_sous_categorie=None)

    # Remove all old consumable subcategories.
    SousCategorie.objects.filter(id_categorie=consumable_category).delete()

    # Seed the new consumable category list.
    for name in NEW_CONSUMABLE_CATEGORIES:
        SousCategorie.objects.get_or_create(
            id_categorie=consumable_category,
            nom_sous_categorie=name,
            defaults={"description": name},
        )


def backward_restore_consumable_taxonomy(apps, schema_editor):
    # Non-destructive rollback: keep the new taxonomy as canonical.
    return


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0005_normalize_sous_categories"),
    ]

    operations = [
        migrations.RunPython(
            forward_replace_consumable_taxonomy,
            backward_restore_consumable_taxonomy,
        ),
    ]
