#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.resources.models import Categorie, Ressource, Stock, InstanceRessource

print("Categories:")
for cat in Categorie.objects.all():
    print(f"  {cat.nom_categorie}")

print("\nRessources:")
for res in Ressource.objects.all():
    print(f"  {res.designation} - Category: {res.id_categorie.nom_categorie if res.id_categorie else 'None'} - is_consommable: {res.is_consommable}")

print(f"\nStock count: {Stock.objects.count()}")
print(f"InstanceRessource count: {InstanceRessource.objects.count()}")