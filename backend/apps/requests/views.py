from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import (
    IsChefService,
    IsChefServiceOwner,
    IsGestionnaireOrAdmin,
)

from .models import Demande
from .serializers import DemandeCreateSerializer, DemandeSerializer


class DemandeViewSet(viewsets.ModelViewSet):
    """
    Permissions per action
    ----------------------
    create                : IsChefService
    list                  : IsGestionnaireOrAdmin → all
                            IsChefService        → own only
    retrieve              : IsGestionnaireOrAdmin → any
                            IsChefService        → own only (object-level)
    update/partial_update : IsGestionnaireOrAdmin
    destroy               : IsGestionnaireOrAdmin

    Custom actions
    --------------
    POST /demandes/{id}/valider/  — IsGestionnaireOrAdmin
    POST /demandes/{id}/refuser/  — IsGestionnaireOrAdmin
    """

    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return DemandeCreateSerializer
        return DemandeSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsChefService()]
        if self.action in ("update", "partial_update", "destroy", "valider"):
            return [IsGestionnaireOrAdmin()]
        # list + retrieve: both roles allowed — queryset/object gate narrows access
        return [(IsGestionnaireOrAdmin | IsChefService)()]

    def get_queryset(self):
        qs = Demande.objects.select_related(
            "id_chef_demandeur__id_service",
            "id_chef_demandeur__id_role",
            "id_service__id_batiment__id_etablissement",
            "id_beneficiaire",
            "id_valide_par",
        ).prefetch_related(
            "lignes__id_ressource__id_type",
            "lignes__id_ressource__id_categorie",
            "lignes__id_ressource__id_sous_categorie",
        )

        user = self.request.user
        # Chefs de service see only their own demandes
        if (
            user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "chef_service"
        ):
            qs = qs.filter(id_chef_demandeur=user)
        return qs

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        # Object-level guard for chef_service on retrieve
        if (
            self.action == "retrieve"
            and user.is_authenticated
            and user.id_role
            and user.id_role.nom_role == "chef_service"
        ):
            self.check_object_permissions(self.request, obj)
            # IsChefServiceOwner is checked explicitly here
            perm = IsChefServiceOwner()
            if not perm.has_object_permission(self.request, self, obj):
                self.permission_denied(self.request)
        return obj

    def perform_create(self, serializer):
        from datetime import timedelta  # noqa: PLC0415

        from apps.alerts.models import NotificationType  # noqa: PLC0415
        from apps.decharge.models import SignatureDecharge  # noqa: PLC0415

        # ── Block if unsigned decharge older than 48h ─────────────────────────
        unsigned_overdue = SignatureDecharge.objects.filter(
            id_chef_service=self.request.user,
            statut="non_signe",
            id_decharge__date_generation__lte=timezone.now() - timedelta(hours=48),
        )
        if unsigned_overdue.exists():
            from rest_framework.exceptions import PermissionDenied  # noqa: PLC0415
            raise PermissionDenied(
                "Vous avez une décharge non signée depuis plus de 48h. "
                "Veuillez signer toutes vos décharges en attente avant de soumettre une nouvelle demande."
            )

        demande = serializer.save(id_chef_demandeur=self.request.user, type_demandeur="chef_service")
        self._notify_gestionnaires(
            demande,
            NotificationType.DEMANDE_SOUMISE,
            f"Nouvelle demande #{demande.id_demande} soumise par {self.request.user.nom_complet}.",
        )

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _notify_chef(demande: Demande, notification_type, message: str) -> None:
        """Notify the chef who submitted the demande. Swallows all exceptions."""
        try:
            from apps.alerts.notification_service import create_notification  # noqa: PLC0415

            create_notification(
                demande.id_chef_demandeur,
                notification_type,
                message,
                objet_id=demande.pk,
                lien=f"/chef/demandes/{demande.pk}/",
            )
        except Exception:
            pass

    @staticmethod
    def _notify_gestionnaires(demande: Demande, notification_type, message: str) -> None:
        """Notify all active gestionnaires. Swallows all exceptions."""
        try:
            from apps.alerts.notification_service import create_notification  # noqa: PLC0415
            from apps.users.models import Utilisateur  # noqa: PLC0415

            gestionnaires = Utilisateur.objects.filter(
                id_role__nom_role="gestionnaire_magasin", actif=True
            ).only("id_utilisateur")
            for gestionnaire in gestionnaires:
                create_notification(
                    gestionnaire,
                    notification_type,
                    message,
                    objet_id=demande.pk,
                    lien=f"/gestionnaire/demandes/{demande.pk}/",
                )
        except Exception:
            pass

    # ── custom actions ────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="valider")
    def valider(self, request, pk=None):
        from django.db import transaction  # noqa: PLC0415

        from apps.decharge.models import Decharge, LigneDecharge, SignatureDecharge  # noqa: PLC0415

        from .models import LigneDemande  # noqa: PLC0415

        demande = self.get_object()

        # Guard 1: only process actionable statuts
        if demande.statut not in ("en_attente", "refusee"):
            return Response(
                {"detail": f"Impossible de traiter une demande au statut « {demande.statut} »."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guard 2: idempotency — block double-click
        if Decharge.objects.filter(id_demande=demande).exists():
            return Response(
                {"detail": "Cette demande a déjà une décharge associée."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        decision = request.data.get("decision", "")
        if decision not in ("total", "partiel", "refus"):
            return Response(
                {"detail": "Le champ 'decision' est requis : 'total', 'partiel' ou 'refus'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── CAS REFUS ────────────────────────────────────────────────────────
        if decision == "refus":
            commentaire = request.data.get("commentaire_validation", "")
            motif_refus = request.data.get("motif_refus", commentaire)

            demande.statut = "refusee"
            demande.commentaire_validation = commentaire
            demande.motif_refus = motif_refus
            demande.id_valide_par = request.user
            demande.date_validation = timezone.now()
            demande.save(
                update_fields=["statut", "commentaire_validation", "motif_refus", "id_valide_par_id", "date_validation"]
            )

            from apps.alerts.models import NotificationType  # noqa: PLC0415

            self._notify_chef(
                demande,
                NotificationType.DEMANDE_REJETEE,
                f"Votre demande #{demande.id_demande} a été refusée."
                + (f" Motif : {commentaire}" if commentaire else ""),
            )

            return Response(DemandeSerializer(demande).data, status=status.HTTP_200_OK)

        # ── CAS TOTAL / PARTIEL ──────────────────────────────────────────────
        lignes_input = request.data.get("lignes", [])

        any_accorded = any(
            max(0, int(ld.get("quantite_accordee", 0))) > 0
            for ld in lignes_input
        )
        if not any_accorded:
            return Response(
                {"detail": "Aucune quantité accordée. Pour refuser la demande, utilisez decision='refus'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Pre-check stock availability for consommables (before entering the transaction)
        from apps.resources.models import Stock as _Stock  # noqa: PLC0415
        for ld_data in lignes_input:
            qa = max(0, int(ld_data.get("quantite_accordee", 0)))
            if qa <= 0:
                continue
            lid = ld_data.get("id_ligne")
            try:
                from .models import LigneDemande as _LD  # noqa: PLC0415
                ligne_check = _LD.objects.select_related("id_ressource__id_categorie").get(pk=lid, id_demande=demande)
                if ligne_check.id_ressource.is_consommable:
                    stock_check = _Stock.objects.filter(id_ressource=ligne_check.id_ressource).first()
                    available = stock_check.quantite_disponible if stock_check else 0
                    if available < qa:
                        return Response(
                            {
                                "detail": (
                                    f"Stock insuffisant pour « {ligne_check.id_ressource.designation} » : "
                                    f"{available} disponible(s), {qa} demandé(s)."
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
            except LigneDemande.DoesNotExist:
                pass  # caught properly inside the transaction below

        with transaction.atomic():

            # Step 1 — persist accorded quantities on each ligne
            lignes_map = {}
            for ld_data in lignes_input:
                lid = ld_data.get("id_ligne")
                qa = max(0, int(ld_data.get("quantite_accordee", 0)))
                instances = ld_data.get("instances", [])
                try:
                    ligne = LigneDemande.objects.select_related(
                        "id_ressource__id_categorie"
                    ).get(pk=lid, id_demande=demande)
                    ligne.quantite_accordee = qa
                    ligne.save(update_fields=["quantite_accordee"])
                    lignes_map[lid] = {"ligne": ligne, "instances": instances, "qa": qa}
                except LigneDemande.DoesNotExist:
                    return Response(
                        {"detail": f"Ligne {lid} introuvable pour cette demande."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Step 2 — set statut from the explicit decision
            new_statut = "totale" if decision == "total" else "partielle"

            demande.statut = new_statut
            demande.id_valide_par = request.user
            demande.date_validation = timezone.now()
            demande.save(update_fields=["statut", "id_valide_par_id", "date_validation"])

            # Step 3 — create the Décharge
            decharge = Decharge.objects.create(
                id_demande=demande,
                id_genere_par=request.user,
            )

            # Step 4 — build décharge lines
            decharge_lignes = []
            for ld_info in lignes_map.values():
                ligne = ld_info["ligne"]
                ressource = ligne.id_ressource
                qa = ld_info["qa"]
                inst_ids = ld_info["instances"]

                if ressource.is_consommable:
                    if qa > 0:
                        decharge_lignes.append(
                            LigneDecharge(
                                id_decharge=decharge,
                                id_ressource=ressource,
                                quantite=qa,
                                type_ligne="consommable",
                                id_instance_ressource=None,
                            )
                        )
                else:
                    for inst_id in inst_ids:
                        decharge_lignes.append(
                            LigneDecharge(
                                id_decharge=decharge,
                                id_ressource=ressource,
                                quantite=1,
                                type_ligne="bien_inventaire",
                                id_instance_ressource_id=inst_id,
                            )
                        )

            if not decharge_lignes:
                decharge.delete()
                return Response(
                    {"detail": "Aucune instance sélectionnée pour les biens d'inventaire."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            LigneDecharge.objects.bulk_create(decharge_lignes)

            # Step 5 — decrement stock at validation time (Option A)
            from django.contrib.contenttypes.models import ContentType  # noqa: PLC0415
            from django.db.models import F                              # noqa: PLC0415
            from django.utils.timezone import now as _now              # noqa: PLC0415
            from apps.resources.models import InstanceRessource, MouvementStock, Stock  # noqa: PLC0415
            from apps.resources.signals import _notify_gestionnaires_for_stock  # noqa: PLC0415

            ligne_ct = ContentType.objects.get_for_model(LigneDecharge)

            for dl in decharge_lignes:
                if dl.type_ligne == "consommable" and dl.quantite > 0:
                    # Decrement disponible AND increment reservee atomically.
                    # disponible tracks real physical stock; reservee tracks what
                    # is engaged but not yet physically delivered (released at signature).
                    Stock.objects.filter(id_ressource=dl.id_ressource).update(
                        quantite_disponible=F("quantite_disponible") - dl.quantite,
                        quantite_reservee=F("quantite_reservee") + dl.quantite,
                    )
                    stock = Stock.objects.filter(id_ressource=dl.id_ressource).first()
                    if stock:
                        _notify_gestionnaires_for_stock(stock.pk)
                    MouvementStock.objects.create(
                        type_mouvement="sortie",
                        quantite=dl.quantite,
                        id_ressource=dl.id_ressource,
                        content_type=ligne_ct,
                        object_id=dl.pk,
                    )

                elif dl.type_ligne == "bien_inventaire" and dl.id_instance_ressource_id:
                    svc = demande.id_service
                    etab = (
                        svc
                        and getattr(svc, "id_batiment", None)
                        and getattr(svc.id_batiment, "id_etablissement", None)
                    ) or None
                    InstanceRessource.objects.filter(
                        pk=dl.id_instance_ressource_id
                    ).update(
                        statut="en_service",
                        id_service_actuel=svc,
                        id_lieu_affectation=etab,
                        id_destinataire=demande.id_beneficiaire,
                        type_affectation="nouvelle_affectation",
                        date_derniere_affectation=_now().date(),
                    )
                    MouvementStock.objects.create(
                        type_mouvement="sortie",
                        quantite=1,
                        id_ressource=dl.id_ressource,
                        content_type=ligne_ct,
                        object_id=dl.pk,
                    )

            SignatureDecharge.objects.create(
                id_decharge=decharge,
                id_chef_service=demande.id_chef_demandeur,
                statut="non_signe",
            )

            try:
                from apps.decharge.tasks import generate_decharge_pdf  # noqa: PLC0415
                generate_decharge_pdf.delay(decharge.pk)
            except Exception:
                pass

        # Notification (outside the atomic block)
        try:
            from apps.alerts.models import NotificationType  # noqa: PLC0415
            from apps.alerts.notification_service import create_notification  # noqa: PLC0415

            create_notification(
                demande.id_chef_demandeur,
                NotificationType.DECHARGE_GENEREE,
                f"Votre demande #{demande.id_demande} a été traitée ({new_statut}) — "
                f"décharge {decharge.numero_decharge} générée.",
                objet_id=decharge.pk,
                lien=f"/chef/decharges/{decharge.pk}/",
            )
        except Exception:
            pass

        response_data = dict(DemandeSerializer(demande).data)
        response_data["decharge_id"] = decharge.pk
        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="requester-options")
    def requester_options(self, request):
        from apps.users.models import Utilisateur  # noqa: PLC0415

        chefs = (
            Utilisateur.objects.select_related("id_service", "id_role")
            .filter(id_role__nom_role="chef_service", actif=True)
            .order_by("nom_complet")
        )

        data = [
            {
                "id_utilisateur": chef.id_utilisateur,
                "nom_complet": chef.nom_complet,
                "id_service": chef.id_service_id,
                "nom_service": chef.id_service.nom_service if chef.id_service else None,
            }
            for chef in chefs
        ]
        return Response(data, status=status.HTTP_200_OK)
