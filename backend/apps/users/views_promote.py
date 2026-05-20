"""One-shot view to promote admin@test.com to superuser. Remove after use."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.users.models import Utilisateur


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
