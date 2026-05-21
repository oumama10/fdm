from django.db import migrations, models


_NORMALISATION = {
    "u": "unite", "unité": "unite", "unite": "unite", "pièce": "unite",
    "piece": "unite", "pcs": "unite",
    "kg": "kg", "kilogram": "kg", "kilo": "kg", "kilogramme": "kg",
    "litre": "litre", "l": "litre", "liter": "litre", "litres": "litre",
    "boite": "boite", "boîte": "boite", "box": "boite",
    "ramette": "ramette",
}

_VALID = {"unite", "kg", "litre", "boite", "ramette", "autre"}


def normalise_forward(apps, schema_editor):
    Ressource = apps.get_model("resources", "Ressource")
    to_update = []
    for r in Ressource.objects.using(schema_editor.connection.alias).only("id_ressource", "unite_mesure"):
        normalised = _NORMALISATION.get((r.unite_mesure or "").strip().lower(), "autre")
        if r.unite_mesure != normalised:
            r.unite_mesure = normalised
            to_update.append(r)
    if to_update:
        Ressource.objects.using(schema_editor.connection.alias).bulk_update(to_update, ["unite_mesure"])


def normalise_reverse(apps, schema_editor):
    pass  # no meaningful reverse — free-text values are gone


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0035_softdelete"),
    ]

    operations = [
        # 1. Normalise existing rows before adding constraints
        migrations.RunPython(normalise_forward, normalise_reverse),

        # 2. Add choices and update the default
        migrations.AlterField(
            model_name="ressource",
            name="unite_mesure",
            field=models.CharField(
                choices=[
                    ("unite", "Unité"),
                    ("kg", "Kilogramme"),
                    ("litre", "Litre"),
                    ("boite", "Boîte"),
                    ("ramette", "Ramette"),
                    ("autre", "Autre"),
                ],
                default="unite",
                max_length=20,
            ),
        ),
    ]
