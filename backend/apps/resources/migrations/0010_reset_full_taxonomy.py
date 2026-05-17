from django.db import migrations

CONSOMMABLE_CATS = [
    'Fourniture De Bureau',
    'Toners',
    'Papiers Et Enveloppes',
    'Produits Hygieniques',
    'Accessoires Electriques',
    'Accessoires Plomberies',
    'Accessoires De Sports',
    'Consommation Et Pause',
]

BIEN_ROOTS = [
    'Mobilier De Bureau',
    'Materiel Informatique',
    'Materiel Enseignement',
    'Fourniture Informatique',
]

BIEN_INVENTAIRE_CHILDREN = {
    'Mobilier De Bureau': [
        'Chaise roulante', 'Bureau simple', 'Table basse', 'Chaise visiteur',
        'Climatiseur', 'Chaise iso', 'Chaise ecritoire', 'Fauteuil president',
        'Porte manteau', 'Armoire metallique GF', 'Armoire metallique PF',
        'CLAPET a 10 cases', 'CLAPET a 4cases', 'Bain huile', 'Table',
        'TABOURET', 'Refrigerateur', 'Congelateur', 'Escabeau',
        'ARMOIRE COULISSANTE', 'Armoire metallique',
    ],
    'Materiel Informatique': [
        'Ordinateur de bureau', 'All In One', 'Ordinateur Portable', 'Imprimante',
        'Imprimante couleur', 'Photocopieuse', 'Scanner', 'Appareil photo',
        'Tablette', 'Scanner Onduleur', 'CAMERA', 'FAX', 'Imprimante multifonction',
    ],
    'Materiel Enseignement': [
        'Videoprojecteur', 'Ecran de projection', 'Micro cravatte', 'Microbaladeur',
        'Tableau magnetique GF', "Tableau d'affichage GF", 'Tableau magnetique PF',
        'Tableau magnetique MF', 'TV', 'TABLEAU INTERACTIF',
        "TABLE D'EXAMEN", 'ESCABEAU INOX',
    ],
    'Fourniture Informatique': [
        'Switch', 'Pointeur', 'Ralonge 5M', 'Ralonge 5 ports',
        'Cable VGA', 'Cable HDMI', 'STREAMING', 'SERVEUR',
        'ADAPTATEUR', 'DD EXTERNE', 'SUPPORT AFFICHE',
    ],
}


def seed_taxonomy(apps, schema_editor):
    Categorie = apps.get_model('resources', 'Categorie')
    SousCategorie = apps.get_model('resources', 'SousCategorie')

    # A. Ensure root categories exist
    consommable_cat, _ = Categorie.objects.get_or_create(nom_categorie='Consommable')
    bien_cat, _ = Categorie.objects.get_or_create(nom_categorie='Bien Inventaire')

    # B. Reset Consommable sous-categories to exactly the 8 canonical entries
    for name in CONSOMMABLE_CATS:
        SousCategorie.objects.get_or_create(
            nom_sous_categorie=name,
            id_categorie=consommable_cat,
            id_parent_sous_categorie=None,
        )
    SousCategorie.objects.filter(
        id_categorie=consommable_cat,
    ).exclude(nom_sous_categorie__in=CONSOMMABLE_CATS).delete()

    # C. Ensure Bien Inventaire parent roots (no parent)
    root_objs = {}
    for name in BIEN_ROOTS:
        root_obj, _ = SousCategorie.objects.get_or_create(
            nom_sous_categorie=name,
            id_categorie=bien_cat,
            id_parent_sous_categorie=None,
        )
        root_objs[name] = root_obj

    # D. Seed children under each root
    for parent_name, children in BIEN_INVENTAIRE_CHILDREN.items():
        parent_obj = root_objs[parent_name]
        for child in children:
            SousCategorie.objects.get_or_create(
                nom_sous_categorie=child,
                id_categorie=bien_cat,
                id_parent_sous_categorie=parent_obj,
            )

    # E. Delete orphan Bien Inventaire roots not in BIEN_ROOTS
    SousCategorie.objects.filter(
        id_categorie=bien_cat,
        id_parent_sous_categorie__isnull=True,
    ).exclude(nom_sous_categorie__in=BIEN_ROOTS).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0009_alter_instanceressource_numero_inventaire'),
    ]

    operations = [
        migrations.RunPython(seed_taxonomy, reverse_code=noop),
    ]
