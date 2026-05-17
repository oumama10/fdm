from django.urls import path

from apps.reporting.views import (
    BilanAnnuelView,
    DashboardSummaryView,
    DashboardView,
    StatistiquesAchatsView,
    StockInstantaneView,
    StockPeriodiqueView,
)

urlpatterns = [
    path("stock/instantane/", StockInstantaneView.as_view(), name="stock-instantane"),
    path("stock/periodique/", StockPeriodiqueView.as_view(), name="stock-periodique"),
    path("bilan_annuel/", BilanAnnuelView.as_view(), name="bilan-annuel"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("dashboard-summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path(
        "statistiques_achats/",
        StatistiquesAchatsView.as_view(),
        name="statistiques-achats",
    ),
]