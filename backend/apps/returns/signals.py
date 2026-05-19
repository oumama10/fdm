from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.resources.models import InstanceRessource, MouvementStock
from apps.returns.models import RetourMateriel


@receiver(post_save, sender=RetourMateriel)
def on_retour_decision(sender, instance, **kwargs):
    if not instance.decision or not instance.id_instance_ressource_id:
        return

    decision = instance.decision
    etat_map = {
        "hors_service": ("hors_service", "hors_service", "retour"),
        "en_stock": ("retourne", "en_stock", "retour"),
        "repare": ("bon_etat", "en_stock", "retour"),
        "non_repare": ("endommage", "en_maintenance", "retour"),
        "rebut": ("hors_service", "retire", "rebut"),
        "reaffecte": (None, "en_stock", "retour"),
    }

    if decision not in etat_map:
        return

    nouvel_etat, nouveau_statut, type_mouvement = etat_map[decision]

    update_fields = {"statut": nouveau_statut}
    if nouvel_etat is not None:
        update_fields["etat"] = nouvel_etat

    if decision == "reaffecte":
        update_fields["type_affectation"] = "reaffectation"
        update_fields["id_service_actuel"] = None
        update_fields["id_destinataire"] = None

    InstanceRessource.objects.filter(
        pk=instance.id_instance_ressource_id
    ).update(**update_fields)

    MouvementStock.objects.create(
        type_mouvement=type_mouvement,
        quantite=1,
        id_ressource=instance.id_ressource,
        id_instance_ressource=instance.id_instance_ressource,
        id_utilisateur=instance.id_traite_par,
    )
