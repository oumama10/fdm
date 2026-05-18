from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsGestionnaireOrFinanciereOrAdmin

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
    Permission : IsGestionnaireOrFinanciereOrAdmin (gestionnaire, financiere, admin)
    Default filter : acquitte=False (pass ?acquitte=true to include acquitted)
    """

    serializer_class = AlerteDelaiSerializer
    permission_classes = [IsGestionnaireOrFinanciereOrAdmin]
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

    @action(detail=True, methods=["patch"], url_path="acquitter")
    def acquitter(self, request, pk=None):
        """Mark an alert as acknowledged — sets acquitte=True."""
        alerte = self.get_object()
        if alerte.acquitte:
            return Response(
                {"detail": "Cette alerte est déjà acquittée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        alerte.acquitte = True
        alerte.save(update_fields=["acquitte"])
        return Response(AlerteDelaiSerializer(alerte).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# NotificationViewSet
# ---------------------------------------------------------------------------


class NotificationViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """
    Each authenticated user sees only their own notifications.

    list                             GET  /notifications/?page=1&limit=10
    unread-count                     GET  /notifications/unread-count/
    mark-all-lu                      PATCH /notifications/mark-all-lu/
    lu (mark single as read)         PATCH /notifications/{id}/lu/
    """

    serializer_class = NotificationSerializer

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated

        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Notification.objects.filter(
            destinataire=self.request.user
        ).order_by("-created_at")
        return qs

    def paginate_queryset(self, queryset):
        """Custom pagination handling for unread count"""
        limit = int(self.request.query_params.get("limit", 10))
        page = int(self.request.query_params.get("page", 1))
        start = (page - 1) * limit
        end = start + limit
        return queryset[start:end]

    def list(self, request, *args, **kwargs):
        """List notifications with optional pagination"""
        queryset = self.get_queryset()
        paginated = self.paginate_queryset(queryset)
        serializer = self.get_serializer(paginated, many=True)
        return Response(serializer.data)

    # ── unread-count ──────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = Notification.objects.filter(
            destinataire=request.user, lu=False
        ).count()
        response = Response({"count": count}, status=status.HTTP_200_OK)
        response["Cache-Control"] = "max-age=25, private"
        return response

    # ── lu (mark single as read) ──────────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="lu")
    def lu(self, request, pk=None):
        """Mark a single notification as read"""
        notif = self.get_object()
        if notif.destinataire != request.user:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )
        notif.lu = True
        notif.save(update_fields=["lu"])
        return Response(
            NotificationSerializer(notif).data, status=status.HTTP_200_OK
        )

    # ── mark-all-lu ───────────────────────────────────────────────────────────

    @action(detail=False, methods=["patch"], url_path="mark-all-lu")
    def mark_all_lu(self, request):
        """Mark all notifications as read for current user"""
        updated = Notification.objects.filter(
            destinataire=request.user, lu=False
        ).update(lu=True)
        return Response(
            {"detail": f"{updated} notification(s) marked as read."},
            status=status.HTTP_200_OK,
        )
