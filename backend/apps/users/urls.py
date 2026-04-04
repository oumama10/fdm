from django.urls import path
from rest_framework.routers import DefaultRouter

from .views_auth import LoginView, LogoutView, MeView, RefreshView
from .views import (
	FournisseurViewSet,
	JournalAuditViewSet,
	RoleViewSet,
	ServiceViewSet,
	UtilisateurViewSet,
)


router = DefaultRouter()
router.register("utilisateurs", UtilisateurViewSet, basename="utilisateur")
router.register("services", ServiceViewSet, basename="service")
router.register("roles", RoleViewSet, basename="role")
router.register("journal-audit", JournalAuditViewSet, basename="journal-audit")
router.register("fournisseurs", FournisseurViewSet, basename="fournisseur")


urlpatterns = [
	path("login/", LoginView.as_view(), name="auth-login"),
	path("refresh/", RefreshView.as_view(), name="auth-refresh"),
	path("logout/", LogoutView.as_view(), name="auth-logout"),
	path("me/", MeView.as_view(), name="auth-me"),
] + router.urls