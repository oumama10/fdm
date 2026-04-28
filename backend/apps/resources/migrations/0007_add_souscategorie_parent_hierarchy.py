from django.db import migrations, models
import django.db.models.deletion


BIEN_PARENT_CHILDREN = {
    "Materiel Informatique": [
        "Ordinateur de bureau",
        "All In One",
        "Ordinateur Portable",
        "Imprimante",
        "Imprimante couleur",
        "Photocopieuse",
        "Scanner",
        "Appareil photo",
        "Tablette",
        "Scanner Onduleur",
        "CAMERA",
        "FAX",
        "Imprimante multifonction",
    ],
    "Materiel Enseignement": [
        "Videoprojecteur",
        "Ecran de projection",
        "Micro cravatte",
        "Microbaladeur",
        "Tableau magnetique GF",
        "Tableau d'affichage GF",
        "Tableau magnetique PF",
        "Tableau magnetique MF",
        "TV",
        "TABLEAU INTERACTIF",
        "TABLE D'EXAMEN",
        "ESCABEAU INOX",
    ],
    "Mobilier De Bureau": [
        "Chaise roulante",
        "Bureau simple",
        "Table basse",
        "Chaise visiteur",
        "Climatiseur",
        "Chaise iso",
        "Chaise ecritoire",
        "Fauteuil president",
        "Porte manteau",
        "Armoire metallique GF",
        "Armoire metallique PF",
        "CLAPET a 10 cases",
        "CLAPET a 4cases",
        "Bain huile",
        "Table",
        "TABOURET",
        "Refrigerateur",
        "Congelateur",
        "Escabeau",
        "ARMOIRE COULISSANTE",
        "Armoire metallique GF",
        "Armoire metallique PF",
        "Armoire metallique",
    ],
    "Fourniture Informatique": [
        "Switch",
        "Pointeur",
        "Ralonge 5M",
        "Ralonge 5 ports",
        "Cable VGA",
        "Cable HDMI",
        "STREAMING",
        "SERVEUR",
        "ADAPTATEUR",
        "DD EXTERNE",
        "SUPPORT AFFICHE",
    ],
}


def normalize(value):
    return "".join(ch.lower() for ch in str(value or "") if ch.isalnum())


def forwards(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    bien_category = Categorie.objects.filter(nom_categorie="Bien Inventaire").first()
    if not bien_category:
        return

    # Create parent nodes under Bien Inventaire if they do not exist.
    parent_by_key = {}
    for parent_name in BIEN_PARENT_CHILDREN.keys():
        parent_obj, _ = SousCategorie.objects.get_or_create(
            id_categorie=bien_category,
            nom_sous_categorie=parent_name,
            defaults={
                "description": f"Categorie metier - {parent_name}",
                "id_parent_sous_categorie": None,
            },
        )
        parent_by_key[normalize(parent_name)] = parent_obj

    # Link known leaf nodes to their business parent.
    all_bien_subcategories = SousCategorie.objects.filter(id_categorie=bien_category)
    indexed = {normalize(row.nom_sous_categorie): row for row in all_bien_subcategories}

    for parent_name, child_names in BIEN_PARENT_CHILDREN.items():
        parent_obj = parent_by_key.get(normalize(parent_name))
        if not parent_obj:
            continue
        for child_name in child_names:
            child_obj = indexed.get(normalize(child_name))
            if not child_obj:
                continue
            if child_obj.id_sous_categorie == parent_obj.id_sous_categorie:
                continue
            child_obj.id_parent_sous_categorie = parent_obj
            child_obj.save(update_fields=["id_parent_sous_categorie"])


def backwards(apps, schema_editor):
    SousCategorie = apps.get_model("resources", "SousCategorie")
    SousCategorie.objects.update(id_parent_sous_categorie=None)


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0006_replace_consumable_taxonomy"),
    ]

    operations = [
        migrations.AddField(
            model_name="souscategorie",
            name="id_parent_sous_categorie",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="enfants",
                to="resources.souscategorie",
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
