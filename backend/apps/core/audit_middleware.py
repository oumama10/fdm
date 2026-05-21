from threading import Thread

from apps.alerts.models import JournalAudit


class AuditMiddleware:
    AUDITED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.method in self.AUDITED_METHODS:
            user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
            action = request.method
            path = request.path
            ip_address = self._get_client_ip(request)
            user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]

            Thread(
                target=self._write_audit_log,
                kwargs={
                    "user": user,
                    "action": action,
                    "path": path,
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                },
                daemon=True,
            ).start()

        return response

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    @staticmethod
    def _write_audit_log(user, action, path, ip_address, user_agent):
        JournalAudit.objects.create(
            id_utilisateur=user,
            type_action=f"{action} {path}"[:100],
            adresse_ip=ip_address,
            user_agent=user_agent,
        )
