import unicodedata

from django.db import migrations


CANONICAL_PARENTS = [
    "Materiel Informatique",
    "Materiel Enseignement",
    "Mobilier De Bureau",
    "Fourniture Informatique",
]


PARENT_BY_CHILD = {
    "ordinateur de bureau": "Materiel Informatique",
    "all in one": "Materiel Informatique",
    "ordinateur portable": "Materiel Informatique",
    "imprimante": "Materiel Informatique",
    "imprimante couleur": "Materiel Informatique",
    "photocopieuse": "Materiel Informatique",
    "scanner": "Materiel Informatique",
    "appareil photo": "Materiel Informatique",
    "tablette": "Materiel Informatique",
    "scanner onduleur": "Materiel Informatique",
    "camera": "Materiel Informatique",
    "fax": "Materiel Informatique",
    "imprimante multifonction": "Materiel Informatique",
    "videoprojecteur": "Materiel Enseignement",
    "ecran de projection": "Materiel Enseignement",
    "micro cravatte": "Materiel Enseignement",
    "microbaladeur": "Materiel Enseignement",
    "tableau magnetique gf": "Materiel Enseignement",
    "tableau d'affichage gf": "Materiel Enseignement",
    "tableau magnetique pf": "Materiel Enseignement",
    "tableau magnetique mf": "Materiel Enseignement",
    "tv": "Materiel Enseignement",
    "tableau interactif": "Materiel Enseignement",
    "table d'examen": "Materiel Enseignement",
    "escabeau inox": "Materiel Enseignement",
    "chaise roulante": "Mobilier De Bureau",
    "bureau simple": "Mobilier De Bureau",
    "table basse": "Mobilier De Bureau",
    "chaise visiteur": "Mobilier De Bureau",
    "climatiseur": "Mobilier De Bureau",
    "chaise iso": "Mobilier De Bureau",
    "chaise ecritoire": "Mobilier De Bureau",
    "fauteuil president": "Mobilier De Bureau",
    "porte manteau": "Mobilier De Bureau",
    "armoire metallique gf": "Mobilier De Bureau",
    "armoire metallique pf": "Mobilier De Bureau",
    "clapet a 10 cases": "Mobilier De Bureau",
    "clapet a 4cases": "Mobilier De Bureau",
    "bain huile": "Mobilier De Bureau",
    "table": "Mobilier De Bureau",
    "tabouret": "Mobilier De Bureau",
    "refrigerateur": "Mobilier De Bureau",
    "congelateur": "Mobilier De Bureau",
    "escabeau": "Mobilier De Bureau",
    "armoire coulissante": "Mobilier De Bureau",
    "switch": "Fourniture Informatique",
    "pointeur": "Fourniture Informatique",
    "ralonge 5m": "Fourniture Informatique",
    "ralonge 5 ports": "Fourniture Informatique",
    "cable vga": "Fourniture Informatique",
    "cable hdmi": "Fourniture Informatique",
    "streaming": "Fourniture Informatique",
    "serveur": "Fourniture Informatique",
    "adaptateur": "Fourniture Informatique",
    "dd externe": "Fourniture Informatique",
    "support affiche": "Fourniture Informatique",
}


def normalize(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.lower().split())


def forwards(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    bien_category = Categorie.objects.filter(nom_categorie="Bien Inventaire").first()
    if not bien_category:
        return

    canonical_parent_by_key = {}
    for parent_name in CANONICAL_PARENTS:
        parent_obj, _ = SousCategorie.objects.get_or_create(
            id_categorie=bien_category,
            nom_sous_categorie=parent_name,
            defaults={"description": f"Categorie metier - {parent_name}"},
        )
        parent_obj.id_parent_sous_categorie = None
        parent_obj.save(update_fields=["id_parent_sous_categorie"])
        canonical_parent_by_key[normalize(parent_name)] = parent_obj

    all_subs = list(SousCategorie.objects.filter(id_categorie=bien_category))

    # Merge duplicate parent labels (accent/no-accent variants) into canonical parents.
    for sub in all_subs:
        key = normalize(sub.nom_sous_categorie)
        canonical_parent = canonical_parent_by_key.get(key)
        if not canonical_parent:
            continue
        if sub.id_sous_categorie == canonical_parent.id_sous_categorie:
            continue

        SousCategorie.objects.filter(id_parent_sous_categorie=sub).update(
            id_parent_sous_categorie=canonical_parent
        )
        sub.delete()

    all_subs = list(SousCategorie.objects.filter(id_categorie=bien_category))
    canonical_parent_ids = {parent.id_sous_categorie for parent in canonical_parent_by_key.values()}

    for sub in all_subs:
        if sub.id_sous_categorie in canonical_parent_ids:
            continue

        parent_name = PARENT_BY_CHILD.get(normalize(sub.nom_sous_categorie))
        if not parent_name:
            continue

        parent_obj = canonical_parent_by_key.get(normalize(parent_name))
        if not parent_obj:
            continue

        if sub.id_parent_sous_categorie_id != parent_obj.id_sous_categorie:
            sub.id_parent_sous_categorie = parent_obj
            sub.save(update_fields=["id_parent_sous_categorie"])


def backwards(apps, schema_editor):
    # Keep the normalized hierarchy on reverse.
    return


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0007_add_souscategorie_parent_hierarchy"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
