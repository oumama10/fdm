from django.db import migrations


# ── FMPDF hierarchy ────────────────────────────────────────────────────────
FMPDF_BATIMENTS = {
    "Bâtiment Décanat": {
        "type": "decanat",
        "services": [
            "Décanat", "VD Pédagogie", "VD Recherche", "VD Pharmacie", "Sec Générale",
        ],
    },
    "Bâtiment Administratif": {
        "type": "administratif",
        "services": [
            "RH", "Aff Gen", "Economie", "Informatique",
            "Scolarité", "3ème Cycle", "SGCE", "CDIM",
        ],
    },
    "Bâtiment Pharmacie / Médecine Dentaire": {
        "type": "pharmacie",
        "services": ["Unité Pharmacie", "Unité Audit"],
    },
    "Bâtiment Labos": {
        "type": "labo",
        "services": [
            "Labo Biophysique", "Microbiologie", "Biol Moléculaire",
            "Pharmacologie", "Physiologie", "Épidémiologie",
            "Anatomie", "Histologie", "Ana-path",
            "Biochimie et Chimie", "Hématologie",
        ],
    },
    "Autres": {
        "type": "administratif",
        "services": ["Equipement", "MAGASIN"],
    },
}

# ── CHU hierarchy ──────────────────────────────────────────────────────────
CHU_BATIMENTS = {
    "Bâtiment A (Médecine Interne & Spécialités Médicales)": {
        "type": "chu",
        "services": [
            "Médecine Interne", "Gastro-entérologie", "Endocrinologie",
            "Rhumatologie", "Pneumologie", "Cardiologie", "Neurologie",
            "Néphrologie", "Dermatologie", "Anesth-Réa A1", "Anesth-Réa A4",
        ],
    },
    "Bâtiment B (Chirurgie & Traumatologie)": {
        "type": "chu",
        "services": [
            "Chir Gen A", "Chir Gen B", "Chir Vasculaire", "Chir Thoracique",
            "CCV", "Neurochirurgie", "Urologie",
            "Traumato-Ortho B3", "Traumato-Ortho B4",
        ],
    },
    "Bâtiment Mère-Enfant": {
        "type": "chu",
        "services": [
            "Gynéco1", "Gynéco2", "Pédiatrie", "Chir Pédiatrique",
            "Chir Ortho-Pédiatrique", "Hémato-Onco-Pédiatrique",
            "Réa-Mère-Enfant", "Réa-Néonatal", "Radiologie Mère-Enfant",
        ],
    },
    "Bâtiment Oncologie": {
        "type": "chu",
        "services": ["Oncologie", "Radiothérapie", "Médecine Nucléaire"],
    },
    "Bâtiment Urgences & CHOAP": {
        "type": "chu",
        "services": ["Urgences", "CHOAP"],
    },
    "Bâtiment Imagerie & Biologie": {
        "type": "chu",
        "services": ["Radiologie", "Centre Diagnostic", "Laboratoire Central"],
    },
    "Bâtiment Psychiatrie & Spécialités Sensorielles": {
        "type": "chu",
        "services": [
            "Psychiatrie", "Ophtalmologie", "ORL", "Médecine de Réadaptation",
        ],
    },
    "Bâtiment Médecine Sociale & Légale": {
        "type": "chu",
        "services": ["Médecine Légale", "Médecine de Travail", "Néphro"],
    },
}


def seed_hierarchy(apps, schema_editor):
    Etablissement = apps.get_model("users", "Etablissement")
    Batiment = apps.get_model("users", "Batiment")
    Service = apps.get_model("users", "Service")
    Beneficiaire = apps.get_model("users", "Beneficiaire")

    for etab_nom, batiments_spec in [("FMPDF", FMPDF_BATIMENTS), ("CHU", CHU_BATIMENTS)]:
        etab, _ = Etablissement.objects.get_or_create(nom=etab_nom)
        is_chu = etab_nom == "CHU"

        for bat_nom, bat_info in batiments_spec.items():
            bat, _ = Batiment.objects.get_or_create(
                nom=bat_nom, id_etablissement=etab,
            )

            for svc_nom in bat_info["services"]:
                svc, _ = Service.objects.get_or_create(
                    nom_service=svc_nom,
                    defaults={
                        "type_service": bat_info["type"],
                        "description": "",
                    },
                )
                # Link to bâtiment (even if already existed)
                if svc.id_batiment_id != bat.pk:
                    svc.id_batiment = bat
                    svc.save(update_fields=["id_batiment_id"])

                # Create fixed bénéficiaires
                Beneficiaire.objects.get_or_create(
                    nom="Chef de Service",
                    role_type="chef_service",
                    id_service=svc,
                )

                if is_chu:
                    Beneficiaire.objects.get_or_create(
                        nom="Secrétariat",
                        role_type="secretariat",
                        id_service=svc,
                    )
                    Beneficiaire.objects.get_or_create(
                        nom="Salle de cours",
                        role_type="salle_de_cours",
                        id_service=svc,
                    )


def reverse_seed(apps, schema_editor):
    Etablissement = apps.get_model("users", "Etablissement")
    Etablissement.objects.filter(nom__in=["FMPDF", "CHU"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_etablissement_batiment_beneficiaire"),
    ]

    operations = [
        migrations.RunPython(seed_hierarchy, reverse_seed),
    ]
