from django.db import migrations


def forward(apps, schema_editor):
    InstanceRessource = apps.get_model("resources", "InstanceRessource")
    InstanceRessource.objects.filter(
        statut__in=["hors_service", "retire"]
    ).update(statut="debarras")


def backward(apps, schema_editor):
    pass  # irreversible — old values were ambiguous


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0028_statut_replace_hors_service_retire_with_debarras"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
