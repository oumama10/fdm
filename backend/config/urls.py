from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView


urlpatterns = [
	path("admin/", admin.site.urls),
	path("api/auth/", include("apps.users.urls")),
	path("api/users/", include("apps.users.urls")),
	path("api/resources/", include("apps.resources.urls")),
	path("api/procurement/", include("apps.procurement.urls")),
	path("api/requests/", include("apps.requests.urls")),
	path("api/decharge/", include("apps.decharge.urls")),
	path("api/returns/", include("apps.returns.urls")),
	path("api/alerts/", include("apps.alerts.urls")),
	path("api/reporting/", include("apps.reporting.urls")),
	path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
]


if settings.DEBUG:
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
