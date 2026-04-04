from rest_framework.routers import DefaultRouter

from .views import RetourMaterielViewSet

router = DefaultRouter()
router.register("retours", RetourMaterielViewSet, basename="retour-materiel")

urlpatterns = router.urls