from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0026_taxonomy_schema_cleanup"),
    ]

    operations = [
        migrations.AddField(
            model_name="categorie",
            name="date_mise_a_jour",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
