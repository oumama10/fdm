from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Batiment,
    Beneficiaire,
    Etablissement,
    Fournisseur,
    Permission,
    Role,
    RolePermission,
    Service,
    Utilisateur,
)


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id_role", "nom_role", "description"]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id_permission", "module", "action", "description"]


class RolePermissionSerializer(serializers.ModelSerializer):
    id_role = RoleSerializer(read_only=True)
    id_permission = PermissionSerializer(read_only=True)

    class Meta:
        model = RolePermission
        fields = ["id_role", "id_permission", "accorde"]


class EtablissementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Etablissement
        fields = ["id_etablissement", "nom"]


class BatimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batiment
        fields = ["id_batiment", "nom", "id_etablissement"]


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "id_service",
            "nom_service",
            "type_service",
            "description",
            "lettre_nomination_chef",
            "id_batiment",
        ]


class BeneficiaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Beneficiaire
        fields = ["id_beneficiaire", "nom", "role_type", "id_service"]


class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = [
            "id_fournisseur",
            "nom_societe",
            "nom_responsable",
            "email",
            "telephone",
            "adresse",
            "evaluation",
        ]


class UtilisateurSerializer(serializers.ModelSerializer):
    id_role = RoleSerializer(read_only=True)
    id_service = ServiceSerializer(read_only=True)
    fournisseur_profile = FournisseurSerializer(read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id_utilisateur",
            "nom_complet",
            "email",
            "actif",
            "titre_poste",
            "date_creation",
            "id_role",
            "id_service",
            "fournisseur_profile",
            "is_gestionnaire",
            "is_chef_service",
            "is_financiere",
            "is_admin",
        ]
        read_only_fields = [
            "id_utilisateur",
            "date_creation",
            "id_role",
            "id_service",
            "fournisseur_profile",
            "is_gestionnaire",
            "is_chef_service",
            "is_financiere",
            "is_admin",
        ]


class UserMeSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="id_utilisateur", read_only=True)
    role = serializers.SerializerMethodField()
    service = serializers.SerializerMethodField()
    fournisseur_id = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "nom_complet",
            "email",
            "titre_poste",
            "role",
            "service",
            "fournisseur_id",
        ]

    def get_role(self, obj):
        if obj.id_role:
            return obj.id_role.nom_role
        return None

    def get_service(self, obj):
        if obj.id_service:
            svc = obj.id_service
            result = {
                "id": svc.id_service,
                "nom": svc.nom_service,
            }
            # Include batiment + etablissement hierarchy
            if svc.id_batiment:
                bat = svc.id_batiment
                result["batiment"] = {
                    "id": bat.id_batiment,
                    "nom": bat.nom,
                }
                if bat.id_etablissement:
                    result["etablissement"] = {
                        "id": bat.id_etablissement.id_etablissement,
                        "nom": bat.id_etablissement.nom,
                    }
            return result
        return None

    def get_fournisseur_id(self, obj):
        if hasattr(obj, "fournisseur_profile") and obj.fournisseur_profile:
            return obj.fournisseur_profile.id_fournisseur
        return None


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    access_token = serializers.CharField(read_only=True)
    refresh_token = serializers.CharField(read_only=True)
    user = UserMeSerializer(read_only=True)

    def validate(self, attrs):
        email = str(attrs.get("email") or "").strip().lower()
        password = str(attrs.get("password") or "").strip()
        request = self.context.get("request")

        user = authenticate(request=request, username=email, password=password)
        if not user:
            raise serializers.ValidationError("Identifiants invalides.")
        if not user.is_active:
            raise serializers.ValidationError("Ce compte est inactif.")

        refresh = RefreshToken.for_user(user)
        return {
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "user": UserMeSerializer(user).data,
        }


class UtilisateurAdminSerializer(serializers.ModelSerializer):
    id_role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), required=True)
    id_service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        required=False,
        allow_null=True,
    )
    id_fournisseur = serializers.PrimaryKeyRelatedField(
        queryset=Fournisseur.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    password = serializers.CharField(write_only=True, required=False, min_length=6)

    role = RoleSerializer(source="id_role", read_only=True)
    service = ServiceSerializer(source="id_service", read_only=True)
    fournisseur_profile = FournisseurSerializer(read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id_utilisateur",
            "nom_complet",
            "email",
            "password",
            "actif",
            "titre_poste",
            "date_creation",
            "id_role",
            "id_service",
            "id_fournisseur",
            "role",
            "service",
            "fournisseur_profile",
        ]
        read_only_fields = ["id_utilisateur", "date_creation", "role", "service", "fournisseur_profile"]

    def validate_email(self, value):
        qs = Utilisateur.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value

    def validate(self, attrs):
        if self.instance is not None and self.partial:
            allowed_partial_fields = {"actif"}
            if set(attrs.keys()).issubset(allowed_partial_fields):
                return attrs

        role = attrs.get("id_role") or getattr(self.instance, "id_role", None)
        service = attrs.get("id_service") if "id_service" in attrs else getattr(self.instance, "id_service", None)
        fournisseur = attrs.get("id_fournisseur")

        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Le mot de passe est requis à la création."})

        if role and role.nom_role == "fournisseur":
            if not fournisseur:
                raise serializers.ValidationError({
                    "id_fournisseur": "Le fournisseur est requis pour le rôle fournisseur.",
                })
            if fournisseur.id_utilisateur and (self.instance is None or fournisseur.id_utilisateur_id != self.instance.pk):
                raise serializers.ValidationError({
                    "id_fournisseur": "Ce fournisseur est déjà lié à un autre utilisateur.",
                })
        else:
            if not service:
                raise serializers.ValidationError({"id_service": "Le service est requis pour ce rôle."})

        return attrs

    def _sync_fournisseur_link(self, instance, fournisseur):
        current_profile = getattr(instance, "fournisseur_profile", None)
        if current_profile and (not fournisseur or current_profile.pk != fournisseur.pk):
            current_profile.id_utilisateur = None
            current_profile.save(update_fields=["id_utilisateur"])

        if fournisseur:
            fournisseur.id_utilisateur = instance
            fournisseur.save(update_fields=["id_utilisateur"])

    def create(self, validated_data):
        fournisseur = validated_data.pop("id_fournisseur", None)
        password = validated_data.pop("password")
        role = validated_data.get("id_role")

        if role and role.nom_role == "fournisseur":
            validated_data["id_service"] = None

        instance = Utilisateur(**validated_data)
        instance.set_password(password)
        instance.save()

        self._sync_fournisseur_link(instance, fournisseur)
        return instance

    def update(self, instance, validated_data):
        fournisseur = validated_data.pop("id_fournisseur", None) if "id_fournisseur" in validated_data else None
        password = validated_data.pop("password", None)
        role = validated_data.get("id_role", instance.id_role)

        if role and role.nom_role == "fournisseur":
            validated_data["id_service"] = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if role and role.nom_role == "fournisseur":
            self._sync_fournisseur_link(instance, fournisseur)
        else:
            self._sync_fournisseur_link(instance, None)

        return instance


class JournalAuditSerializer(serializers.Serializer):
    id_log = serializers.IntegerField(read_only=True)
    type_action = serializers.CharField(read_only=True)
    content_type = serializers.SerializerMethodField(read_only=True)
    id_enregistrement_cible = serializers.IntegerField(read_only=True, allow_null=True)
    ancienne_valeur = serializers.JSONField(read_only=True, allow_null=True)
    nouvelle_valeur = serializers.JSONField(read_only=True, allow_null=True)
    date_action = serializers.DateTimeField(read_only=True)
    adresse_ip = serializers.CharField(read_only=True, allow_blank=True, allow_null=True)
    user_agent = serializers.CharField(read_only=True, allow_blank=True)
    id_utilisateur = UtilisateurSerializer(read_only=True)

    def get_content_type(self, obj):
        if obj.content_type_id is None:
            return None
        return str(obj.content_type)
