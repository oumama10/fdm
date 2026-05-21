from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0022_add_timestampedmodel"),
        ("resources", "0033_rename_typearticle_pk"),
    ]

    operations = [
        migrations.RenameField(
            model_name="stagingitem",
            old_name="id_categorie_suggeree",
            new_name="id_type_suggeree",
        ),
    ]
