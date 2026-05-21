from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0025_taxonomy_data_migration"),
    ]

    operations = [
        # Remove the temporary TypeArticle FK from SousCategorie
        migrations.RemoveField(
            model_name="souscategorie",
            name="id_type_old",
        ),
        # Remove the self-referential FK (hierarchy flattened into Categorie)
        migrations.RemoveField(
            model_name="souscategorie",
            name="id_parent_sous_categorie",
        ),
    ]
