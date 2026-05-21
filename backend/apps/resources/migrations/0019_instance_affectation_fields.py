import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0018_readd_quantite_reservee"),
        ("users", "0008_seed_hierarchy_data"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="instanceressource",
            name="localisation_actuelle",
        ),
        migrations.AddField(
            model_name="instanceressource",
            name="type_affectation",
            field=models.CharField(
                blank=True,
                choices=[
                    ("nouvelle_affectation", "Nouvelle Affectation"),
                    ("reaffectation", "Réaffectation"),
                ],
                default="",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="instanceressource",
            name="id_lieu_affectation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="instances_affectees",
                to="users.etablissement",
            ),
        ),
        migrations.AddField(
            model_name="instanceressource",
            name="id_destinataire",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="users.beneficiaire",
            ),
        ),
    ]
