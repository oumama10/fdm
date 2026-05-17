from django.db import migrations


def normalize_bien_inventaire_hierarchy(apps, schema_editor):
    Categorie = apps.get_model("resources", "Categorie")
    SousCategorie = apps.get_model("resources", "SousCategorie")

    bien_inventaire, _ = Categorie.objects.get_or_create(nom_categorie="Bien Inventaire")

    hierarchy = {
        "Mobilier De Bureau": [
            "Chaises",
            "Tables",
            "Bureaux",
            "Armoires",
            "Etagères",
            "Canapés",
            "Fauteuils",
            "Lits",
            "Commodes",
            "Classeurs",
            "Vestiaires",
            "Porte-manteaux",
            "Miroirs",
            "Tableaux",
            "Cadres",
            "Tapis",
            "Rideaux",
            "Luminaires",
            "Horloges",
            "Plantes",
            "Autres meubles",
        ],
        "Materiel Informatique": [
            "Ordinateurs de bureau",
            "Ordinateurs portables",
            "Claviers",
            "Souris",
            "Ecrans",
            "Imprimantes",
            "Scanners",
            "Photocopieuses",
            "Serveurs",
            "Routeurs",
            "Commutateurs",
            "Modems",
            "Cables réseau",
        ],
        "Materiel Enseignement": [
            "Tableaux blancs",
            "Tableaux noirs",
            "Marqueurs",
            "Craies",
            "Effaceurs",
            "Projecteurs",
            "Ecrans de projection",
            "Haut-parleurs",
            "Microphones",
            "Pupitres",
            "Diagrammes",
            "Cartes",
        ],
        "Fourniture Informatique": [
            "Papier A4",
            "Cartouches d'encre",
            "Toner",
            "Disques durs externes",
            "Clés USB",
            "Cables USB",
            "Adaptateurs",
            "Souris sans fil",
            "Claviers sans fil",
            "Supports de rangement",
            "Enveloppes",
        ],
    }

    parent_by_name = {}
    expected_pairs = set()

    for parent_name, children in hierarchy.items():
        parent, _ = SousCategorie.objects.get_or_create(
            id_categorie=bien_inventaire,
            nom_sous_categorie=parent_name,
            defaults={"id_parent_sous_categorie": None},
        )
        if parent.id_parent_sous_categorie_id is not None:
            parent.id_parent_sous_categorie = None
            parent.save(update_fields=["id_parent_sous_categorie"])

        parent_by_name[parent_name] = parent

        for child_name in children:
            child, _ = SousCategorie.objects.get_or_create(
                id_categorie=bien_inventaire,
                nom_sous_categorie=child_name,
                defaults={"id_parent_sous_categorie": parent},
            )
            if child.id_parent_sous_categorie_id != parent.id_sous_categorie:
                child.id_parent_sous_categorie = parent
                child.save(update_fields=["id_parent_sous_categorie"])
            expected_pairs.add((child.id_sous_categorie, parent.id_sous_categorie))

    # Orphan cleanup:
    # - Any BI child without a valid BI parent becomes a root.
    # - Any BI child under taxonomy parents but not in expected lists is removed.
    parent_ids = {parent.id_sous_categorie for parent in parent_by_name.values()}

    SousCategorie.objects.filter(
        id_categorie=bien_inventaire,
        id_parent_sous_categorie__isnull=False,
    ).exclude(
        id_parent_sous_categorie__id_categorie=bien_inventaire
    ).update(id_parent_sous_categorie=None)

    for orphan in SousCategorie.objects.filter(
        id_categorie=bien_inventaire,
        id_parent_sous_categorie_id__in=parent_ids,
    ):
        pair = (orphan.id_sous_categorie, orphan.id_parent_sous_categorie_id)
        if pair not in expected_pairs:
            orphan.delete()


def reverse_normalize_bien_inventaire_hierarchy(apps, schema_editor):
    # Keep data on rollback.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0005_seed_bien_inventaire_hierarchy"),
    ]

    operations = [
        migrations.RunPython(
            normalize_bien_inventaire_hierarchy,
            reverse_normalize_bien_inventaire_hierarchy,
        ),
    ]
