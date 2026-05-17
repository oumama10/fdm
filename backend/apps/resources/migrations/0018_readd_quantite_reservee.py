from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0017_remove_dead_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="stock",
            name="quantite_reservee",
            field=models.IntegerField(default=0),
        ),
    ]
