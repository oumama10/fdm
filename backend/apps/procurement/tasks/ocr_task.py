"""
Celery task – parse an uploaded Excel file (ImportExcelBC) and create
StagingItem rows ready for gestionnaire review.

Queue : ocr
"""

import logging
import re
import unicodedata
from decimal import Decimal

from celery.exceptions import MaxRetriesExceededError
from django.db import transaction

from config.celery import app
from .nlp_normalizer import normalize_designation

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Keywords that identify the header row (accent-free, lower-case)
# ---------------------------------------------------------------------------

_HEADER_KEYWORDS: frozenset[str] = frozenset(
    {"designation", "description", "quantite", "qte", "lot"}
)

_DESIGNATION_HEADER_KEYWORDS: tuple[str, ...] = (
    "designation",
    "description",
    "article",
    "produit",
    "libelle",
)

_QUANTITY_HEADER_KEYWORDS: tuple[str, ...] = (
    "quantite",
    "qte",
    "qty",
)

_INVALID_DESIGNATION_TOKENS: frozenset[str] = frozenset(
    {"-", "--", "---", "/", ".", "n/a", "na", "non"}
)

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-().]{6,}\d)")


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _strip_accents(text: str) -> str:
    """Lowercase *text* and strip diacritical marks."""
    nfkd = unicodedata.normalize("NFKD", str(text))
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _row_is_empty(row) -> bool:
    return all(
        cell.value is None or str(cell.value).strip() == "" for cell in row
    )


def _first_non_empty_sheet(wb):
    """
    Return the first worksheet that contains at least one non-None cell in
    its first 20 rows.  Falls back to the active sheet if none found.
    """
    for ws in wb.worksheets:
        for row in ws.iter_rows(max_row=20):
            for cell in row:
                if cell.value is not None:
                    return ws
    return wb.active


def _detect_header_row(ws) -> int:
    """
    Scan rows top-to-bottom and return the **1-based** index of the first row
    that contains a cell whose (accent-free, lower-case) text includes one of
    _HEADER_KEYWORDS as a substring.

    Returns -1 when no header row is found.
    """
    for row_idx, row in enumerate(ws.iter_rows(), start=1):
        for cell in row:
            if cell.value and isinstance(cell.value, str):
                cell_norm = _strip_accents(cell.value.strip())
                if any(kw in cell_norm for kw in _HEADER_KEYWORDS):
                    return row_idx
    return -1


def _detect_data_columns(ws, header_row_idx: int) -> tuple[int | None, int | None]:
    """Return (designation_col_idx, quantite_col_idx) from detected header row."""
    try:
        header_values = next(
            ws.iter_rows(
                min_row=header_row_idx,
                max_row=header_row_idx,
                values_only=True,
            )
        )
    except StopIteration:
        return None, None

    designation_col_idx = None
    quantite_col_idx = None

    for idx, cell_value in enumerate(header_values):
        if not isinstance(cell_value, str):
            continue
        cell_norm = _strip_accents(cell_value.strip())
        if not cell_norm:
            continue

        if designation_col_idx is None and any(
            key in cell_norm for key in _DESIGNATION_HEADER_KEYWORDS
        ):
            designation_col_idx = idx

        if quantite_col_idx is None and any(
            key in cell_norm for key in _QUANTITY_HEADER_KEYWORDS
        ):
            quantite_col_idx = idx

    return designation_col_idx, quantite_col_idx


def _extract_value_from_row(row_values, start_idx: int) -> str | None:
    current_raw = row_values[start_idx]
    current_text = str(current_raw).strip() if current_raw is not None else ""

    # Pattern: "Référence: XXX" or "Fournisseur : YYY"
    if ":" in current_text:
        _, right = current_text.split(":", 1)
        candidate = right.strip()
        if candidate:
            return candidate

    # Pattern: ["Référence", "XXX"]
    for idx in range(start_idx + 1, len(row_values)):
        value = row_values[idx]
        if value is None:
            continue
        candidate = str(value).strip()
        if candidate:
            return candidate

    return None


def extract_marche_metadata(ws) -> dict:
    """Scan top rows and infer marche + fournisseur metadata."""
    metadata = {
        "reference": None,
        "fournisseur_nom": None,
        "fournisseur_email": None,
        "fournisseur_telephone": None,
    }
    reference_keywords = [
        "reference",
        "numero marche",
        "n marche",
        "n° marche",
        "bon de commande",
    ]
    fournisseur_keywords = [
        "fournisseur",
        "societe",
        "société",
        "denomination",
        "identite",
        "prestataire",
    ]
    phone_keywords = ["tel", "telephone", "téléphone", "gsm"]
    email_keywords = ["email", "e-mail", "mail"]

    for row in ws.iter_rows(min_row=1, max_row=40, values_only=True):
        values = list(row)
        row_text = " ".join(str(v).strip() for v in values if v is not None)
        normalized_cells = [_strip_accents(v).strip() if v is not None else "" for v in values]

        if metadata["fournisseur_email"] is None and row_text:
            email_match = _EMAIL_RE.search(row_text)
            if email_match:
                metadata["fournisseur_email"] = email_match.group(0).strip()

        if metadata["fournisseur_telephone"] is None and row_text:
            phone_match = _PHONE_RE.search(row_text)
            if phone_match:
                metadata["fournisseur_telephone"] = re.sub(
                    r"\s+", " ", phone_match.group(0)
                ).strip()

        for idx, cell_text in enumerate(normalized_cells):
            if not cell_text:
                continue

            if metadata["reference"] is None and any(k in cell_text for k in reference_keywords):
                ref = _extract_value_from_row(values, idx)
                if ref:
                    metadata["reference"] = re.sub(r"\s+", " ", ref).strip()

            if metadata["fournisseur_nom"] is None and any(
                k in cell_text for k in fournisseur_keywords
            ):
                supplier = _extract_value_from_row(values, idx)
                if supplier:
                    metadata["fournisseur_nom"] = re.sub(r"\s+", " ", supplier).strip()

            if (
                metadata["fournisseur_telephone"] is None
                and any(k in cell_text for k in phone_keywords)
            ):
                candidate = _extract_value_from_row(values, idx)
                if candidate:
                    phone_match = _PHONE_RE.search(candidate)
                    if phone_match:
                        metadata["fournisseur_telephone"] = re.sub(
                            r"\s+", " ", phone_match.group(0)
                        ).strip()

            if (
                metadata["fournisseur_email"] is None
                and any(k in cell_text for k in email_keywords)
            ):
                candidate = _extract_value_from_row(values, idx)
                if candidate:
                    email_match = _EMAIL_RE.search(candidate)
                    if email_match:
                        metadata["fournisseur_email"] = email_match.group(0).strip()

            if (
                metadata["reference"]
                and metadata["fournisseur_nom"]
                and metadata["fournisseur_email"]
                and metadata["fournisseur_telephone"]
            ):
                return metadata

    return metadata


def _mark_rejected(import_id: int, observations: str | None = None) -> None:
    """
    Unconditionally set ImportExcelBC.statut_import to 'rejete'.
    Uses select_for_update() inside its own atomic block so it is safe to
    call from the retry-exceeded handler.
    """
    # Late import – this helper may be called from error paths before the
    # Django app registry is fully warm in some test scenarios.
    from apps.procurement.models import ImportExcelBC  # noqa: PLC0415

    try:
        with transaction.atomic():
            imp = (
                ImportExcelBC.objects.select_for_update()
                .filter(pk=import_id)
                .first()
            )
            if imp:
                imp.statut_import = "rejete"
                if observations:
                    imp.observations = observations[:2000]
                    imp.save(update_fields=["statut_import", "observations"])
                else:
                    imp.save(update_fields=["statut_import"])
                logger.info(
                    "extract_excel_items: import %s marked as rejete", import_id
                )
    except Exception:
        logger.exception(
            "_mark_rejected: could not update import %s to rejete", import_id
        )


# ---------------------------------------------------------------------------
# Celery task
# ---------------------------------------------------------------------------


@app.task(queue="ocr", bind=True, max_retries=3)
def extract_excel_items(self, import_id: int, retry_enabled: bool = True) -> None:
    """
    Parse the Excel file attached to *ImportExcelBC(pk=import_id)* and create
    the corresponding StagingItem rows.

    Lifecycle
    ---------
    1.  Fetch ImportExcelBC (select_for_update to avoid concurrent runs).
    2.  Set statut_import → 'en_revision'.
    3.  Open the uploaded .xlsx with openpyxl (read_only=True, data_only=True).
    4.  Pick the first non-empty sheet.
    5.  Detect the header row by scanning for _HEADER_KEYWORDS.
    6.  For each non-empty data row:
        a. Extract *designation* (first non-blank string cell).
        b. Extract *quantite* (first numeric cell; default 0).
        c. Clean designation (strip + collapse whitespace).
        d. Call normalize_designation() for NLP classification.
        e. Accumulate StagingItem instances.
    7.  Bulk-create all StagingItems.
    8.  Set statut_import → 'brouillon'.
    9.  Send 'validation_requise' Notification to every active gestionnaire.
    10. On any exception: retry with exponential backoff; after max_retries
        set statut_import → 'rejete'.
    """
    # All Django model imports are deferred so the task module can be imported
    # before the Django app registry is ready (e.g. during Celery worker boot).
    from apps.procurement.models import (  # noqa: PLC0415
        ImportExcelBC,
        MarcheBC,
        StagingItem,
    )
    from apps.users.models import Fournisseur  # noqa: PLC0415

    try:
        # ── 1 & 2  Fetch + lock + set en_revision ────────────────────────────
        with transaction.atomic():
            try:
                imp = (
                    ImportExcelBC.objects.select_for_update()
                    .get(pk=import_id)
                )
            except ImportExcelBC.DoesNotExist:
                logger.error(
                    "extract_excel_items: ImportExcelBC pk=%s not found",
                    import_id,
                )
                return  # nothing to retry – object simply doesn't exist

            imp.statut_import = "en_revision"
            imp.save(update_fields=["statut_import"])

        # ── 3  Open Excel file ────────────────────────────────────────────────
        import openpyxl  # noqa: PLC0415 — imported lazily; openpyxl is optional

        file_path = imp.fichier_excel_original.path
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)

        try:
            # ── 4  First non-empty sheet ──────────────────────────────────────
            ws = _first_non_empty_sheet(wb)
            metadata = extract_marche_metadata(ws)

            # ── 5  Detect header row ──────────────────────────────────────────
            header_row_idx = _detect_header_row(ws)

            if header_row_idx == -1:
                logger.warning(
                    "extract_excel_items: no header row found in import %s",
                    import_id,
                )
                _mark_rejected(
                    import_id,
                    "En-tête introuvable dans le fichier Excel. Vérifiez le format du document.",
                )
                return

            # ── 6 & 7  Iterate data rows → build StagingItem list ─────────────
            staging_items: list[StagingItem] = []
            designation_col_idx, quantite_col_idx = _detect_data_columns(
                ws, header_row_idx
            )

            for row in ws.iter_rows(min_row=header_row_idx + 1):
                # Skip completely empty rows (trailing blank lines, merged-cell
                # artefacts where only the top-left cell carries a value).
                if _row_is_empty(row):
                    continue

                values = [cell.value for cell in row]

                # Designation: prefer detected designation column, fallback to
                # first non-blank string cell.
                designation: str | None = None
                if (
                    designation_col_idx is not None
                    and designation_col_idx < len(values)
                    and isinstance(values[designation_col_idx], str)
                ):
                    candidate = re.sub(
                        r"\s+", " ", values[designation_col_idx].strip()
                    )
                    designation = candidate if candidate else None

                if not designation:
                    for v in values:
                        if v is not None and isinstance(v, str) and v.strip():
                            designation = re.sub(r"\s+", " ", v.strip())
                            break

                if not designation:
                    # Row contains only numbers / Nones with no text label
                    continue

                designation_norm = _strip_accents(designation)
                if designation_norm in _INVALID_DESIGNATION_TOKENS:
                    continue

                # Quantite: prefer detected quantity column; fallback to first
                # numeric cell (booleans excluded).
                quantite: int = 0
                if (
                    quantite_col_idx is not None
                    and quantite_col_idx < len(values)
                    and isinstance(values[quantite_col_idx], (int, float))
                    and not isinstance(values[quantite_col_idx], bool)
                ):
                    quantite = max(0, int(values[quantite_col_idx]))
                else:
                    for v in values:
                        if isinstance(v, (int, float)) and not isinstance(v, bool):
                            quantite = max(0, int(v))
                            break

                # NLP classification
                nlp = normalize_designation(designation)

                # Confidence stored as Decimal; convert float safely via string
                confiance = Decimal(str(round(float(nlp["confiance_ia"]), 2)))

                staging_items.append(
                    StagingItem(
                        id_import=imp,
                        designation_brute=designation,
                        designation_normalisee=nlp["designation_normalisee"],
                        quantite=quantite,
                        type_detecte="",
                        confiance_ia=confiance,
                        id_categorie_suggeree_id=nlp["id_categorie_suggeree"],
                        id_ressource_liee_id=nlp["id_ressource_liee"],
                    )
                )

        finally:
            wb.close()

        if staging_items:
            StagingItem.objects.bulk_create(staging_items)

        # Try to enrich MarcheBC from extracted metadata
        marche = imp.id_marche
        marche_updates = []

        extracted_reference = metadata.get("reference")
        if extracted_reference:
            normalized_ref = extracted_reference[:100]
            if not MarcheBC.objects.filter(reference=normalized_ref).exclude(
                pk=marche.pk
            ).exists():
                marche.reference = normalized_ref
                marche_updates.append("reference")

        fournisseur_nom = metadata.get("fournisseur_nom")
        fournisseur_email = metadata.get("fournisseur_email")
        fournisseur_telephone = metadata.get("fournisseur_telephone")
        if fournisseur_nom:
            fournisseur = Fournisseur.objects.filter(
                nom_societe__icontains=fournisseur_nom
            ).first()

            if not fournisseur:
                fournisseur = Fournisseur.objects.create(
                    nom_societe=fournisseur_nom[:255],
                    nom_responsable=fournisseur_nom[:200],
                    email=(fournisseur_email or "contact@inconnu.local")[:254],
                    telephone=(fournisseur_telephone or "")[:20],
                )

            if fournisseur:
                fournisseur_updated = False
                if fournisseur_email and fournisseur.email != fournisseur_email[:254]:
                    fournisseur.email = fournisseur_email[:254]
                    fournisseur_updated = True
                if (
                    fournisseur_telephone
                    and fournisseur.telephone != fournisseur_telephone[:20]
                ):
                    fournisseur.telephone = fournisseur_telephone[:20]
                    fournisseur_updated = True
                if fournisseur_updated:
                    fournisseur.save(update_fields=["email", "telephone"])

                marche.id_fournisseur = fournisseur
                marche_updates.append("id_fournisseur")

        if marche_updates:
            marche.save(update_fields=marche_updates)

        item_count = len(staging_items)
        logger.info(
            "extract_excel_items: import %s → %d staging item(s) created",
            import_id,
            item_count,
        )

        # ── 8  Update status to brouillon (ready for review) ─────────────────
        with transaction.atomic():
            imp_final = (
                ImportExcelBC.objects.select_for_update().get(pk=import_id)
            )
            imp_final.statut_import = "brouillon"
            imp_final.save(update_fields=["statut_import"])

        logger.info(
            "extract_excel_items: import %s complete — awaiting finance validation before notification",
            import_id,
        )

    except Exception as exc:
        logger.exception(
            "extract_excel_items: unhandled error on import %s", import_id
        )

        if not retry_enabled:
            _mark_rejected(
                import_id,
                f"Extraction échouée: {str(exc)[:1800]}",
            )
            return

        # Exponential backoff: 60 s → 120 s → 240 s
        countdown = (2 ** self.request.retries) * 60
        try:
            raise self.retry(exc=exc, countdown=countdown)
        except MaxRetriesExceededError:
            # All retries exhausted — permanently mark the import as rejected
            _mark_rejected(
                import_id,
                f"Extraction échouée: {str(exc)[:1800]}",
            )
