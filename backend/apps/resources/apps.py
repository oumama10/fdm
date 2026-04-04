from django.apps import AppConfig


class ResourcesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.resources"
    label = "resources"
    verbose_name = "Ressources"

    def ready(self):
        import apps.resources.signals  # noqa: F401
