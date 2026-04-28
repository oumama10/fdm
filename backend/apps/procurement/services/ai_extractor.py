import logging
import re
from decimal import Decimal, InvalidOperation

logger = logging.getLogger(__name__)

MAX_RAW_TEXT_CHARS = 20_000
MAX_QUANTITY = 1_000_000


class AIExtractor:

    @classmethod
    def extract_from_pdf(cls, raw_text: str, table_rows: list[list[str]] | None = None) -> dict:
        """Extract structured data from PDF text and optional table rows."""
        result = cls.extract_from_text(raw_text)
        table_lignes = cls._extract_from_table_rows(table_rows or [])
        if table_lignes:
            result["lignes"] = table_lignes
        return result

    @classmethod
    def extract_from_text(cls, raw_text: str) -> dict:
        """Extract structured data from raw text using library-based parsing (no LLM)."""
        prepared = (raw_text or "").strip()
        if not prepared:
            return cls._empty_result("library")

        if len(prepared) > MAX_RAW_TEXT_CHARS:
            prepared = prepared[:MAX_RAW_TEXT_CHARS]

        logger.info("Raw text size: %s chars", len(prepared))

        # Use only library-based parsing (no LLM calls)
        result = cls._fallback_parse(prepared)
        result["source"] = "library"
        logger.info("Library extraction extracted %s lignes", len(result["lignes"]))
        return result

    @classmethod
    def _fallback_parse(cls, raw_text: str) -> dict:
        """
        Library-based parsing using regex and text analysis.
        Handles structured documents (purchase orders, invoices, quotes).
        """
        header = {
            "titre_document": None,
            "reference": None,
            "fournisseur_denomination": None,
            "fournisseur_telephone": None,
            "fournisseur_email": None,
            "fournisseur_adresse": None,
            "delai_execution": None,
        }

        # Extract title/document type
        title_match = re.search(
            r"(?im)^(bon de commande|marche|march[eé]|facture|devis|quotation|invoice|purchase order)\b[^\n\r]*",
            raw_text
        )
        if title_match:
            header["titre_document"] = title_match.group(0).strip()

        # Extract email
        email_match = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", raw_text, re.IGNORECASE)
        if email_match:
            header["fournisseur_email"] = email_match.group()

        # Extract phone (Moroccan and international formats)
        phone_match = re.search(
            r"(?:Tél\s*[:.]?\s*)?(0[5-7]\d{8}|\+212\d{9}|(?:\+\d{1,3})?\d{9,15})",
            raw_text
        )
        if phone_match:
            header["fournisseur_telephone"] = phone_match.group(1) or phone_match.group()

        # Extract reference/order number
        explicit_ref = cls._extract_reference_from_labeled_lines(raw_text)
        ref_patterns = [
            r"(?:Réf(?:érence)?|Reference|Référence BC|N[°o]\s*BC|BC N[°o]|Order\s*No|Commande\s*No)\s*[:.]?\s*([\w\-/]+)",
            r"BC\s*[:\-]?\s*([\w\-/]+)",
            r"Marché\s*[:\-]?\s*([\w\-/]+)",
        ]
        for pattern in ref_patterns:
            ref_match = re.search(pattern, raw_text, re.IGNORECASE)
            if ref_match:
                header["reference"] = ref_match.group(1)
                break
        header["reference"] = (
            cls._clean_reference(explicit_ref)
            or cls._clean_reference(header["reference"])
            or cls._extract_reference_from_title(raw_text)
        )

        # Extract supplier/fournisseur name
        supplier_patterns = [
            r"(?:Dénomination|Raison sociale|Fournisseur|Supplier|Company)\s*[:.]?\s*([^\n\r]+?)(?:\n|$)",
            r"From:\s*([^\n\r]+?)(?:\n|$)",
        ]
        for pattern in supplier_patterns:
            supplier_match = re.search(pattern, raw_text, re.IGNORECASE)
            if supplier_match:
                supplier_name = cls._clean_supplier_name(supplier_match.group(1))
                if supplier_name and len(supplier_name) > 2:
                    header["fournisseur_denomination"] = supplier_name
                    break

        # Extract address
        address_patterns = [
            r"(?:Adresse|Address|Adresse du fournisseur)\s*[:.]?\s*([^\n\r]+?)(?:\n|$)",
        ]
        for pattern in address_patterns:
            address_match = re.search(pattern, raw_text, re.IGNORECASE)
            if address_match:
                address = address_match.group(1).strip()
                if address:
                    header["fournisseur_adresse"] = address
                    break

        # Extract execution deadline (prefer values that look like an actual delay: jours/mois/date).
        header["delai_execution"] = cls._extract_best_deadline(raw_text)

        # Try to extract lines from structured table/list format
        lignes = cls._extract_table_lines(raw_text)

        # If table extraction didn't work, fall back to line pattern matching
        if not lignes:
            lignes = cls._extract_pattern_lines(raw_text)

        return {
            "header": header,
            "titre_document": header["titre_document"],
            "reference": header["reference"],
            "fournisseur_denomination": header["fournisseur_denomination"],
            "fournisseur_telephone": header["fournisseur_telephone"],
            "fournisseur_email": header["fournisseur_email"],
            "fournisseur_adresse": header["fournisseur_adresse"],
            "delai_execution": header["delai_execution"],
            "fournisseur": {
                "denomination": header["fournisseur_denomination"],
                "telephone": header["fournisseur_telephone"],
                "email": header["fournisseur_email"],
                "adresse": header["fournisseur_adresse"],
            },
            "commande": {
                "reference": header["reference"],
                "numero_bc": header["reference"],
                "delai_execution": header["delai_execution"],
            },
            "lignes": lignes,
            "totaux": {"montant_ht": None, "montant_tva": None, "montant_ttc": None},
        }

    @classmethod
    def _extract_table_lines(cls, raw_text: str) -> list[dict]:
        """
        Extract line items from table-like structures.
        Handles formats with columns separated by pipes, tabs, or multiple spaces.
        """
        lignes = []

        # Pattern: Structured rows with quantities and prices
        # Format: "No | Designation | Qty | Unit | Price | Total"
        table_pattern = re.compile(
            r"^(\d{1,4})\s*[\|│]\s*(.+?)\s*[\|│]\s*(\d+(?:[.,]\d+)?)\s*[\|│](?:\s*(\w+)\s*[\|│])?\s*([\d.,\s]+)\s*(?:MAD|€|$|DH)?\s*[\|│]?\s*([\d.,\s]+)?",
            re.MULTILINE | re.IGNORECASE | re.DOTALL
        )

        for match in table_pattern.finditer(raw_text):
            designation = re.sub(r"\s+", " ", match.group(2)).strip()
            if not designation or len(designation) < 2:
                continue

            try:
                quantite = cls._coerce_int(match.group(3), default=1)
                unite = match.group(4) or "U"
                prix_unitaire = cls._coerce_decimal(match.group(5))
                prix_total = cls._coerce_decimal(match.group(6))

                designation, description = cls._split_designation_and_description(designation)
                cleaned_designation = cls._clean_designation(designation)
                if cls._is_summary_row(cleaned_designation, description, prix_unitaire, prix_total):
                    continue

                lignes.append({
                    "designation": cleaned_designation[:500],
                    "description": description[:4000],
                    "quantite": quantite,
                    "unite": unite.strip(),
                    "prix_unitaire_ht": prix_unitaire,
                    "prix_total_ht": prix_total,
                })
            except Exception:
                continue

        return lignes

    @classmethod
    def _extract_from_table_rows(cls, table_rows: list[list[str]]) -> list[dict]:
        if not table_rows:
            return []

        header_idx = None
        mapping = {}

        for i, row in enumerate(table_rows[:20]):
            lowered = [str(cell or "").strip().lower() for cell in row]
            candidate = {
                "designation": None,
                "description": None,
                "quantite": None,
                "pu": None,
                "pt": None,
                "unite": None,
            }
            for idx, cell in enumerate(lowered):
                if any(k in cell for k in ["designation", "désignation", "article", "objet"]):
                    candidate["designation"] = idx
                elif "description" in cell:
                    candidate["description"] = idx
                elif any(k in cell for k in ["quantite", "quantité", "qte", "qté"]):
                    candidate["quantite"] = idx
                elif any(k in cell for k in ["pu ht", "prix unitaire", "p.u", "unit price"]):
                    candidate["pu"] = idx
                elif any(k in cell for k in ["pt ht", "prix total", "montant", "total"]):
                    candidate["pt"] = idx
                elif any(k in cell for k in ["unite", "unité", "unit"]):
                    candidate["unite"] = idx

            if candidate["designation"] is not None and candidate["quantite"] is not None:
                header_idx = i
                mapping = candidate
                break

        if header_idx is None:
            return []

        lignes = []
        for row in table_rows[header_idx + 1:]:
            if not row:
                continue

            max_idx = len(row) - 1
            def get_cell(key: str) -> str:
                idx = mapping.get(key)
                if idx is None or idx > max_idx:
                    return ""
                return str(row[idx] or "").strip()

            designation_raw = get_cell("designation")
            description_raw = get_cell("description")
            quantite_raw = get_cell("quantite")
            unite_raw = get_cell("unite")
            pu_raw = get_cell("pu")
            pt_raw = get_cell("pt")

            if not any([designation_raw, description_raw, quantite_raw, pu_raw, pt_raw]):
                continue

            designation_raw = re.sub(r"\s+", " ", designation_raw)
            description_raw = re.sub(r"\s+", " ", description_raw)

            # Some PDFs split the real label into description while designation becomes "1 (U)".
            if re.match(r"^\d+\s*\([^)]*\)\s*$", designation_raw) and len(description_raw) > 5:
                designation_raw, description_raw = description_raw, ""

            if not designation_raw or designation_raw in {"-", "--"}:
                continue

            designation, auto_description = cls._split_designation_and_description(designation_raw)
            final_description = description_raw or auto_description
            quantite = cls._coerce_int(quantite_raw, default=1)
            prix_unitaire = cls._coerce_decimal(pu_raw)
            prix_total = cls._coerce_decimal(pt_raw)
            cleaned_designation = cls._clean_designation(designation)
            if cls._is_summary_row(cleaned_designation, final_description, prix_unitaire, prix_total):
                continue

            lignes.append({
                "designation": cleaned_designation[:500],
                "description": final_description[:4000],
                "quantite": quantite,
                "unite": (unite_raw or "U")[:20],
                "prix_unitaire_ht": prix_unitaire,
                "prix_total_ht": prix_total,
            })

        return lignes

    @classmethod
    def _extract_pattern_lines(cls, raw_text: str) -> list[dict]:
        """
        Extract line items using regex patterns for common document formats.
        Handles both numbered and bullet-point lists.
        """
        lignes = []

        # Pattern 1: Numbered items with quantity and prices
        # Format: "1. Designation ... 10 ... 50.00 MAD ... 500.00 MAD"
        line_pattern = re.compile(
            r"^(\d{1,2})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:\(?\w*\)?)?\s+([\d\s,]+)\s+(?:MAD|€|$|DH)?\s+([\d\s,]+)\s+(?:MAD|€|$|DH)?",
            re.MULTILINE | re.DOTALL
        )

        for m in line_pattern.finditer(raw_text):
            raw_designation = re.sub(r"\s+", " ", m.group(2)).strip()
            designation, description = cls._split_designation_and_description(raw_designation)

            try:
                cleaned_designation = cls._clean_designation(designation)
                prix_unitaire = cls._coerce_decimal(m.group(4).replace(" ", "").replace(",", "."))
                prix_total = cls._coerce_decimal(m.group(5).replace(" ", "").replace(",", "."))
                if cls._is_summary_row(cleaned_designation, description, prix_unitaire, prix_total):
                    continue
                lignes.append({
                    "designation": cleaned_designation[:500],
                    "description": description[:4000],
                    "quantite": cls._coerce_int(m.group(3), default=1),
                    "unite": "U",
                    "prix_unitaire_ht": prix_unitaire,
                    "prix_total_ht": prix_total,
                })
            except Exception:
                continue

        # Pattern 2: If no structured pattern found, extract any substantial lines as items
        if not lignes:
            for line in raw_text.splitlines():
                line = re.sub(r"\s+", " ", line).strip()
                # Skip headers, totals, and very short lines
                if (len(line) >= 5 and
                    not re.match(r"(?i)(total|sous|designation|quantité|prix|article|unit|qty|description)", line) and
                    not line.startswith("---") and
                    not line.startswith("===")):

                    designation, description = cls._split_designation_and_description(line)
                    cleaned_designation = cls._clean_designation(designation)
                    if cls._is_summary_row(cleaned_designation, description, None, None):
                        continue
                    lignes.append({
                        "designation": cleaned_designation[:500],
                        "description": description[:4000],
                        "quantite": 1,
                        "unite": "U",
                        "prix_unitaire_ht": None,
                        "prix_total_ht": None,
                    })

        return lignes

    @classmethod
    def build_import_metadata(cls, result: dict) -> dict:
        header = result.get("header") or {}
        return {
            "titre_fichier": header.get("titre_document") or result.get("titre_document") or "",
            "reference_document": header.get("reference") or result.get("reference") or "",
            "fournisseur_denomination": header.get("fournisseur_denomination") or result.get("fournisseur_denomination") or "",
            "fournisseur_telephone": header.get("fournisseur_telephone") or result.get("fournisseur_telephone") or "",
            "fournisseur_email": header.get("fournisseur_email") or result.get("fournisseur_email") or "",
            "fournisseur_adresse": header.get("fournisseur_adresse") or result.get("fournisseur_adresse") or "",
            "delai_execution": header.get("delai_execution") or result.get("delai_execution") or "",
        }

    @staticmethod
    def _split_designation_and_description(text: str) -> tuple[str, str]:
        cleaned = re.sub(r"\s+", " ", (text or "")).strip()
        if not cleaned:
            return "", ""

        separators = [
            r"\s+caract[eé]ristiques?\s*[:\-]",
            r"\s+sp[eé]cifications?\s*[:\-]",
            r"\s+description\s*[:\-]",
            r"\s*:\s*",
        ]

        for sep in separators:
            parts = re.split(sep, cleaned, maxsplit=1, flags=re.IGNORECASE)
            if len(parts) == 2 and parts[0].strip() and parts[1].strip():
                return parts[0].strip(), parts[1].strip()

        # If no separator, keep a concise product title and leave details empty.
        tokens = cleaned.split()
        short_name = " ".join(tokens[:12]).strip()
        return short_name, ""

    @staticmethod
    def _clean_designation(value: str | None) -> str:
        cleaned = str(value or "")
        cleaned = re.sub(r"(?i)\s+caract[eé]ristiques?\s+et\s*$", "", cleaned)
        cleaned = re.sub(r"(?i)\s+caract[eé]ristiques?\s*$", "", cleaned)
        cleaned = re.sub(r"(?i)\s+sp[eé]cifications?\s+techniques?\s*$", "", cleaned)
        cleaned = re.sub(r"[\-*:,;\s]+$", "", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned

    @staticmethod
    def _is_summary_row(
        designation: str | None,
        description: str | None,
        prix_unitaire: Decimal | None,
        prix_total: Decimal | None,
    ) -> bool:
        d = re.sub(r"\s+", " ", str(designation or "")).strip().lower()
        desc = re.sub(r"\s+", " ", str(description or "")).strip().lower()

        if not d:
            return True

        if any(keyword in d for keyword in ["total", "sous total", "tva", "montant", "net a payer", "net à payer"]):
            return True

        monetary_only = re.match(
            r"^\d{1,3}(?:[\s.\u202f]\d{3})*(?:,\d{2})?\s*(?:mad|dh|dhs|€|\$)?$",
            d,
            flags=re.IGNORECASE,
        )
        if monetary_only and (desc in {"", "-", "--"}) and (prix_unitaire is None and prix_total is None):
            return True

        return False

    @staticmethod
    def _coerce_int(value, default: int = 1) -> int:
        try:
            result = int(float(str(value).replace(",", ".")))
            if result <= 0:
                return default
            return min(result, MAX_QUANTITY)
        except Exception:
            return default

    @staticmethod
    def _coerce_decimal(value) -> Decimal | None:
        if value is None:
            return None
        try:
            cleaned = str(value).replace("\u202f", "").replace("\xa0", "").replace(" ", "").replace(",", ".")
            cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
            return Decimal(cleaned).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _clean_supplier_name(value: str | None) -> str | None:
        if not value:
            return None
        cleaned = str(value)
        cleaned = re.sub(r"(?i)^\s*(?:ou\s+identit[ée]\s*:)\s*", "", cleaned)
        cleaned = re.split(r"(?i)\b(?:t[ée]l(?:[ée]phone)?|phone)\b", cleaned, maxsplit=1)[0]
        cleaned = cleaned.strip(" -:;,.\t")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned or None

    @staticmethod
    def _clean_reference(value: str | None) -> str | None:
        if not value:
            return None
        cleaned = str(value).strip(" -:;,.\t")
        cleaned = re.sub(r"(?i)^r[ée]f(?:[ée]rence)?\s*", "", cleaned)
        cleaned = re.sub(r"\s+", "", cleaned)
        if cleaned.lower() in {"erence", "reference", "référence", "ref"}:
            return None
        return cleaned or None

    @staticmethod
    def _extract_reference_from_title(raw_text: str) -> str | None:
        patterns = [
            r"(?i)BON\s+DE\s+COMMANDE\s*N[°o]?\s*([\d/-]+)",
            r"(?i)N[°o]\s*[:.]?\s*([\d]{2,}/[\d]{2,4})",
        ]
        for pattern in patterns:
            m = re.search(pattern, raw_text)
            if m:
                return m.group(1).strip()
        return None

    @classmethod
    def _extract_reference_from_labeled_lines(cls, raw_text: str) -> str | None:
        for line in raw_text.splitlines():
            if not re.search(r"(?i)r[ée]f|reference|r[ée]f[ée]rence", line):
                continue
            # Prefer patterns like 412/2025 or BC-2025-001 on the same line.
            for pattern in [r"([A-Za-z0-9-]{2,}/\d{2,4})", r"([A-Za-z]{1,4}-\d{2,4}-\d{1,6})"]:
                m = re.search(pattern, line)
                if m:
                    candidate = cls._clean_reference(m.group(1))
                    if candidate:
                        return candidate
        return None

    @classmethod
    def _extract_best_deadline(cls, raw_text: str) -> str | None:
        candidates: list[str] = []
        for line in raw_text.splitlines():
            if re.search(r"(?i)d[ée]lai|livraison|delivery date|deadline", line):
                cleaned = cls._clean_deadline(line)
                if cleaned:
                    candidates.append(cleaned)

        if not candidates:
            return None

        # Highest priority: explicit delay with numbers + time unit.
        for c in candidates:
            m = re.search(r"(\d+\s*(?:jour|jours|j|mois|semaine|semaines).*)", c, re.IGNORECASE)
            if m:
                return m.group(1).strip()

        # Then an explicit date.
        for c in candidates:
            if re.search(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", c):
                return c

        # Fallback to first non-empty candidate.
        return candidates[0]

    @staticmethod
    def _clean_deadline(value: str | None) -> str | None:
        if not value:
            return None
        cleaned = str(value)
        cleaned = re.sub(r"(?i)^\s*(?:d[ée]lai\s*(?:/\s*livraison)?|livraison|delivery\s*date)\s*[:.-]?\s*", "", cleaned)
        cleaned = re.sub(r"(?i)^\s*(?:d[ée]lai\s+d['’]ex[ée]cution|date\s+de\s+livraison)\s*[:.-]?\s*", "", cleaned)
        cleaned = re.sub(r"(?i)^\s*/\s*livraison\s*[:.-]?\s*", "", cleaned)
        cleaned = re.split(r"(?i)\b(?:t[ée]l(?:[ée]phone)?|email|adresse)\b", cleaned, maxsplit=1)[0]
        cleaned = cleaned.strip(" -:;,.\t")
        cleaned = re.sub(r"\s+", " ", cleaned)
        if cleaned.lower() in {"fes", "rabat", "casablanca", "meknes", "marrakech"}:
            return None
        return cleaned or None

    @staticmethod
    def _empty_result(source: str) -> dict:
        return {
            "fournisseur": {},
            "commande": {},
            "lignes": [],
            "totaux": {},
            "source": source,
        }
