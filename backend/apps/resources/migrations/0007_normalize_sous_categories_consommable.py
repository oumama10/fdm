from django.db import migrations


def normalize_sous_categories(apps, schema_editor):
    """Normalize SousCategories: ensure proper hierarchy and categorization."""
    SousCategorie = apps.get_model('resources', 'SousCategorie')
    Categorie = apps.get_model('resources', 'Categorie')
    
    # Get or create the two main categories
    consommable, _ = Categorie.objects.get_or_create(
        nom_categorie='Consommable',
        defaults={'description': 'Consommable products', 'actif': True}
    )
    
    bien_inventaire, _ = Categorie.objects.get_or_create(
        nom_categorie='Bien Inventaire',
        defaults={'description': 'Inventory assets', 'actif': True}
    )
    
    # Normalize Consommable category: create default hierarchy if needed
    consommable_hierarchy = {
        'Fournitures Médicales': [
            'Seringues et aiguilles',
            'Gants médicaux',
            'Masques',
            'Désinfectants',
            'Pansements',
            'Produits de stérilisation',
            'Autres fournitures médicales',
        ],
        'Fournitures de Bureau': [
            'Papier et cartons',
            'Stylos et crayons',
            'Dossiers et classeurs',
            'Agrafes et trombones',
            'Adhésifs',
            'Correcteurs',
            'Autres fournitures de bureau',
        ],
        'Produits de Nettoyage': [
            'Détergents',
            'Désinfectants',
            'Savons',
            'Essuie-tout',
            'Serviettes hygiéniques',
            'Sacs poubelles',
            'Autres produits de nettoyage',
        ],
        'Fournitures de Laboratoire': [
            'Tubes à essai',
            'Lames de microscope',
            'Solutions de test',
            'Réactifs',
            'Milieux de culture',
            'Conteneurs stériles',
            'Autres fournitures de laboratoire',
        ],
    }
    
    for parent_name, children_names in consommable_hierarchy.items():
        # Get or create parent under Consommable
        parent, _ = SousCategorie.objects.get_or_create(
            nom_sous_categorie=parent_name,
            id_categorie=consommable,
            defaults={
                'id_parent_sous_categorie': None,
                'description': f'Catégorie: {parent_name}',
            }
        )
        
        # Create children
        for child_name in children_names:
            SousCategorie.objects.get_or_create(
                nom_sous_categorie=child_name,
                id_categorie=consommable,
                defaults={
                    'id_parent_sous_categorie': parent,
                    'description': f'Sous-catégorie: {child_name}',
                }
            )


def reverse_normalize(apps, schema_editor):
    """Reverse normalization (optional, can be no-op)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0006_normalize_bien_inventaire_hierarchy'),
    ]

    operations = [
        migrations.RunPython(normalize_sous_categories, reverse_normalize),
    ]
