import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("decharge", "0005_add_timestampedmodel"),
        ("returns", "0008_add_timestampedmodel"),
    ]

    operations = [
        migrations.AddField(
            model_name="retourmateriel",
            name="id_ligne_decharge_origine",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="retours",
                to="decharge.lignedecharge",
            ),
        ),
    ]
