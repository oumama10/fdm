from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DirectImportView,
    ImportExcelBCViewSet,
    LotArticleViewSet,
    MarcheBCViewSet,
    MarcheEtapeViewSet,
    StagingItemViewSet,
)

router = DefaultRouter()
router.register("marches", MarcheBCViewSet, basename="marche")
router.register("etapes", MarcheEtapeViewSet, basename="marche-etape")
router.register("import", ImportExcelBCViewSet, basename="import-excel")
router.register("staging", StagingItemViewSet, basename="staging-item")
router.register("lots", LotArticleViewSet, basename="lot-article")

urlpatterns = [
    path("import/direct/", DirectImportView.as_view(), name="import-direct"),
] + router.urls