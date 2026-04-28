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
            imp.statut_import = "non_conforme"
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
        with transaction.atomic():
            import_obj = ImportExcelBC.objects.select_for_update().get(pk=import_id)
            import_obj.statut_import = "en_attente"
            import_obj.save(update_fields=["statut_import"])

        file_path = import_obj.fichier_excel_original.path
        logger.info("[PDF TASK] File path: %s", file_path)

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        import pdfplumber
        pages_text = []
        table_rows = []
        with pdfplumber.open(file_path) as pdf:
            logger.info("[PDF TASK] Pages: %s", len(pdf.pages))
            for i, page in enumerate(pdf.pages, 1):
                text = page.extract_text() or ""
                if text:
                    pages_text.append(text)
                try:
                    tables = page.extract_tables() or []
                    for table in tables:
                        for row in table or []:
                            if not row:
                                continue
                            normalized_row = [str(cell or "").strip() for cell in row]
                            if any(normalized_row):
                                table_rows.append(normalized_row)
                except Exception:
                    logger.exception("[PDF TASK] Failed to parse tables on page %s", i)

        raw_text = "\n".join(pages_text)
        logger.info("[PDF TASK] Total raw text chars: %s", len(raw_text))

        if not raw_text.strip():
            raise ValueError("PDF produced no extractable text (possibly scanned)")

        result = AIExtractor.extract_from_pdf(raw_text, table_rows)
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

        _enrich_marche(import_obj, metadata)

        staging_items = []
        for ligne in lignes:
            designation = str(ligne.get("designation") or "").strip()
            description = str(ligne.get("description") or "").strip()
            if not designation:
                continue

            quantite = max(1, min(int(ligne.get("quantite") or 1), 1_000_000))

            # Apply NLP normalization to get category suggestions
            from apps.procurement.tasks.nlp_normalizer import normalize_designation
            normalized = normalize_designation(designation)

            # Resolve category instance if ID provided
            categorie_instance = None
            if normalized.get("id_categorie_suggeree"):
                from apps.resources.models import Categorie
                try:
                    categorie_instance = Categorie.objects.get(id_categorie=normalized["id_categorie_suggeree"])
                except Categorie.DoesNotExist:
                    categorie_instance = None

            # Resolve resource instance if ID provided
            ressource_instance = None
            if normalized.get("id_ressource_liee"):
                from apps.resources.models import Ressource
                try:
                    ressource_instance = Ressource.objects.get(id_ressource=normalized["id_ressource_liee"])
                except Ressource.DoesNotExist:
                    ressource_instance = None

            staging_items.append(
                StagingItem(
                    id_import=import_obj,
                    designation_brute=designation,
                    description=description,
                    designation_normalisee=normalized["designation_normalisee"],
                    quantite=quantite,
                    unite=str(ligne.get("unite") or "U"),
                    prix_unitaire_ht=ligne.get("prix_unitaire_ht"),
                    prix_total_ht=ligne.get("prix_total_ht"),
                    type_detecte=normalized.get("type_detecte", ""),
                    id_categorie_suggeree=categorie_instance,
                    categorie_suggeree_nom=normalized.get("categorie_suggeree_nom", ""),
                    sous_categorie_suggeree_nom=normalized.get("sous_categorie_suggeree_nom", ""),
                    id_ressource_liee=ressource_instance,
                    statut="en_attente",
                )
            )

        StagingItem.objects.bulk_create(staging_items, batch_size=200)
        logger.info("[PDF TASK] Created %s StagingItems", len(staging_items))

        _notify_gestionnaires(import_obj, len(staging_items))

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


def _enrich_marche(import_obj, metadata: dict) -> None:
    from apps.procurement.models import MarcheBC
    from apps.users.models import Fournisseur
    marche = import_obj.id_marche
    try:
        ref = metadata.get("reference_document")
        if ref and "IMPORT-" in marche.reference:
            # Check if a marche with this reference already exists
            existing_marche = MarcheBC.objects.filter(reference=ref).exclude(pk=marche.pk).first()
            if existing_marche:
                # Update the import to use the existing marche instead
                import_obj.id_marche = existing_marche
                import_obj.save(update_fields=["id_marche"])
                # Delete the temporary marche we created
                marche.delete()
                logger.info("[PDF TASK] Using existing MarcheBC reference=%s", ref)
                return
            else:
                # Update the reference of our temporary marche
                marche.reference = ref

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
                if metadata.get("fournisseur_email"):
                    fournisseur.email = metadata["fournisseur_email"]
                if metadata.get("fournisseur_telephone"):
                    fournisseur.telephone = metadata["fournisseur_telephone"]
                fournisseur.save(update_fields=["email", "telephone"])
            marche.id_fournisseur = fournisseur

        marche.save()
        logger.info("[PDF TASK] MarcheBC enriched reference=%s", marche.reference)
    except Exception:
        logger.exception("[PDF TASK] Failed to enrich MarcheBC, continuing")


def _notify_gestionnaires(import_obj, item_count: int) -> None:
    try:
        from apps.alerts.models import Notification
        from apps.users.models import Utilisateur
        gestionnaires = Utilisateur.objects.filter(id_role__nom_role="gestionnaire_magasin", actif=True)
        Notification.objects.bulk_create([
            Notification(
                id_destinataire=g,
                type_notification="validation_requise",
                titre="Import PDF prêt pour révision",
                message=f"L'import #{import_obj.id_import} contient {item_count} article(s) en attente de validation.",
                canal="web",
            )
            for g in gestionnaires
        ])
    except Exception:
        logger.exception("[PDF TASK] Failed to send notifications")
