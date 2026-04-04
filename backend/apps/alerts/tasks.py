from datetime import date

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from apps.alerts.email_utils import send_alert_email
from apps.alerts.models import AlerteDelai, Notification
from apps.core.celery import app
from apps.procurement.models import MarcheBC
from apps.users.models import Utilisateur

@app.task(queue="alerts")
def check_marche_deadlines():
    today = date.today()
    gestionnaires = Utilisateur.objects.filter(id_role__nom_role="gestionnaire_magasin", actif=True)
    financiers = Utilisateur.objects.filter(id_role__nom_role="service_financiere", actif=True)
    destinataires_gest = list(gestionnaires.values_list("email", flat=True))
    destinataires_fin = list(financiers.values_list("email", flat=True))
    destinataires_all = list(set(destinataires_gest + destinataires_fin))

    marches = MarcheBC.objects.filter(statut="en_attente_livraison")
    for marche in marches:
        jours_restants = (marche.date_livraison_prevue - today).days
        alerte_kwargs = {"id_marche": marche}
        if jours_restants <= 7 and jours_restants > 0:
            alerte, created = AlerteDelai.objects.get_or_create(
                niveau_alerte="critique",
                penalite_applicable=False,
                acquitte=False,
                defaults={"date_echeance": marche.date_livraison_prevue, **alerte_kwargs},
                **alerte_kwargs
            )
            subject = f"[FMPDF] Alerte délai — {marche.reference} ({jours_restants}j restants)"
            context = {"marche": marche, "jours_restants": jours_restants}
            send_alert_email(destinataires_all, subject, context)
        elif jours_restants <= 14 and jours_restants > 7:
            alerte, created = AlerteDelai.objects.get_or_create(
                niveau_alerte="warning",
                penalite_applicable=False,
                acquitte=False,
                defaults={"date_echeance": marche.date_livraison_prevue, **alerte_kwargs},
                **alerte_kwargs
            )
            for user in gestionnaires:
                Notification.objects.get_or_create(
                    type_notification="alerte_delai",
                    titre=f"Alerte délai — {marche.reference}",
                    message=f"Le marché {marche.reference} approche de sa date limite de livraison.",
                    id_destinataire=user,
                    canal="web",
                )
        elif jours_restants < 0:
            alerte, created = AlerteDelai.objects.get_or_create(
                niveau_alerte="critique",
                penalite_applicable=True,
                acquitte=False,
                defaults={"date_echeance": marche.date_livraison_prevue, **alerte_kwargs},
                **alerte_kwargs
            )
            subject = f"[FMPDF] URGENCE: Délai dépassé — {marche.reference}"
            context = {"marche": marche, "jours_restants": jours_restants}
            send_alert_email(destinataires_all, subject, context)

@app.task(queue="alerts")
def send_notification_email(notification_id: int):
    try:
        notif = Notification.objects.get(pk=notification_id, canal="email")
    except Notification.DoesNotExist:
        return
    subject = notif.titre
    message = notif.message
    recipient = notif.id_destinataire.email
    html_message = render_to_string("emails/alerte_delai.html", {"notification": notif})
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [recipient],
        html_message=html_message,
    )
    notif.lu = True
    notif.date_lecture = timezone.now()
    notif.save()
