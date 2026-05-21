import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0018_update_etape_steps"),
        ("resources", "0023_rename_categorie_typearticle"),
    ]

    operations = [
        migrations.AlterField(
            model_name="stagingitem",
            name="id_categorie_suggeree",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="resources.typearticle",
            ),
        ),
    ]
