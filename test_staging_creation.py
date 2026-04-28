#!/usr/bin/env python
"""
Test script to validate StagingItem creation with the new fields.
"""
import os
import django
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.procurement.models import StagingItem, ImportExcelBC
from apps.procurement.tasks.nlp_normalizer import normalize_designation

def test_staging_item_creation():
    """Test creating a StagingItem with the new fields."""
    # Get the first import for testing
    import_obj = ImportExcelBC.objects.first()
    if not import_obj:
        print("No ImportExcelBC found for testing")
        return

    # Test normalization
    normalized = normalize_designation('ordinateur portable')
    print(f"Normalized result: {normalized}")

    # Create a test StagingItem
    try:
        item = StagingItem(
            id_import=import_obj,
            designation_brute='Test ordinateur portable',
            description='Test description',
            designation_normalisee=normalized["designation_normalisee"],
            quantite=1,
            unite="U",
            prix_unitaire_ht=Decimal("100.00"),
            prix_total_ht=Decimal("100.00"),
            type_detecte=normalized.get("type_detecte", ""),
            id_categorie_suggeree=None,  # We'll set this if we have a category
            categorie_suggeree_nom=normalized.get("categorie_suggeree_nom", ""),
            sous_categorie_suggeree_nom=normalized.get("sous_categorie_suggeree_nom", ""),
            id_ressource_liee=None,
            statut="en_attente",
        )
        item.save()
        print(f"Successfully created StagingItem with ID: {item.id_staging}")
        print(f"Category name: {item.categorie_suggeree_nom}")
        print(f"Subcategory name: {item.sous_categorie_suggeree_nom}")

        # Clean up
        item.delete()
        print("Test StagingItem deleted successfully")

    except Exception as e:
        print(f"Error creating StagingItem: {e}")
        return False

    return True

if __name__ == "__main__":
    success = test_staging_item_creation()
    print(f"Test {'PASSED' if success else 'FAILED'}")