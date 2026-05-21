import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("alerts", "0008_notification_content_type"),
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Remove the old table_cible text column
        migrations.RemoveField(
            model_name="journalaudit",
            name="table_cible",
        ),

        # 2. Replace IntegerField with nullable PositiveIntegerField
        migrations.AlterField(
            model_name="journalaudit",
            name="id_enregistrement_cible",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),

        # 3. Add content_type FK
        migrations.AddField(
            model_name="journalaudit",
            name="content_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="contenttypes.contenttype",
            ),
        ),

        # 4. ancienne_valeur → JSONField
        migrations.AlterField(
            model_name="journalaudit",
            name="ancienne_valeur",
            field=models.JSONField(blank=True, null=True),
        ),

        # 5. nouvelle_valeur → JSONField
        migrations.AlterField(
            model_name="journalaudit",
            name="nouvelle_valeur",
            field=models.JSONField(blank=True, null=True),
        ),

        # 6. Composite indexes
        migrations.AddIndex(
            model_name="journalaudit",
            index=models.Index(
                fields=["content_type", "id_enregistrement_cible"],
                name="journal_ct_objid_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="journalaudit",
            index=models.Index(
                fields=["id_utilisateur", "date_action"],
                name="journal_user_date_idx",
            ),
        ),
    ]
