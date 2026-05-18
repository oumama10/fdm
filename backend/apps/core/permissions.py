from rest_framework.permissions import BasePermission


class IsGestionnaire(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "gestionnaire_magasin"
        )


class IsServiceFinanciere(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "service_financiere"
        )


class IsChefService(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "chef_service"
        )


class IsFournisseur(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "fournisseur"
        )


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "admin"
        )


class IsGestionnaireOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.id_role:
            return False
        return user.id_role.nom_role in {"gestionnaire_magasin", "admin"}


class IsGestionnaireOrFinanciereOrAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.id_role:
            return False
        return user.id_role.nom_role in {"gestionnaire_magasin", "service_financiere", "admin"}


class IsChefServiceOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return bool(request.user and request.user.is_authenticated and obj.id_chef_demandeur == request.user)


class IsFournisseurOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        fournisseur_profile = getattr(user, "fournisseur_profile", None)
        return bool(fournisseur_profile and obj.id_fournisseur == fournisseur_profile)
