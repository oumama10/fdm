from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("requests", "0008_db_indexes"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="lignedemande",
            name="disponibilite_pct",
        ),
    ]
