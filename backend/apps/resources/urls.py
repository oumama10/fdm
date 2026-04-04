from rest_framework.routers import DefaultRouter

from .views import (
    CategorieViewSet,
    InstanceRessourceViewSet,
    MouvementStockViewSet,
    RessourceViewSet,
    SousCategorieViewSet,
    StockViewSet,
)

router = DefaultRouter()
router.register("categories", CategorieViewSet, basename="categorie")
router.register("sous-categories", SousCategorieViewSet, basename="sous-categorie")
router.register("ressources", RessourceViewSet, basename="ressource")
router.register("stocks", StockViewSet, basename="stock")
router.register("stock", StockViewSet, basename="stock-alias")
router.register("instances", InstanceRessourceViewSet, basename="instance-ressource")
router.register("mouvements", MouvementStockViewSet, basename="mouvement-stock")

urlpatterns = router.urls