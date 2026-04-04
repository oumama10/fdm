from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter
from django.urls import path

from .views import DechargeViewSet, SignatureDechargeViewSet

# Top-level router
router = DefaultRouter()
router.register("decharges", DechargeViewSet, basename="decharge")

# Nested: /decharges/{decharge_pk}/signature/...
signature_router = NestedDefaultRouter(router, "decharges", lookup="decharge")
signature_router.register(
    "signature",
    SignatureDechargeViewSet,
    basename="decharge-signature",
)

urlpatterns = router.urls + signature_router.urls

# Alias: /api/decharge/ → same as /api/decharge/decharges/
urlpatterns += [
    path('', DechargeViewSet.as_view({'post': 'create', 'get': 'list'})),
]