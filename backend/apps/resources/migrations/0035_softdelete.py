import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0034_composite_indexes"),
        ("users", "0009_alter_role_nom_role"),
    ]

    operations = [
        # ── Categorie ────────────────────────────────────────────────────────
        # actif already exists (no db_index) — upgrade it
        migrations.AlterField(
            model_name="categorie",
            name="actif",
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name="categorie",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="categorie",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="users.utilisateur",
            ),
        ),

        # ── SousCategorie ────────────────────────────────────────────────────
        # actif is brand-new
        migrations.AddField(
            model_name="souscategorie",
            name="actif",
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name="souscategorie",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="souscategorie",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="users.utilisateur",
            ),
        ),

        # ── Ressource ────────────────────────────────────────────────────────
        # actif already exists from 0034 (no db_index) — upgrade it
        migrations.AlterField(
            model_name="ressource",
            name="actif",
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name="ressource",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="ressource",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="users.utilisateur",
            ),
        ),
    ]
