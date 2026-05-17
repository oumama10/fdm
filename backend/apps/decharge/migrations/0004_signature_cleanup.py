from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("decharge", "0003_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="signaturedecharge",
            name="fichier_scan_signe",
        ),
        migrations.RemoveField(
            model_name="signaturedecharge",
            name="observation_chef",
        ),
        migrations.AlterField(
            model_name="signaturedecharge",
            name="statut",
            field=models.CharField(
                choices=[
                    ("non_signe", "non_signe"),
                    ("signe", "signe"),
                ],
                default="non_signe",
                max_length=20,
            ),
        ),
    ]
