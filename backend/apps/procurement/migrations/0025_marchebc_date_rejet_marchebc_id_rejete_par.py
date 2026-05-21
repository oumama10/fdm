from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0024_softdelete"),
        ("users", "0010_softdelete"),
    ]

    operations = [
        migrations.AddField(
            model_name="marchebc",
            name="date_rejet",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="marchebc",
            name="id_rejete_par",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="marches_rejetes",
                to="users.utilisateur",
            ),
        ),
    ]