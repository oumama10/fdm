from django.contrib.contenttypes.models import ContentType
from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.timezone import now

from apps.alerts.models import Notification
from apps.decharge.models import LigneDecharge, SignatureDecharge
from apps.resources.models import InstanceRessource, MouvementStock, Stock


@receiver(post_save, sender=SignatureDecharge)
def on_signature_valide(sender, instance, created, **kwargs):
    if instance.statut != "valide":
        return

    decharge = instance.id_decharge
    lignes = LigneDecharge.objects.filter(id_decharge=decharge).select_related(
        "id_ressource", "id_instance_ressource"
    )
    ligne_ct = ContentType.objects.get_for_model(LigneDecharge)

    for ligne in lignes:
        if ligne.type_ligne == "bien_inventaire" and ligne.id_instance_ressource:
            InstanceRessource.objects.filter(
                pk=ligne.id_instance_ressource_id
            ).update(statut="en_service", date_derniere_affectation=now().date())
            MouvementStock.objects.create(
                type_mouvement="sortie",
                quantite=1,
                id_ressource=ligne.id_ressource,
                content_type=ligne_ct,
                object_id=ligne.pk,
            )
        elif ligne.type_ligne == "consommable":
            Stock.objects.filter(id_ressource=ligne.id_ressource).update(
                quantite_disponible=F("quantite_disponible") - ligne.quantite
            )
            MouvementStock.objects.create(
                type_mouvement="sortie",
                quantite=ligne.quantite,
                id_ressource=ligne.id_ressource,
                content_type=ligne_ct,
                object_id=ligne.pk,
            )

    demande = decharge.id_demande
    demande.statut = "complete_avec_decharge"
    demande.save(update_fields=["statut"])

    if instance.id_chef_service_id:
        Notification.objects.create(
            type_notification="decharge_prete",
            titre="Décharge validée",
            message=f"La décharge {decharge.numero_decharge} a été validée.",
            id_destinataire=instance.id_chef_service,
        )
