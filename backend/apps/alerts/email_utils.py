from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

def send_alert_email(to_emails, subject, context):
    html_content = render_to_string("emails/alerte_delai.html", context)
    text_content = render_to_string("emails/alerte_delai.html", {**context, "plain": True})
    email = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@fmpdf.local"),
        to=to_emails,
    )
    email.attach_alternative(html_content, "text/html")
    email.send()
