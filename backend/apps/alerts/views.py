from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import (
    IsGestionnaireOrAdmin,
    IsServiceFinanciere,
)

from .models import AlerteDelai, Notification
from .serializers import AlerteDelaiSerializer, NotificationSerializer


# ---------------------------------------------------------------------------
# AlerteDelaiViewSet
# ---------------------------------------------------------------------------


class AlerteDelaiViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Read + acquitte patch.  No create or destroy via API.
    Permission : IsGestionnaireOrAdmin | IsServiceFinanciere
    Default filter : acquitte=False (pass ?acquitte=true to include acquitted)
    """

    serializer_class = AlerteDelaiSerializer
    permission_classes = [(IsGestionnaireOrAdmin | IsServiceFinanciere)]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = AlerteDelai.objects.select_related("id_marche").all()

        # Default to non-acquitted only; pass ?acquitte=true to see all
        acquitte_param = self.request.query_params.get("acquitte", "false").lower()
        if acquitte_param != "true":
            qs = qs.filter(acquitte=False)

        # Optional filters
        if niveau := self.request.query_params.get("niveau_alerte"):
            qs = qs.filter(niveau_alerte=niveau)
        if id_marche := self.request.query_params.get("id_marche"):
            qs = qs.filter(id_marche=id_marche)

        return qs.order_by("date_echeance")

    def perform_update(self, serializer):
        # Only the `acquitte` field should be writable via this endpoint;
        # the serializer marks all other fields as read_only.
        serializer.save()


# ---------------------------------------------------------------------------
# NotificationViewSet
# ---------------------------------------------------------------------------


class NotificationViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """
    Each authenticated user sees only their own notifications.

    list                             GET  /notifications/
    marquer_lu                       POST /notifications/{id}/marquer_lu/
    tout_marquer_lu                  POST /notifications/tout_marquer_lu/
    """

    serializer_class = NotificationSerializer

    def get_permissions(self):
        # Any authenticated user may manage their own notifications.
        from rest_framework.permissions import IsAuthenticated  # noqa: PLC0415

        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Notification.objects.filter(
            id_destinataire=self.request.user
        ).select_related("content_type").order_by("-date_envoi")

        # Optional: ?lu=true/false  to filter read/unread
        lu_param = self.request.query_params.get("lu")
        if lu_param is not None:
            qs = qs.filter(lu=lu_param.lower() == "true")

        return qs

    # ── marquer_lu ────────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="marquer_lu")
    def marquer_lu(self, request, pk=None):
        notif = self.get_object()
        if not notif.lu:
            notif.lu = True
            notif.date_lecture = timezone.now()
            notif.save(update_fields=["lu", "date_lecture"])
        return Response(
            NotificationSerializer(notif).data, status=status.HTTP_200_OK
        )

    # ── tout_marquer_lu ───────────────────────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="tout_marquer_lu")
    def tout_marquer_lu(self, request):
        updated = Notification.objects.filter(
            id_destinataire=request.user, lu=False
        ).update(lu=True, date_lecture=timezone.now())
        return Response(
            {"detail": f"{updated} notification(s) marquée(s) comme lues."},
            status=status.HTTP_200_OK,
        )
