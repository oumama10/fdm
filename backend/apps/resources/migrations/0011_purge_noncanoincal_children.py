from django.db import migrations

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


def purge_noncanonical_children(apps, schema_editor):
    Categorie = apps.get_model('resources', 'Categorie')
    SousCategorie = apps.get_model('resources', 'SousCategorie')

    try:
        bien_cat = Categorie.objects.get(nom_categorie='Bien Inventaire')
    except Categorie.DoesNotExist:
        return

    for root_name, canonical_children in BIEN_INVENTAIRE_CHILDREN.items():
        try:
            root_obj = SousCategorie.objects.get(
                nom_sous_categorie=root_name,
                id_categorie=bien_cat,
                id_parent_sous_categorie__isnull=True,
            )
        except SousCategorie.DoesNotExist:
            continue

        SousCategorie.objects.filter(
            id_parent_sous_categorie=root_obj,
        ).exclude(
            nom_sous_categorie__in=canonical_children,
        ).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0010_reset_full_taxonomy'),
    ]

    operations = [
        migrations.RunPython(purge_noncanonical_children, reverse_code=noop),
    ]
