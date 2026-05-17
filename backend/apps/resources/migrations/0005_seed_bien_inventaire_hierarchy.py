# Generated migration to seed Bien Inventaire hierarchy with parent-child taxonomy

from django.db import migrations


def seed_bien_inventaire_hierarchy(apps, schema_editor):
    """Seed the Bien Inventaire category with parent and child sous-categories."""
    SousCategorie = apps.get_model('resources', 'SousCategorie')
    Categorie = apps.get_model('resources', 'Categorie')
    
    # Get the Bien Inventaire category
    try:
        bien_inventaire = Categorie.objects.get(nom_categorie='Bien Inventaire')
    except Categorie.DoesNotExist:
        return  # Skip if category doesn't exist
    
    # Define the hierarchy: parent -> list of children
    hierarchy = {
        'Mobilier De Bureau': [
            'Chaises', 'Tables', 'Bureaux', 'Armoires', 'Étagères',
            'Canapés', 'Fauteuils', 'Lits', 'Commodes', 'Classeurs',
            'Vestiaires', 'Porte-manteaux', 'Miroirs', 'Tableaux', 'Cadres',
            'Tapis', 'Rideaux', 'Luminaires', 'Horloges', 'Plantes',
            'Autres meubles',
        ],
        'Materiel Informatique': [
            'Ordinateurs de bureau', 'Ordinateurs portables', 'Claviers', 'Souris', 'Écrans',
            'Imprimantes', 'Scanners', 'Photocopieuses', 'Serveurs', 'Routeurs',
            'Commutateurs', 'Modems', 'Câbles réseau', 'Autres équipements informatiques',
        ],
        'Materiel Enseignement': [
            'Tableaux blancs', 'Tableaux noirs', 'Marqueurs', 'Craies', 'Effaceurs',
            'Projecteurs', 'Écrans de projection', 'Haut-parleurs', 'Microphones', 'Pupitres',
            'Diagrammes', 'Cartes',
        ],
        'Fourniture Informatique': [
            'Papier A4', 'Cartouches d\'encre', 'Toner', 'Disques durs externes', 'Clés USB',
            'Câbles USB', 'Adaptateurs', 'Souris sans fil', 'Claviers sans fil',
            'Supports de rangement', 'Enveloppes',
        ],
    }
    
    for parent_name, children_names in hierarchy.items():
        # Get or create parent
        parent, _ = SousCategorie.objects.get_or_create(
            nom_sous_categorie=parent_name,
            id_categorie=bien_inventaire,
            defaults={
                'id_parent_sous_categorie': None,
            }
        )
        
        # Create children
        for child_name in children_names:
            SousCategorie.objects.get_or_create(
                nom_sous_categorie=child_name,
                id_categorie=bien_inventaire,
                defaults={
                    'id_parent_sous_categorie': parent,
                }
            )


def reverse_seed(apps, schema_editor):
    """Remove seeded taxonomy (optional, can be no-op)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0004_souscategorie_id_parent_sous_categorie_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_bien_inventaire_hierarchy, reverse_seed),
    ]
