#!/usr/bin/env python
import os
import sys
import django

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.users.models import Utilisateur, Role, Service

# Ensure all roles exist
roles_data = [
    ("service_financiere", "Financial Service"),
    ("gestionnaire_magasin", "Warehouse Manager"),
    ("chef_service", "Service Chief"),
    ("admin", "Administrator"),
    ("fournisseur", "Supplier"),
]

roles = {}
for role_name, desc in roles_data:
    role, _ = Role.objects.get_or_create(nom_role=role_name, defaults={"description": desc})
    roles[role_name] = role

# Create a default service for staff users
service, _ = Service.objects.get_or_create(
    nom_service="Administration",
    defaults={"type_service": "administratif", "description": "Default admin service"}
)

# User data: (email, password, nom_complet, role_name)
users_data = [
    ("financiere@test.com", "financiere123", "Alice Financière", "service_financiere"),
    ("gestionnaire@test.com", "gestionnaire123", "Bob Gestionnaire", "gestionnaire_magasin"),
    ("chef@test.com", "chef123", "Charlie Chef", "chef_service"),
    ("admin@test.com", "admin123", "Admin User", "admin"),
    ("fournisseur@test.com", "fournisseur123", "David Fournisseur", "fournisseur"),
]

print("\n" + "="*50)
print("CREATING TEST USERS FOR ALL ROLES")
print("="*50 + "\n")

for email, password, nom_complet, role_name in users_data:
    # Delete if exists
    Utilisateur.objects.filter(email=email).delete()
    
    # Create user
    user = Utilisateur.objects.create_user(
        email=email,
        password=password,
        nom_complet=nom_complet,
        id_role=roles[role_name],
        id_service=service if role_name != "fournisseur" else None,
        is_staff=(role_name == "admin")
    )
    print(f"[OK] {role_name.upper()}")
    print(f"  Email:    {email}")
    print(f"  Password: {password}")
    print(f"  Name:     {nom_complet}\n")

print("="*50)
print("ALL USERS CREATED SUCCESSFULLY!")
print("="*50 + "\n")
