from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import F

from .models import MouvementStock, Stock


class StockInsuffisantError(Exception):
    pass


def _create_stock_mouvement(*, direction, quantite, ressource_id, utilisateur, source_object):
    mouvement_type = "sortie" if direction == "-" else "entree"
    content_type = None
    object_id = None

    if source_object is not None:
        content_type = ContentType.objects.get_for_model(source_object, for_concrete_model=False)
        object_id = getattr(source_object, "pk", None)

    MouvementStock.objects.create(
        type_mouvement=mouvement_type,
        quantite=quantite,
        id_ressource_id=ressource_id,
        id_utilisateur=utilisateur,
        content_type=content_type,
        object_id=object_id,
    )


def decrement_stock(ressource_id, quantite, utilisateur, source_object):
    quantite = int(quantite)
    if quantite <= 0:
        raise ValueError("quantite must be a positive integer")

    with transaction.atomic():
        updated_rows = Stock.objects.filter(
            id_ressource_id=ressource_id,
            quantite_disponible__gte=quantite,
        ).update(quantite_disponible=F("quantite_disponible") - quantite)

        if updated_rows == 0:
            raise StockInsuffisantError("Stock insuffisant pour effectuer cette sortie.")

        _create_stock_mouvement(
            direction="-",
            quantite=quantite,
            ressource_id=ressource_id,
            utilisateur=utilisateur,
            source_object=source_object,
        )


def increment_stock(ressource_id, quantite, utilisateur, source_object):
    quantite = int(quantite)
    if quantite <= 0:
        raise ValueError("quantite must be a positive integer")

    with transaction.atomic():
        stock, _ = Stock.objects.get_or_create(id_ressource_id=ressource_id)
        Stock.objects.filter(pk=stock.pk).update(
            quantite_disponible=F("quantite_disponible") + quantite,
        )

        _create_stock_mouvement(
            direction="+",
            quantite=quantite,
            ressource_id=ressource_id,
            utilisateur=utilisateur,
            source_object=source_object,
        )