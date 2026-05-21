from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0022_ressource_marque"),
        ("procurement", "0018_update_etape_steps"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Categorie",
            new_name="TypeArticle",
        ),
        migrations.AlterModelOptions(
            name="typearticle",
            options={"verbose_name": "type article", "verbose_name_plural": "types article"},
        ),
    ]
