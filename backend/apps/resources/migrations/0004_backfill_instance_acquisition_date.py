from django.db import migrations


def forward_fill_acquisition_date(apps, schema_editor):
    InstanceRessource = apps.get_model("resources", "InstanceRessource")

    queryset = (
        InstanceRessource.objects.select_related("id_lot__id_marche")
        .filter(date_acquisition__isnull=True)
    )

    for instance in queryset.iterator():
        lot = getattr(instance, "id_lot", None)
        marche = getattr(lot, "id_marche", None) if lot else None
        if not marche:
            continue

        acquisition_date = marche.date_creation or marche.date_livraison_prevue
        if acquisition_date is None:
            continue

        instance.date_acquisition = acquisition_date
        instance.save(update_fields=["date_acquisition"])


def backward_clear_filled_acquisition_date(apps, schema_editor):
    # Non-destructive reverse: keep recovered values instead of clearing them.
    return


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0003_seed_taxonomy"),
    ]

    operations = [
        migrations.RunPython(
            forward_fill_acquisition_date,
            backward_clear_filled_acquisition_date,
        ),
    ]
