from rest_framework.routers import DefaultRouter

from .views import AlerteDelaiViewSet, NotificationViewSet

router = DefaultRouter()
router.register("alertes", AlerteDelaiViewSet, basename="alerte-delai")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls