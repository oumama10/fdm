import logging
import re
from decimal import Decimal, InvalidOperation

from apps.core.services.openrouter_client import OpenRouterClient

logger = logging.getLogger(__name__)

MAX_RAW_TEXT_CHARS = 20_000
MAX_QUANTITY = 1_000_000


class AIExtractor:

    @classmethod
    def extract_from_text(cls, raw_text: str) -> dict:
        prepared = (raw_text or "").strip()
        if not prepared:
            return cls._empty_result("fallback")

        if len(prepared) > MAX_RAW_TEXT_CHARS:
            prepared = prepared[:MAX_RAW_TEXT_CHARS]

        logger.info("Raw text size: %s chars", len(prepared))

        try:
            raw = OpenRouterClient.extract_bc_document(prepared)
            result = cls._normalize_llm_result(raw)
            result["source"] = "llm"
            logger.info("LLM extracted %s lignes", len(result["lignes"]))
            return result
        except Exception:
            logger.exception("LLM extraction failed, using deterministic fallback")
            result = cls._fallback_parse(prepared)
            result["source"] = "fallback"
            logger.info("Fallback extracted %s lignes", len(result["lignes"]))
            return result

    @classmethod
    def _normalize_llm_result(cls, raw: dict) -> dict:
        fournisseur = raw.get("fournisseur") or {}
        commande = raw.get("commande") or {}
        header = raw.get("header") or {}
        totaux = raw.get("totaux") or {}
        if not header:
            header = {
                "titre_document": raw.get("titre_document") or raw.get("title"),
                "reference": raw.get("reference") or commande.get("reference") or commande.get("numero_bc"),
                "fournisseur_denomination": raw.get("fournisseur_denomination") or fournisseur.get("denomination"),
                "fournisseur_telephone": raw.get("fournisseur_telephone") or fournisseur.get("telephone"),
                "fournisseur_email": raw.get("fournisseur_email") or fournisseur.get("email"),
                "fournisseur_adresse": raw.get("fournisseur_adresse") or fournisseur.get("adresse"),
                "delai_execution": raw.get("delai_execution") or commande.get("delai_execution") or commande.get("lieu_execution"),
            }
        lignes_raw = raw.get("lignes") or []

        lignes = []
        for item in lignes_raw:
            if not isinstance(item, dict):
                continue
            designation = str(item.get("designation") or "").strip()
            description = str(item.get("description") or "").strip()
            if not description and designation:
                designation, description = cls._split_designation_and_description(designation)
            if not designation:
                continue
            lignes.append({
                "designation": designation[:500],
                "description": description[:4000],
                "quantite": cls._coerce_int(item.get("quantite"), default=1),
                "unite": str(item.get("unite") or "U"),
                "prix_unitaire_ht": cls._coerce_decimal(item.get("prix_unitaire_ht")),
                "prix_total_ht": cls._coerce_decimal(item.get("prix_total_ht")),
            })

        return {
            "header": {
                "titre_document": cls._clean_str(header.get("titre_document")),
                "reference": cls._clean_str(header.get("reference")),
                "fournisseur_denomination": cls._clean_str(header.get("fournisseur_denomination")),
                "fournisseur_telephone": cls._clean_str(header.get("fournisseur_telephone")),
                "fournisseur_email": cls._clean_str(header.get("fournisseur_email")),
                "fournisseur_adresse": cls._clean_str(header.get("fournisseur_adresse")),
                "delai_execution": cls._clean_str(header.get("delai_execution")),
            },
            "titre_document": cls._clean_str(header.get("titre_document")),
            "reference": cls._clean_str(header.get("reference")),
            "fournisseur_denomination": cls._clean_str(header.get("fournisseur_denomination")),
            "fournisseur_telephone": cls._clean_str(header.get("fournisseur_telephone")),
            "fournisseur_email": cls._clean_str(header.get("fournisseur_email")),
            "fournisseur_adresse": cls._clean_str(header.get("fournisseur_adresse")),
            "delai_execution": cls._clean_str(header.get("delai_execution")),
            "fournisseur": {k: (str(v).strip() if v else None) for k, v in fournisseur.items()},
            "commande": {k: (str(v).strip() if v else None) for k, v in commande.items()},
            "lignes": lignes,
            "totaux": {
                "montant_ht": cls._coerce_decimal(totaux.get("montant_ht")),
                "montant_tva": cls._coerce_decimal(totaux.get("montant_tva")),
                "montant_ttc": cls._coerce_decimal(totaux.get("montant_ttc")),
            },
        }

    @classmethod
    def _fallback_parse(cls, raw_text: str) -> dict:
        header = {
            "titre_document": None,
            "reference": None,
            "fournisseur_denomination": None,
            "fournisseur_telephone": None,
            "fournisseur_email": None,
            "fournisseur_adresse": None,
            "delai_execution": None,
        }

        title_match = re.search(r"(?im)^(bon de commande|marche|march[eé])\b[^\n\r]*", raw_text)
        if title_match:
            header["titre_document"] = title_match.group(0).strip()

        email_match = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", raw_text, re.IGNORECASE)
        if email_match:
            header["fournisseur_email"] = email_match.group()

        phone_match = re.search(r"(?:Tél\s*[:.]?\s*)?(0[5-7]\d{8}|\+212\d{9})", raw_text)
        if phone_match:
            header["fournisseur_telephone"] = phone_match.group(1) or phone_match.group()

        ref_match = re.search(
            r"(?:Réf(?:érence)?|Reference|Référence BC|N[°o]\s*BC|BC N[°o])\s*[:.]?\s*([\w\-/]+)",
            raw_text,
            re.IGNORECASE,
        )
        if ref_match:
            header["reference"] = ref_match.group(1)

        supplier_match = re.search(
            r"(?:Dénomination|Raison sociale|Fournisseur)\s*[:.]?\s*([^\n\r]+)",
            raw_text,
            re.IGNORECASE,
        )
        if supplier_match:
            header["fournisseur_denomination"] = supplier_match.group(1).strip()

        address_match = re.search(
            r"(?:Adresse|Adresse du fournisseur)\s*[:.]?\s*([^\n\r]+)",
            raw_text,
            re.IGNORECASE,
        )
        if address_match:
            header["fournisseur_adresse"] = address_match.group(1).strip()

        deadline_match = re.search(
            r"(?:Délai(?: d['’]exécution)?|Date d['’]exécution|Date de livraison|Livraison)\s*[:.]?\s*([^\n\r]+)",
            raw_text,
            re.IGNORECASE,
        )
        if deadline_match:
            header["delai_execution"] = deadline_match.group(1).strip()

        bc_match = re.search(r"BON DE COMMANDE\s+N[°o]?\s*([\d/]+)", raw_text, re.IGNORECASE)
        if bc_match:
            header["reference"] = header["reference"] or bc_match.group(1)

        lignes = []
        line_pattern = re.compile(
            r"^(\d{1,2})\s+(.+?)\s+(\d+)\s*\(?\w*\)?\s+([\d\s,]+)\s+MAD\s+([\d\s,]+)\s+MAD",
            re.MULTILINE | re.DOTALL,
        )
        for m in line_pattern.finditer(raw_text):
            raw_designation = re.sub(r"\s+", " ", m.group(2)).strip()
            designation, description = cls._split_designation_and_description(raw_designation)
            lignes.append({
                "designation": designation[:500],
                "description": description[:4000],
                "quantite": cls._coerce_int(m.group(3), default=1),
                "unite": "U",
                "prix_unitaire_ht": cls._coerce_decimal(m.group(4).replace(" ", "").replace(",", ".")),
                "prix_total_ht": cls._coerce_decimal(m.group(5).replace(" ", "").replace(",", ".")),
            })

        if not lignes:
            for line in raw_text.splitlines():
                line = re.sub(r"\s+", " ", line).strip()
                if len(line) >= 5:
                    designation, description = cls._split_designation_and_description(line)
                    lignes.append({
                        "designation": designation[:500],
                        "description": description[:4000],
                        "quantite": 1,
                        "unite": "U",
                        "prix_unitaire_ht": None,
                        "prix_total_ht": None,
                    })

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

    @staticmethod
    def _clean_str(value):
        if value is None:
            return None
        value = str(value).strip()
        return value or None

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
        short_name = " ".join(tokens[:8]).strip()
        return short_name, ""

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
            cleaned = str(value).replace(" ", "").replace(",", ".")
            return Decimal(cleaned).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _empty_result(source: str) -> dict:
        return {
            "fournisseur": {},
            "commande": {},
            "lignes": [],
            "totaux": {},
            "source": source,
        }
