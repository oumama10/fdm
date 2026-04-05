from datetime import timedelta
from pathlib import Path

import environ


BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")


SECRET_KEY = env("SECRET_KEY", default="django-insecure-change-me")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])


DJANGO_APPS = [
	"django.contrib.admin",
	"django.contrib.auth",
	"django.contrib.contenttypes",
	"django.contrib.sessions",
	"django.contrib.messages",
	"django.contrib.staticfiles",
]


THIRD_PARTY_APPS = [
	"corsheaders",
	"django_filters",
	"django_celery_beat",
	"django_celery_results",
	"drf_spectacular",
	"rest_framework",
	"rest_framework_simplejwt",
	"rest_framework_simplejwt.token_blacklist",
]


LOCAL_APPS = [
	"apps.users.apps.UsersConfig",
	"apps.resources.apps.ResourcesConfig",
	"apps.procurement.apps.ProcurementConfig",
	"apps.requests.apps.RequestsConfig",
	"apps.decharge.apps.DechargeConfig",
	"apps.returns.apps.ReturnsConfig",
	"apps.alerts.apps.AlertsConfig",
	"apps.reporting.apps.ReportingConfig",
	"apps.core.apps.CoreConfig",
]


INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


MIDDLEWARE = [
	"django.middleware.security.SecurityMiddleware",
	"whitenoise.middleware.WhiteNoiseMiddleware",
	"corsheaders.middleware.CorsMiddleware",
	"django.contrib.sessions.middleware.SessionMiddleware",
	"django.middleware.common.CommonMiddleware",
	"django.middleware.csrf.CsrfViewMiddleware",
	"django.contrib.auth.middleware.AuthenticationMiddleware",
	"django.contrib.messages.middleware.MessageMiddleware",
	"django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "config.urls"


TEMPLATES = [
	{
		"BACKEND": "django.template.backends.django.DjangoTemplates",
		"DIRS": [BASE_DIR / "templates"],
		"APP_DIRS": True,
		"OPTIONS": {
			"context_processors": [
				"django.template.context_processors.debug",
				"django.template.context_processors.request",
				"django.contrib.auth.context_processors.auth",
				"django.contrib.messages.context_processors.messages",
			],
		},
	},
]


WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


DATABASES = {
	"default": env.db(
		"DATABASE_URL",
		default="sqlite:///db.sqlite3",
	),
}


AUTH_PASSWORD_VALIDATORS = [
	{
		"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
	},
	{
		"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
	},
	{
		"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
	},
	{
		"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
	},
]


LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Casablanca"
USE_I18N = True
USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
	"default": {
		"BACKEND": "django.core.files.storage.FileSystemStorage",
	},
	"staticfiles": {
		"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
	},
}

MEDIA_URL = "/media/"
MEDIA_ROOT = Path("/app/media")


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.Utilisateur"


REST_FRAMEWORK = {
	"DEFAULT_AUTHENTICATION_CLASSES": (
		"rest_framework_simplejwt.authentication.JWTAuthentication",
	),
	"DEFAULT_PERMISSION_CLASSES": (
		"rest_framework.permissions.IsAuthenticated",
	),
	"DEFAULT_FILTER_BACKENDS": (
		"django_filters.rest_framework.DjangoFilterBackend",
	),
	"DEFAULT_RENDERER_CLASSES": (
		"djangorestframework_camel_case.render.CamelCaseJSONRenderer",
		"rest_framework.renderers.BrowsableAPIRenderer",
	),
	"DEFAULT_PARSER_CLASSES": (
		"djangorestframework_camel_case.parser.CamelCaseJSONParser",
		"djangorestframework_camel_case.parser.CamelCaseFormParser",
		"djangorestframework_camel_case.parser.CamelCaseMultiPartParser",
	),
	"DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}


SIMPLE_JWT = {
	"ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
	"REFRESH_TOKEN_LIFETIME": timedelta(days=7),
	"USER_ID_FIELD": "id_utilisateur",
	"USER_ID_CLAIM": "user_id",
}


SPECTACULAR_SETTINGS = {
	"TITLE": "FMPDF API",
	"VERSION": "1.0.0",
}


CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE


CORS_ALLOWED_ORIGINS = env.list(
	"CORS_ALLOWED_ORIGINS",
	default=["http://localhost:5173", "http://localhost:3000"],
)


EMAIL_BACKEND = env(
	"EMAIL_BACKEND",
	default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=25)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=False)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="webmaster@localhost")


DECHARGE_TEMPLATE_PATH = env(
	"DECHARGE_TEMPLATE_PATH",
	default=BASE_DIR / "templates" / "decharge" / "decharge_template.xlsx",
)

OPENROUTER_API_KEY = env("OPENROUTER_API_KEY", default="")
OPENROUTER_MODEL = env("OPENROUTER_MODEL", default="openai/gpt-4o-mini")
