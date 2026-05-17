from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('requests', '0003_demande_phase_2_5_1'),
    ]

    operations = [
        migrations.AddField(
            model_name='lignedemande',
            name='quantite_livree',
            field=models.IntegerField(default=0),
        ),
    ]
