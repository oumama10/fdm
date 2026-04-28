from django.db import migrations

CATEGORY_TAXONOMY = {
    "Consommable": [
        "Fournitures de bureau & Informatique",
        "Produits d'entretien & Hygiène",
        "Atelier & Production",
        "Emballages",
        "Médical",
    ],
    "Bien Inventaire": [
        "Mobilier De Bureau",
        "Materiel Informatique",
        "Materiel Enseignement",
        "Fourniture Informatique",
    ],
}


def seed_taxonomy(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    for category_name, subcategories in CATEGORY_TAXONOMY.items():
        category_obj, _ = Categorie.objects.get_or_create(
            nom_categorie=category_name,
            defaults={"description": category_name, "actif": True},
        )
        for subcategory_name in subcategories:
            SousCategorie.objects.get_or_create(
                id_categorie=category_obj,
                nom_sous_categorie=subcategory_name,
                defaults={"description": f"Taxonomy seed for {category_name}"},
            )


def unseed_taxonomy(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    for category_name, subcategories in CATEGORY_TAXONOMY.items():
        try:
            category_obj = Categorie.objects.get(nom_categorie=category_name)
        except Categorie.DoesNotExist:
            continue
        SousCategorie.objects.filter(
            id_categorie=category_obj,
            nom_sous_categorie__in=subcategories,
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("resources", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(seed_taxonomy, unseed_taxonomy),
    ]
