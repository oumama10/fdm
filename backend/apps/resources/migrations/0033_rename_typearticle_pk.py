from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0032_add_timestampedmodel"),
    ]

    operations = [
        migrations.RenameField(
            model_name="typearticle",
            old_name="id_categorie",
            new_name="id_type_article",
        ),
    ]
