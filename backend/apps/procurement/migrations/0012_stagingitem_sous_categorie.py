from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0011_alter_marchebc_contact_donateur_and_more'),
        ('resources', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='stagingitem',
            name='id_sous_categorie_suggeree',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='staging_items',
                to='resources.souscategorie',
            ),
        ),
    ]
