from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("procurement", "0008_remove_confiance_ia"),
    ]

    operations = [
        migrations.AddField(
            model_name="stagingitem",
            name="commentaire_rejet",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="stagingitem",
            name="motif_rejet",
            field=models.CharField(blank=True, choices=[("document_invalide", "document_invalide"), ("doublon", "doublon"), ("autre", "autre")], default="", max_length=40),
        ),
    ]