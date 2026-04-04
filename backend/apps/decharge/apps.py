from django.apps import AppConfig


class DechargeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.decharge"
    label = "decharge"
    verbose_name = "Décharges"

    def ready(self):
        import apps.decharge.signals  # noqa: F401
