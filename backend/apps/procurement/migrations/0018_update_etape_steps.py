from django.db import migrations, models


def forward_migrate_etapes(apps, schema_editor):
    from django.utils import timezone  # noqa: PLC0415

    MarcheEtape = apps.get_model("procurement", "MarcheEtape")
    MarcheBC = apps.get_model("procurement", "MarcheBC")

    # 1. Delete contrat_signe (was ordre=2)
    MarcheEtape.objects.filter(nom_etape="contrat_signe").delete()

    # 2. Shift indices: 3→2, 4→3, 5→4, 6→5 (paiement steps stay at 7 and 8)
    MarcheEtape.objects.filter(nom_etape="en_attente_livraison").update(ordre=2)
    MarcheEtape.objects.filter(nom_etape="livraison_en_cours").update(ordre=3)
    MarcheEtape.objects.filter(nom_etape="receptionne_magasin").update(ordre=4)
    MarcheEtape.objects.filter(nom_etape="controle_qualite").update(ordre=5)

    # 3. Insert stocker_au_magasin at ordre=6 for every existing marché
    to_create = [
        MarcheEtape(
            ordre=6,
            nom_etape="stocker_au_magasin",
            statut="en_attente",
            id_marche=marche,
        )
        for marche in MarcheBC.objects.all()
    ]
    if to_create:
        MarcheEtape.objects.bulk_create(to_create)


def reverse_migrate_etapes(apps, schema_editor):
    MarcheEtape = apps.get_model("procurement", "MarcheEtape")
    MarcheBC = apps.get_model("procurement", "MarcheBC")

    MarcheEtape.objects.filter(nom_etape="stocker_au_magasin").delete()

    MarcheEtape.objects.filter(nom_etape="controle_qualite").update(ordre=6)
    MarcheEtape.objects.filter(nom_etape="receptionne_magasin").update(ordre=5)
    MarcheEtape.objects.filter(nom_etape="livraison_en_cours").update(ordre=4)
    MarcheEtape.objects.filter(nom_etape="en_attente_livraison").update(ordre=3)

    to_create = [
        MarcheEtape(
            ordre=2,
            nom_etape="contrat_signe",
            statut="en_attente",
            id_marche=marche,
        )
        for marche in MarcheBC.objects.all()
    ]
    if to_create:
        MarcheEtape.objects.bulk_create(to_create)


class Migration(migrations.Migration):
    dependencies = [
        ("procurement", "0017_marchebc_motif_rejet_alter_marchebc_statut"),
    ]

    operations = [
        migrations.AlterField(
            model_name="marcheEtape",
            name="nom_etape",
            field=models.CharField(
                choices=[
                    ("marche_cree", "marche_cree"),
                    ("en_attente_livraison", "en_attente_livraison"),
                    ("livraison_en_cours", "livraison_en_cours"),
                    ("receptionne_magasin", "receptionne_magasin"),
                    ("controle_qualite", "controle_qualite"),
                    ("stocker_au_magasin", "stocker_au_magasin"),
                    ("paiement_en_cours", "paiement_en_cours"),
                    ("paiement_effectue", "paiement_effectue"),
                ],
                max_length=30,
            ),
        ),
        migrations.RunPython(forward_migrate_etapes, reverse_migrate_etapes),
    ]
