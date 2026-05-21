from datetime import date, timedelta

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncYear
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.alerts.models import AlerteDelai
from apps.core.permissions import IsGestionnaireOrAdmin
from apps.decharge.models import SignatureDecharge
from apps.procurement.models import LotArticle, MarcheBC
from apps.requests.models import Demande, LigneDemande
from apps.resources.models import InstanceRessource, MouvementStock, Ressource, Stock


class StockInstantaneView(APIView):
    """GET /api/reporting/stock/instantane/"""

    permission_classes = [IsGestionnaireOrAdmin]

    def get(self, request):
        consommables = (
            Ressource.objects.filter(
                id_type__nom_categorie="consommable",
                id_type__actif=True,
            )
            .select_related("id_type", "stock")
            .order_by("designation")
        )
        consommables_data = []
        for r in consommables:
            stock = getattr(r, "stock", None)
            if stock is None:
                continue
            consommables_data.append(
                {
                    "id": r.id_ressource,
                    "designation": r.designation,
                    "categorie": r.id_type.nom_categorie,
                    "quantite_disponible": stock.quantite_disponible,
                    "seuil_alerte": stock.seuil_alerte,
                    "alerte": stock.seuil_alerte is not None and stock.quantite_disponible <= stock.seuil_alerte,
                }
            )

        bien_inventaire = (
            Ressource.objects.filter(
                id_type__nom_categorie="bien_inventaire",
                id_type__actif=True,
            )
            .select_related("id_type")
            .annotate(
                total_instances=Count("instanceressource__id_instance"),
                nb_en_stock=Count(
                    "instanceressource__id_instance",
                    filter=Q(instanceressource__statut="en_stock"),
                ),
                nb_en_service=Count(
                    "instanceressource__id_instance",
                    filter=Q(instanceressource__statut="en_service"),
                ),
                nb_en_maintenance=Count(
                    "instanceressource__id_instance",
                    filter=Q(instanceressource__statut="en_maintenance"),
                ),
                nb_hors_service=Count(
                    "instanceressource__id_instance",
                    filter=Q(instanceressource__statut="hors_service"),
                ),
            )
            .order_by("designation")
        )
        bien_inv_data = [
            {
                "id": r.id_ressource,
                "designation": r.designation,
                "categorie": r.id_type.nom_categorie,
                "total_instances": r.total_instances,
                "en_stock": r.nb_en_stock,
                "en_service": r.nb_en_service,
                "en_maintenance": r.nb_en_maintenance,
                "hors_service": r.nb_hors_service,
            }
            for r in bien_inventaire
        ]

        return Response(
            {"consommables": consommables_data, "bien_inventaire": bien_inv_data}
        )


class StockPeriodiqueView(APIView):
    """GET /api/reporting/stock/periodique/?id_ressource=&date_debut=&date_fin=&unite="""

    permission_classes = [IsGestionnaireOrAdmin]

    _TRUNC = {"jour": TruncDay, "mois": TruncMonth, "annee": TruncYear}
    _FMT = {"jour": "%Y-%m-%d", "mois": "%Y-%m", "annee": "%Y"}

    def get(self, request):
        id_ressource = request.query_params.get("id_ressource")
        date_debut = request.query_params.get("date_debut")
        date_fin = request.query_params.get("date_fin")
        unite = request.query_params.get("unite", "mois")

        if not id_ressource:
            return Response({"error": "id_ressource est requis."}, status=400)

        if unite not in self._TRUNC:
            return Response(
                {"error": "unite doit être 'jour', 'mois' ou 'annee'."}, status=400
            )

        qs = MouvementStock.objects.filter(id_ressource_id=id_ressource)
        if date_debut:
            qs = qs.filter(date_mouvement__date__gte=date_debut)
        if date_fin:
            qs = qs.filter(date_mouvement__date__lte=date_fin)

        trunc_fn = self._TRUNC[unite]
        fmt = self._FMT[unite]

        entrees_dict = {
            row["periode"]: row["total"]
            for row in (
                qs.filter(type_mouvement="entree")
                .annotate(periode=trunc_fn("date_mouvement"))
                .values("periode")
                .annotate(total=Sum("quantite"))
                .order_by("periode")
            )
        }
        sorties_dict = {
            row["periode"]: row["total"]
            for row in (
                qs.filter(type_mouvement__in=["sortie", "retour"])
                .annotate(periode=trunc_fn("date_mouvement"))
                .values("periode")
                .annotate(total=Sum("quantite"))
                .order_by("periode")
            )
        }

        all_periods = sorted(set(entrees_dict) | set(sorties_dict))
        labels, entrees, sorties, solde = [], [], [], []
        running_solde = 0
        for p in all_periods:
            e = entrees_dict.get(p, 0)
            s = sorties_dict.get(p, 0)
            running_solde += e - s
            labels.append(p.strftime(fmt))
            entrees.append(e)
            sorties.append(s)
            solde.append(running_solde)

        return Response(
            {"labels": labels, "entrees": entrees, "sorties": sorties, "solde": solde}
        )


class BilanAnnuelView(APIView):
    """GET /api/reporting/bilan_annuel/?annee="""

    permission_classes = [IsGestionnaireOrAdmin]

    def get(self, request):
        annee = request.query_params.get("annee")
        try:
            annee = int(annee) if annee else timezone.now().year
        except ValueError:
            return Response({"error": "annee doit être un entier."}, status=400)

        mvt_qs = MouvementStock.objects.filter(date_mouvement__year=annee)

        entrees_par_cat = list(
            mvt_qs.filter(type_mouvement="entree")
            .values(categorie=F("id_ressource__id_type__nom_categorie"))
            .annotate(total=Sum("quantite"))
            .order_by("categorie")
        )
        sorties_par_cat = list(
            mvt_qs.filter(type_mouvement="sortie")
            .values(categorie=F("id_ressource__id_type__nom_categorie"))
            .annotate(total=Sum("quantite"))
            .order_by("categorie")
        )

        marches_qs = MarcheBC.objects.filter(date_creation__year=annee)
        marches_stats = {
            "receptionnes": marches_qs.filter(statut="receptionne_et_stocke").count(),
            "en_attente": marches_qs.filter(statut="en_attente_livraison").count(),
        }
        donations = marches_qs.filter(type_acquisition="donation").count()

        consommation_par_entite = list(
            LigneDemande.objects.filter(id_demande__date_demande__year=annee)
            .values(
                type_service=F("id_demande__id_service__type_service"),
                nom_service=F("id_demande__id_service__nom_service"),
            )
            .annotate(
                total_demande=Sum("quantite_demandee"),
                total_accorde=Sum("quantite_accordee"),
            )
            .order_by("type_service")
        )

        rebuts = mvt_qs.filter(type_mouvement="rebut").count()
        transferts = mvt_qs.filter(type_mouvement="transfert").count()

        return Response(
            {
                "annee": annee,
                "mouvements": {
                    "entrees_par_categorie": entrees_par_cat,
                    "sorties_par_categorie": sorties_par_cat,
                },
                "marches": marches_stats,
                "donations": donations,
                "consommation_par_entite": consommation_par_entite,
                "rebuts": rebuts,
                "transferts": transferts,
            }
        )


class DashboardView(APIView):
    """GET /api/reporting/dashboard/"""

    permission_classes = [IsGestionnaireOrAdmin]

    def get(self, request):
        today = timezone.localdate()
        current_month = today.replace(day=1)
        start_month = current_month
        for _ in range(11):
            start_month = (start_month.replace(day=1) - timedelta(days=1)).replace(day=1)

        cons_alerts = Stock.objects.filter(
            seuil_alerte__isnull=False,
            quantite_disponible__lte=F("seuil_alerte"),
        ).count()
        bi_alerts = (
            Ressource.objects.filter(
                id_type__nom_categorie="bien_inventaire",
                seuil_alerte__isnull=False,
            )
            .annotate(
                instances_en_stock=Count(
                    "instanceressource",
                    filter=Q(instanceressource__statut="en_stock"),
                )
            )
            .filter(instances_en_stock__lte=F("seuil_alerte"))
            .count()
        )
        stock_alerts_count = cons_alerts + bi_alerts

        total_consommables = Stock.objects.aggregate(t=Sum("quantite_disponible"))["t"] or 0
        total_biens = InstanceRessource.objects.filter(statut="en_stock").count()
        total_articles = total_consommables + total_biens

        entrees_ce_mois = MouvementStock.objects.filter(
            date_mouvement__gte=current_month, type_mouvement="entree"
        ).aggregate(t=Sum("quantite"))["t"] or 0
        sorties_ce_mois = MouvementStock.objects.filter(
            date_mouvement__gte=current_month, type_mouvement__in=["sortie", "rebut"]
        ).aggregate(t=Sum("quantite"))["t"] or 0
        
        total_articles_last_month = total_articles - entrees_ce_mois + sorties_ce_mois

        demandes_en_cours = Demande.objects.filter(statut="en_attente").count()
        demandes_en_cours_last_month = Demande.objects.filter(
            statut="en_attente",
            date_demande__date__lt=current_month,
        ).count()

        consommables = (
            Ressource.objects.filter(
                id_type__nom_categorie="consommable",
                id_type__actif=True,
            )
            .select_related("id_type", "stock")
            .order_by("designation")
        )
        consommables_count = 0
        top_5_consommables = []
        for ressource in consommables:
            stock = getattr(ressource, "stock", None)
            if stock is None:
                continue
            consommables_count += 1
            top_5_consommables.append(
                {
                    "id": ressource.id_ressource,
                    "designation": ressource.designation,
                    "quantite_disponible": stock.quantite_disponible,
                    "seuil_alerte": stock.seuil_alerte,
                    "alerte": stock.seuil_alerte is not None and stock.quantite_disponible <= stock.seuil_alerte,
                }
            )

        bien_inventaire_count = Ressource.objects.filter(
            id_type__nom_categorie="bien_inventaire",
            id_type__actif=True,
        ).count()


        marches_deadline_proche = (
            AlerteDelai.objects.filter(
                id_marche__type_acquisition="marche",
                date_echeance__lte=today + timedelta(days=7),
                acquitte=False,
            )
            .values("id_marche")
            .distinct()
            .count()
        )

        decharges_en_attente_signature = SignatureDecharge.objects.filter(
            statut="non_signe"
        ).count()

        monthly_entrees = list(
            MouvementStock.objects.filter(
                type_mouvement="entree",
                date_mouvement__date__gte=start_month,
            )
            .annotate(mois=TruncMonth("date_mouvement"))
            .values("mois")
            .annotate(total=Sum("quantite"))
            .order_by("mois")
        )
        monthly_sorties = list(
            MouvementStock.objects.filter(
                type_mouvement="sortie",
                date_mouvement__date__gte=start_month,
            )
            .annotate(mois=TruncMonth("date_mouvement"))
            .values("mois")
            .annotate(total=Sum("quantite"))
            .order_by("mois")
        )

        monthly_map = {}
        for row in monthly_entrees:
            key = row["mois"].strftime("%Y-%m") if row["mois"] else None
            if not key:
                continue
            monthly_map[key] = {
                "mois": key,
                "entrees": int(row["total"] or 0),
                "sorties": 0,
            }
        for row in monthly_sorties:
            key = row["mois"].strftime("%Y-%m") if row["mois"] else None
            if not key:
                continue
            monthly_map.setdefault(key, {"mois": key, "entrees": 0, "sorties": 0})
            monthly_map[key]["sorties"] = int(row["total"] or 0)

        monthly_acquisitions = []
        cursor = start_month
        while cursor <= current_month:
            key = cursor.strftime("%Y-%m")
            monthly_acquisitions.append(
                monthly_map.get(key, {"mois": key, "entrees": 0, "sorties": 0})
            )
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

        recent_demandes = [
            {
                "id": demande.id_demande,
                "reference": f"DEM-{demande.date_demande.year}-{demande.id_demande:04d}",
                "service": {
                    "nom_service": demande.id_service.nom_service if demande.id_service else "—",
                    "type_service": demande.id_service.type_service if demande.id_service else None,
                },
                "urgence": demande.urgence,
                "statut": demande.statut,
                "date_demande": demande.date_demande.isoformat(),
            }
            for demande in Demande.objects.select_related("id_service")
            .order_by("-date_demande")[:5]
        ]

        active_alerts = [
            {
                "id": alerte.id_alerte,
                "reference": alerte.id_marche.reference,
                "id_marche": {"reference": alerte.id_marche.reference},
                "jours": alerte.jours_restants,
                "progress": _deadline_progress(alerte.jours_restants),
                "niveau": alerte.niveau_alerte,
                "date_echeance": alerte.date_echeance.isoformat(),
                "timestamp": alerte.date_alerte.isoformat() if alerte.date_alerte else None,
            }
            for alerte in AlerteDelai.objects.select_related("id_marche")
            .filter(acquitte=False, date_echeance__lte=today + timedelta(days=7))
            .order_by("date_echeance")[:5]
        ]

        recent_activity = _build_dashboard_activity()

        visible_attente_q = Q(statut="en_attente_livraison") & (
            Q(source="manuel") | Q(source="import", import_excel__statut_import="en_revision")
        )

        marches_en_attente = MarcheBC.objects.filter(
            visible_attente_q, type_acquisition="marche"
        ).count()

        bc_en_attente = MarcheBC.objects.filter(
            visible_attente_q, type_acquisition="bon_commande"
        ).count()

        dons_en_attente = MarcheBC.objects.filter(
            visible_attente_q, type_acquisition="donation"
        ).count()

        return Response(
            {
                "kpis": {
                    "total_articles": total_articles,
                    "delta_articles": _percentage_delta(total_articles, total_articles_last_month),
                    "demandes_en_cours": demandes_en_cours,
                    "delta_demandes": _percentage_delta(demandes_en_cours, demandes_en_cours_last_month),
                    "decharges_en_attente": decharges_en_attente_signature,
                    "stock_alerts": stock_alerts_count,
                    "marches_en_attente": marches_en_attente,
                    "bc_en_attente": bc_en_attente,
                    "dons_en_attente": dons_en_attente,
                    "marches_delai_proche": marches_deadline_proche,
                },
                "stock_alerts": stock_alerts_count,
                "stock_alerts_count": stock_alerts_count,
                "marches_en_attente": marches_en_attente,
                "bc_en_attente": bc_en_attente,
                "dons_en_attente": dons_en_attente,
                "marches_delai_proche": marches_deadline_proche,
                "marches_deadline_proche": marches_deadline_proche,
                "demandes_en_cours": demandes_en_cours,
                "decharges_en_attente": decharges_en_attente_signature,
                "decharges_en_attente_signature": decharges_en_attente_signature,
                "monthly_acquisitions": monthly_acquisitions,
                "category_distribution": [
                    {"name": "Consommables", "value": consommables_count},
                    {"name": "Biens inventaire", "value": bien_inventaire_count},
                ],
                "recent_demandes": recent_demandes,
                "active_alerts": active_alerts,
                "recent_activity": recent_activity,
                "top_5_consommables": top_5_consommables[:5],
            }
        )


def _percentage_delta(current_value, previous_value):
    if previous_value in (None, 0):
        return 100 if current_value else 0
    return round(((current_value - previous_value) / previous_value) * 100)


def _deadline_progress(days_remaining):
    if days_remaining is None:
        return None
    if days_remaining <= 0:
        return 100
    return max(0, min(100, round(((7 - min(days_remaining, 7)) / 7) * 100)))


def _format_time_ago(moment):
    if not moment:
        return ""
    localized = timezone.localtime(moment) if timezone.is_aware(moment) else timezone.make_aware(moment)
    delta = timezone.now() - localized
    if delta.days > 0:
        return f"il y a {delta.days}j"
    hours = delta.seconds // 3600
    if hours > 0:
        return f"il y a {hours}h"
    minutes = max(1, delta.seconds // 60)
    return f"il y a {minutes}min"


def _build_dashboard_activity():
    events = []

    for demande in Demande.objects.select_related("id_service").order_by("-date_demande")[:3]:
        service_name = demande.id_service.nom_service if demande.id_service else "—"
        events.append(
            {
                "id": f"demande-{demande.id_demande}",
                "type": "demande_recue",
                "title": f"Nouvelle demande #{demande.id_demande:04d}",
                "description": service_name,
                "timestamp": demande.date_demande,
                "time_ago": _format_time_ago(demande.date_demande),
            }
        )

    for signature in SignatureDecharge.objects.select_related("id_decharge").filter(
        date_signature__isnull=False,
    ).order_by("-date_signature")[:3]:
        events.append(
            {
                "id": f"decharge-{signature.id_signature}",
                "type": "decharge_signee",
                "title": f"Décharge {signature.id_decharge.numero_decharge} signée",
                "description": signature.statut,
                "timestamp": signature.date_signature,
                "time_ago": _format_time_ago(signature.date_signature),
            }
        )

    for alerte in AlerteDelai.objects.select_related("id_marche").filter(acquitte=False).order_by("-date_alerte")[:3]:
        days_remaining = alerte.jours_restants
        events.append(
            {
                "id": f"alerte-{alerte.id_alerte}",
                "type": "stock_alerte",
                "title": f"Alerte délai {alerte.id_marche.reference}",
                "description": (
                    f"Échéance dépassée de {abs(days_remaining)}j"
                    if days_remaining <= 0
                    else f"{days_remaining}j restants"
                ),
                "timestamp": alerte.date_alerte,
                "time_ago": _format_time_ago(alerte.date_alerte),
            }
        )

    for mouvement in MouvementStock.objects.select_related("id_ressource").filter(
        type_mouvement="entree",
    ).order_by("-date_mouvement")[:3]:
        events.append(
            {
                "id": f"mouvement-{mouvement.id_mouvement}",
                "type": "import_valide",
                "title": f"Entrée validée : {mouvement.id_ressource.designation}",
                "description": f"+{mouvement.quantite} unité(s)",
                "timestamp": mouvement.date_mouvement,
                "time_ago": _format_time_ago(mouvement.date_mouvement),
            }
        )

    events.sort(key=lambda item: item["timestamp"], reverse=True)
    return [
        {
            **event,
            "timestamp": event["timestamp"].isoformat() if event.get("timestamp") else None,
        }
        for event in events[:6]
    ]


class StatistiquesAchatsView(APIView):
    """GET /api/reporting/statistiques_achats/?date_debut=&date_fin=&type_acquisition=&entite="""

    permission_classes = [IsGestionnaireOrAdmin]

    def get(self, request):
        date_debut = request.query_params.get("date_debut")
        date_fin = request.query_params.get("date_fin")
        type_acquisition = request.query_params.get("type_acquisition")
        entite = request.query_params.get("entite")

        qs = MouvementStock.objects.filter(type_mouvement="entree")

        if date_debut:
            qs = qs.filter(date_mouvement__date__gte=date_debut)
        if date_fin:
            qs = qs.filter(date_mouvement__date__lte=date_fin)

        if type_acquisition:
            lot_ct = ContentType.objects.get_for_model(LotArticle)
            lot_ids = LotArticle.objects.filter(
                id_marche__type_acquisition=type_acquisition
            ).values_list("id_lot", flat=True)
            qs = qs.filter(content_type=lot_ct, object_id__in=lot_ids)

        if entite:
            qs = qs.filter(
                id_utilisateur__id_service__type_service=entite
            )

        monthly = (
            qs.annotate(mois=TruncMonth("date_mouvement"))
            .values("mois")
            .annotate(total=Sum("quantite"), nombre_mouvements=Count("id_mouvement"))
            .order_by("mois")
        )

        return Response(
            {
                "data": [
                    {
                        "mois": row["mois"].strftime("%Y-%m") if row["mois"] else None,
                        "total": row["total"],
                        "nombre_mouvements": row["nombre_mouvements"],
                    }
                    for row in monthly
                ]
            }
        )


class DashboardSummaryView(APIView):
    """GET /api/reporting/dashboard-summary/ — lightweight KPI snapshot."""

    permission_classes = [IsGestionnaireOrAdmin]

    def get(self, request):
        from apps.procurement.models import ImportExcelBC  # noqa: PLC0415
        from apps.returns.models import RetourMateriel    # noqa: PLC0415

        consommables_count = Ressource.objects.filter(
            id_type__nom_categorie="consommable",
            id_type__actif=True,
        ).count()
        biens_count = Ressource.objects.filter(
            id_type__nom_categorie="bien_inventaire",
            id_type__actif=True,
        ).count()
        alertes_actives_count = AlerteDelai.objects.filter(acquitte=False).count()
        demandes_en_attente_count = Demande.objects.filter(statut="en_attente").count()
        retours_en_attente_count = RetourMateriel.objects.filter(statut="en_attente").count()
        imports_en_revision_count = ImportExcelBC.objects.filter(
            statut_import="en_revision"
        ).count()

        return Response(
            {
                "consommables_count": consommables_count,
                "biens_count": biens_count,
                "alertes_actives_count": alertes_actives_count,
                "demandes_en_attente_count": demandes_en_attente_count,
                "retours_en_attente_count": retours_en_attente_count,
                "imports_en_revision_count": imports_en_revision_count,
            }
        )