import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0023_rename_categorie_typearticle"),
        ("procurement", "0019_alter_stagingitem_categorie_fk"),
    ]

    operations = [
        # Create the new Categorie model
        migrations.CreateModel(
            name="Categorie",
            fields=[
                ("id_categorie", models.AutoField(primary_key=True, serialize=False)),
                ("nom_categorie", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("actif", models.BooleanField(default=True)),
                (
                    "id_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="resources.typearticle",
                    ),
                ),
            ],
            options={
                "verbose_name": "categorie",
                "verbose_name_plural": "categories",
            },
        ),
        # SousCategorie: rename the old TypeArticle FK to id_type_old (frees up the name)
        migrations.RenameField(
            model_name="souscategorie",
            old_name="id_categorie",
            new_name="id_type_old",
        ),
        # SousCategorie: add the new Categorie FK (nullable until data migration)
        migrations.AddField(
            model_name="souscategorie",
            name="id_categorie",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to="resources.categorie",
            ),
        ),
        # Ressource: rename the old TypeArticle FK to id_type
        migrations.RenameField(
            model_name="ressource",
            old_name="id_categorie",
            new_name="id_type",
        ),
        # Ressource: add the new Categorie FK (nullable until data migration)
        migrations.AddField(
            model_name="ressource",
            name="id_categorie",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="resources.categorie",
            ),
        ),
    ]
