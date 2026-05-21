import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0033_rename_typearticle_pk"),
    ]

    operations = [
        # Ressource.actif — new field required by the (id_type, actif) index
        migrations.AddField(
            model_name="ressource",
            name="actif",
            field=models.BooleanField(default=True),
        ),
        # Ressource indexes
        migrations.AddIndex(
            model_name="ressource",
            index=models.Index(fields=["id_type", "actif"], name="ressource_id_type_actif_idx"),
        ),
        migrations.AddIndex(
            model_name="ressource",
            index=models.Index(fields=["id_categorie", "id_sous_categorie"], name="ressource_id_cat_id_scat_idx"),
        ),
        # InstanceRessource indexes
        migrations.AddIndex(
            model_name="instanceressource",
            index=models.Index(fields=["statut", "id_ressource"], name="instres_statut_res_idx"),
        ),
        migrations.AddIndex(
            model_name="instanceressource",
            index=models.Index(fields=["id_service_actuel", "statut"], name="instres_svc_statut_idx"),
        ),
        # MouvementStock indexes
        migrations.AddIndex(
            model_name="mouvementstock",
            index=models.Index(fields=["id_ressource", "date_mouvement"], name="mouvementstock_res_date_idx"),
        ),
        migrations.AddIndex(
            model_name="mouvementstock",
            index=models.Index(fields=["content_type", "object_id"], name="mouvementstock_ct_objid_idx"),
        ),
    ]
