from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import LoginSerializer, UserMeSerializer


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return Response(
                {"detail": "Le refresh_token est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {"detail": "Token invalide ou expiré."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_user_with_hierarchy(self, request):
        """Re-fetch the user with hierarchy joins for the serializer."""
        from .models import Utilisateur  # noqa: PLC0415
        return Utilisateur.objects.select_related(
            "id_role", "id_service__id_batiment__id_etablissement"
        ).get(pk=request.user.pk)

    def get(self, request):
        user = self._get_user_with_hierarchy(request)
        return Response(UserMeSerializer(user).data, status=status.HTTP_200_OK)

    def patch(self, request):
        from .models import Service  # noqa: PLC0415

        user = request.user
        data = request.data or {}
        # Only allow updating safe profile fields
        allowed = {"nom_complet", "titre_poste"}
        updated = []
        for field in allowed:
            if field in data:
                setattr(user, field, str(data[field]).strip()[:200])
                updated.append(field)

        # Handle service change (cascading: sets bâtiment & établissement)
        svc_id = data.get("id_service")
        if svc_id is not None:
            try:
                svc = Service.objects.select_related("id_batiment__id_etablissement").get(pk=svc_id)
                user.id_service = svc
                updated.append("id_service_id")
            except Service.DoesNotExist:
                pass

        if updated:
            user.save(update_fields=updated)
        user = self._get_user_with_hierarchy(request)
        return Response(UserMeSerializer(user).data, status=status.HTTP_200_OK)
