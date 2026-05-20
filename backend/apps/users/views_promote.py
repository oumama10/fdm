"""Temporary utility views for seeding test data. Remove after use."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.users.models import Beneficiaire, Service, Utilisateur


@api_view(["POST"])
@permission_classes([AllowAny])
def promote_admin(request):
    try:
        user = Utilisateur.objects.get(email="admin@test.com")
        user.is_superuser = True
        user.is_staff = True
        user.save(update_fields=["is_superuser", "is_staff"])
        return Response({"detail": "admin@test.com promoted to superuser."})
    except Utilisateur.DoesNotExist:
        return Response({"detail": "User not found."}, status=404)


@api_view(["POST"])
@permission_classes([AllowAny])
def seed_personnel_beneficiaire(request):
    """Create a 'personnel' beneficiaire for service_id in the request."""
    service_id = request.data.get("id_service", 1)
    try:
        svc = Service.objects.get(pk=service_id)
    except Service.DoesNotExist:
        return Response({"detail": f"Service {service_id} not found."}, status=404)

    obj, created = Beneficiaire.objects.get_or_create(
        role_type="personnel",
        id_service=svc,
        defaults={"nom": f"Personnel - {svc.nom_service}"},
    )
    return Response({
        "detail": f"Beneficiaire personnel {'created' if created else 'already exists'}.",
        "id": obj.id_beneficiaire,
        "nom": obj.nom,
        "role_type": obj.role_type,
    })
