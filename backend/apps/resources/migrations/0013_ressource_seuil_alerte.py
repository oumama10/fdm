from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0012_alter_instanceressource_numero_inventaire"),
    ]

    operations = [
        migrations.AddField(
            model_name="ressource",
            name="seuil_alerte",
            field=models.IntegerField(default=0),
        ),
    ]
