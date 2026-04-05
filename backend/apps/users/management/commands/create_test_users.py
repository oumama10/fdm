from django.core.management.base import BaseCommand
from apps.users.models import Utilisateur, Role, Service

class Command(BaseCommand):
    help = 'Create test users for all roles'

    def handle(self, *args, **options):
        # Create roles
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

        # Create a default service
        service, _ = Service.objects.get_or_create(
            nom_service="Administration",
            defaults={"type_service": "administratif", "description": "Default admin service"}
        )

        # User data
        users_data = [
            ("financiere@test.com", "financiere123", "Alice Financière", "service_financiere"),
            ("gestionnaire@test.com", "gestionnaire123", "Bob Gestionnaire", "gestionnaire_magasin"),
            ("chef@test.com", "chef123", "Charlie Chef", "chef_service"),
            ("admin@test.com", "admin123", "Admin User", "admin"),
            ("fournisseur@test.com", "fournisseur123", "David Fournisseur", "fournisseur"),
        ]

        self.stdout.write("\n" + "="*60)
        self.stdout.write("CREATING TEST USERS FOR ALL ROLES")
        self.stdout.write("="*60 + "\n")

        for email, password, nom_complet, role_name in users_data:
            Utilisateur.objects.filter(email=email).delete()
            user = Utilisateur.objects.create_user(
                email=email,
                password=password,
                nom_complet=nom_complet,
                id_role=roles[role_name],
                id_service=service if role_name != "fournisseur" else None,
                is_staff=(role_name == "admin")
            )
            self.stdout.write(self.style.SUCCESS(f"✓ {role_name.upper()}"))
            self.stdout.write(f"  Email:    {email}")
            self.stdout.write(f"  Password: {password}")
            self.stdout.write(f"  Name:     {nom_complet}\n")

        self.stdout.write("="*60)
        self.stdout.write(self.style.SUCCESS("ALL USERS CREATED SUCCESSFULLY!"))
        self.stdout.write("="*60 + "\n")
