from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("alerts", "0006_db_indexes"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                fields=["destinataire", "lu", "created_at"],
                name="notif_dest_lu_created_idx",
            ),
        ),
    ]
