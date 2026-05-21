import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0023_rename_stagingitem_type_fk"),
        ("users", "0009_alter_role_nom_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="marchebc",
            name="actif",
            field=models.BooleanField(default=True, db_index=True),
        ),
        migrations.AddField(
            model_name="marchebc",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="marchebc",
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
