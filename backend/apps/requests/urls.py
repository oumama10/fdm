from rest_framework.routers import DefaultRouter

from .views import DemandeViewSet

router = DefaultRouter()
router.register("demandes", DemandeViewSet, basename="demande")

urlpatterns = router.urls