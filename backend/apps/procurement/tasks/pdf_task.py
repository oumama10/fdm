import logging
import os

from celery.exceptions import MaxRetriesExceededError
from django.db import transaction

from config.celery import app

logger = logging.getLogger(__name__)


def _mark_rejected(import_id: int, observations: str = "") -> None:
    from apps.procurement.models import ImportExcelBC
    try:
        with transaction.atomic():
            imp = ImportExcelBC.objects.select_for_update().filter(pk=import_id).first()
            if not imp:
                return
            imp.statut_import = "rejete"
            imp.observations = observations[:2000]
            imp.save(update_fields=["statut_import", "observations"])
    except Exception:
        logger.exception("[PDF TASK] Could not mark import %s as rejected", import_id)


@app.task(queue="ocr", bind=True, max_retries=3)
def extract_pdf_items(self, import_id: int, retry_enabled: bool = True) -> None:
    logger.info("[PDF TASK] START import_id=%s", import_id)

    from apps.procurement.models import ImportExcelBC, StagingItem
    from apps.procurement.services.ai_extractor import AIExtractor

    try:
        import_obj = ImportExcelBC.objects.get(pk=import_id)
        file_path = import_obj.fichier_excel_original.path
        logger.info("[PDF TASK] File path: %s", file_path)

        # Path traversal guard
        import pathlib  # noqa: PLC0415
        from django.conf import settings as _settings  # noqa: PLC0415
        safe_path = pathlib.Path(file_path).resolve()
        media_root = pathlib.Path(_settings.MEDIA_ROOT).resolve()
        if not str(safe_path).startswith(str(media_root)):
            raise ValueError(f"Chemin de fichier non autorisé : {file_path}")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        result = AIExtractor.extract_from_pdf(file_path)
        logger.info("[PDF TASK] source=%s lignes=%s", result.get("source"), len(result.get("lignes", [])))
        metadata = AIExtractor.build_import_metadata(result)
        if not metadata.get("titre_fichier"):
            metadata["titre_fichier"] = os.path.splitext(os.path.basename(file_path))[0][:255]

        for field_name, field_value in metadata.items():
            setattr(import_obj, field_name, field_value)
        import_obj.save(
            update_fields=[
                "titre_fichier",
                "reference_document",
                "fournisseur_denomination",
                "fournisseur_telephone",
                "fournisseur_email",
                "fournisseur_adresse",
                "delai_execution",
            ]
        )

        lignes = result.get("lignes", [])
        if not lignes:
            raise ValueError("No line items extracted from document")

        _enrich_marche(import_obj.id_marche, metadata)

        staging_items = []
        for ligne in lignes:
            designation = str(ligne.get("designation") or "").strip()
            description = str(ligne.get("description") or "").strip()
            if not designation:
                continue

            # Defensive guard: keep subtotal/total rows out of staging even if a future
            # extraction path accidentally lets one through.
            if AIExtractor._is_summary_row(
                designation,
                description,
                str(ligne.get("prix_unitaire_ht") or ""),
                str(ligne.get("prix_total_ht") or ""),
                str(ligne.get("quantite") or ""),
                row_text=f"{designation} {description}",
            ):
                continue

            quantite = max(1, min(int(ligne.get("quantite") or 1), 1_000_000))

            staging_items.append(
                StagingItem(
                    id_import=import_obj,
                    designation_brute=designation,
                    description=description,
                    designation_normalisee=designation[:255],
                    quantite=quantite,
                    unite=str(ligne.get("unite") or "U"),
                    prix_unitaire_ht=ligne.get("prix_unitaire_ht"),
                    prix_total_ht=ligne.get("prix_total_ht"),
                    statut="en_attente",
                )
            )

        StagingItem.objects.bulk_create(staging_items, batch_size=200)
        logger.info("[PDF TASK] Created %s StagingItems", len(staging_items))

        with transaction.atomic():
            import_obj.refresh_from_db()
            import_obj.statut_import = "en_attente"
            import_obj.save(update_fields=["statut_import"])

        logger.info("[PDF TASK] DONE import_id=%s", import_id)

    except Exception as exc:
        logger.exception("[PDF TASK FAILED] import_id=%s error=%s", import_id, exc)
        if not retry_enabled:
            _mark_rejected(import_id, f"Extraction PDF échouée: {str(exc)[:1800]}")
            return
        countdown = (2 ** self.request.retries) * 60
        try:
            raise self.retry(exc=exc, countdown=countdown)
        except MaxRetriesExceededError:
            _mark_rejected(import_id, f"Extraction PDF échouée après retries: {str(exc)[:1800]}")


def _enrich_marche(marche, metadata: dict) -> None:
    from apps.procurement.models import MarcheBC
    from apps.users.models import Fournisseur
    try:
        update_fields = []

        ref = metadata.get("reference_document")
        if ref and "IMPORT-" in marche.reference:
            ref_taken = MarcheBC.objects.filter(reference=ref).exclude(pk=marche.pk).exists()
            if not ref_taken:
                marche.reference = ref
                update_fields.append("reference")

        nom = metadata.get("fournisseur_denomination")
        if nom:
            fournisseur = Fournisseur.objects.filter(nom_societe__icontains=nom).first()
            if not fournisseur:
                fournisseur = Fournisseur.objects.create(
                    nom_societe=nom,
                    nom_responsable=nom,
                    email=metadata.get("fournisseur_email") or "",
                    telephone=metadata.get("fournisseur_telephone") or "",
                    adresse=metadata.get("fournisseur_adresse") or "",
                )
                logger.info("[PDF TASK] Created Fournisseur: %s", nom)
            else:
                fournisseur_fields = []
                if metadata.get("fournisseur_email"):
                    fournisseur.email = metadata["fournisseur_email"]
                    fournisseur_fields.append("email")
                if metadata.get("fournisseur_telephone"):
                    fournisseur.telephone = metadata["fournisseur_telephone"]
                    fournisseur_fields.append("telephone")
                if fournisseur_fields:
                    fournisseur.save(update_fields=fournisseur_fields)
            marche.id_fournisseur = fournisseur
            update_fields.append("id_fournisseur_id")

        if update_fields:
            MarcheBC.objects.filter(pk=marche.pk).update(
                **{f: getattr(marche, f) for f in update_fields}
            )
            logger.info("[PDF TASK] MarcheBC enriched pk=%s fields=%s", marche.pk, update_fields)
    except Exception:
        logger.exception("[PDF TASK] Failed to enrich MarcheBC, continuing")
