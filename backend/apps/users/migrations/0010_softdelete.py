import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0009_alter_role_nom_role"),
    ]

    operations = [
        # ── Service ──────────────────────────────────────────────────────────
        migrations.AddField(
            model_name="service",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="service",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="service",
            name="actif",
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name="service",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="service",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="users.utilisateur",
            ),
        ),

        # ── Beneficiaire ─────────────────────────────────────────────────────
        migrations.AddField(
            model_name="beneficiaire",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="beneficiaire",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="beneficiaire",
            name="actif",
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name="beneficiaire",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="beneficiaire",
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
