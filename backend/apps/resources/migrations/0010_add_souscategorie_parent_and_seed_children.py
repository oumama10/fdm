from django.db import migrations, models
import django.db.models.deletion
import unicodedata


BIEN_INVENTAIRE_CHILDREN = {
    "Mobilier De Bureau": [
        "Chaise roulante", "Bureau simple", "Table basse", "Chaise visiteur",
        "Climatiseur", "Chaise iso", "Chaise ecritoire", "Fauteuil president",
        "Porte manteau", "Armoire metallique GF", "Armoire metallique PF",
        "CLAPET a 10 cases", "CLAPET a 4cases", "Bain huile", "Table",
        "TABOURET", "Refrigerateur", "Congelateur", "Escabeau",
        "ARMOIRE COULISSANTE", "Armoire metallique",
    ],
    "Materiel Informatique": [
        "Ordinateur de bureau", "All In One", "Ordinateur Portable", "Imprimante",
        "Imprimante couleur", "Photocopieuse", "Scanner", "Appareil photo",
        "Tablette", "Scanner Onduleur", "CAMERA", "FAX", "Imprimante multifonction",
    ],
    "Materiel Enseignement": [
        "Videoprojecteur", "Ecran de projection", "Micro cravatte", "Microbaladeur",
        "Tableau magnetique GF", "Tableau d'affichage GF", "Tableau magnetique PF",
        "Tableau magnetique MF", "TV", "TABLEAU INTERACTIF",
        "TABLE D'EXAMEN", "ESCABEAU INOX",
    ],
    "Fourniture Informatique": [
        "Switch", "Pointeur", "Ralonge 5M", "Ralonge 5 ports",
        "Cable VGA", "Cable HDMI", "STREAMING", "SERVEUR",
        "ADAPTATEUR", "DD EXTERNE", "SUPPORT AFFICHE",
    ],
}


def _normalize(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return "".join(ch.lower() for ch in text if ch.isalnum())


def forwards(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    bien_category = Categorie.objects.filter(nom_categorie="Bien Inventaire").first()
    if not bien_category:
        return

    all_bien_subcategories = SousCategorie.objects.filter(id_categorie=bien_category)
    indexed = {_normalize(row.nom_sous_categorie): row for row in all_bien_subcategories}

    for parent_name, child_names in BIEN_INVENTAIRE_CHILDREN.items():
        parent = indexed.get(_normalize(parent_name))
        if parent is None:
            parent, _ = SousCategorie.objects.get_or_create(
                id_categorie=bien_category,
                nom_sous_categorie=parent_name,
                defaults={"description": f"Categorie metier - {parent_name}"},
            )
            indexed[_normalize(parent_name)] = parent

        if parent.id_parent_sous_categorie_id is not None:
            parent.id_parent_sous_categorie = None
            parent.save(update_fields=["id_parent_sous_categorie"])

        for child_name in child_names:
            child, _ = SousCategorie.objects.get_or_create(
                id_categorie=bien_category,
                nom_sous_categorie=child_name,
                defaults={"description": child_name},
            )
            if child.id_parent_sous_categorie_id != parent.id_sous_categorie:
                child.id_parent_sous_categorie = parent
                child.save(update_fields=["id_parent_sous_categorie"])


def backwards(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    bien_category = Categorie.objects.filter(nom_categorie="Bien Inventaire").first()
    if not bien_category:
        return

    child_names = set()
    for names in BIEN_INVENTAIRE_CHILDREN.values():
        child_names.update(names)

    SousCategorie.objects.filter(
        id_categorie=bien_category,
        nom_sous_categorie__in=child_names,
    ).update(id_parent_sous_categorie=None)


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0009_remove_id_parent_sous_categorie"),
    ]

    operations = [
        migrations.AddField(
            model_name="souscategorie",
            name="id_parent_sous_categorie",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="children",
                to="resources.souscategorie",
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
