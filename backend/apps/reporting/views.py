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
                id_categorie__nom_categorie="Consommable",
                id_categorie__actif=True,
            )
            .select_related("id_categorie", "stock")
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
                    "categorie": r.id_categorie.nom_categorie,
                    "quantite_disponible": stock.quantite_disponible,
                    "seuil_alerte": stock.seuil_alerte,
                    "alerte": stock.quantite_disponible <= stock.seuil_alerte,
                }
            )

        bien_inventaire = (
            Ressource.objects.filter(
                id_categorie__nom_categorie="Bien Inventaire",
                id_categorie__actif=True,
            )
            .select_related("id_categorie")
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
                "categorie": r.id_categorie.nom_categorie,
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
            .values(categorie=F("id_ressource__id_categorie__nom_categorie"))
            .annotate(total=Sum("quantite"))
            .order_by("categorie")
        )
        sorties_par_cat = list(
            mvt_qs.filter(type_mouvement="sortie")
            .values(categorie=F("id_ressource__id_categorie__nom_categorie"))
            .annotate(total=Sum("quantite"))
            .order_by("categorie")
        )

        marches_qs = MarcheBC.objects.filter(date_creation__year=annee)
        marches_stats = {
            "receptionnes": marches_qs.filter(statut="receptionne_et_stocke").count(),
            "non_conformes": marches_qs.filter(statut="non_conforme").count(),
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
        today = date.today()

        stock_alerts_count = Stock.objects.filter(
            quantite_disponible__lte=F("seuil_alerte")
        ).count()

        marches_en_attente = MarcheBC.objects.filter(
            statut="en_attente_livraison"
        ).count()

        marches_deadline_proche = (
            AlerteDelai.objects.filter(
                date_echeance__gte=today,
                date_echeance__lte=today + timedelta(days=7),
                acquitte=False,
            )
            .values("id_marche")
            .distinct()
            .count()
        )

        demandes_en_cours = Demande.objects.filter(statut="en_cours").count()

        decharges_en_attente_signature = SignatureDecharge.objects.filter(
            statut="en_attente"
        ).count()

        top_5_consommables = list(
            LigneDemande.objects.filter(
                id_demande__date_demande__year=today.year,
                id_demande__date_demande__month=today.month,
                id_ressource__id_categorie__nom_categorie="Consommable",
            )
            .values("id_ressource__id_ressource", "id_ressource__designation")
            .annotate(total_demande=Sum("quantite_demandee"))
            .order_by("-total_demande")[:5]
        )

        twelve_months_ago = (today.replace(day=1) - timedelta(days=365)).replace(
            day=1
        )
        monthly_acquisitions = list(
            MouvementStock.objects.filter(
                type_mouvement="entree",
                date_mouvement__gte=twelve_months_ago,
            )
            .annotate(mois=TruncMonth("date_mouvement"))
            .values("mois")
            .annotate(total=Sum("quantite"))
            .order_by("mois")
        )

        return Response(
            {
                "stock_alerts_count": stock_alerts_count,
                "marches_en_attente": marches_en_attente,
                "marches_deadline_proche": marches_deadline_proche,
                "demandes_en_cours": demandes_en_cours,
                "decharges_en_attente_signature": decharges_en_attente_signature,
                "top_5_consommables": [
                    {
                        "id": item["id_ressource__id_ressource"],
                        "designation": item["id_ressource__designation"],
                        "total_demande": item["total_demande"],
                    }
                    for item in top_5_consommables
                ],
                "monthly_acquisitions": [
                    {
                        "mois": row["mois"].strftime("%Y-%m"),
                        "total": row["total"],
                    }
                    for row in monthly_acquisitions
                ],
            }
        )


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
