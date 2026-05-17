import logging
import re
from decimal import Decimal, InvalidOperation

logger = logging.getLogger(__name__)

MAX_RAW_TEXT_CHARS = 20_000
MAX_QUANTITY = 1_000_000


class AIExtractor:
    """Pure pdfplumber-based extraction — no LLM, deterministic regex parsing."""

    SUMMARY_LABEL_RE = re.compile(
        r"\b(?:total|sous\s*total|sous-total|montant|tva|ttc|net\s*à\s*payer|net\s*a\s*payer|rabais|remise|réduction|reduction)\b",
        re.IGNORECASE,
    )
    AMOUNT_ONLY_RE = re.compile(
        r"^\s*(?:[-–]?)\s*\d{1,3}(?:[\s\u00a0]\d{3})*(?:[,.]\d{2})?\s*(?:mad|dh|dhs|tnd|eur|€)?\s*$",
        re.IGNORECASE,
    )

    @classmethod
    def extract_from_text(cls, raw_text: str) -> dict:
        """Parse raw text from PDF using regex patterns only."""
        prepared = (raw_text or "").strip()
        if not prepared:
            return cls._empty_result("fallback")

        if len(prepared) > MAX_RAW_TEXT_CHARS:
            prepared = prepared[:MAX_RAW_TEXT_CHARS]

        logger.info("Raw text size: %s chars", len(prepared))

        result = cls._fallback_parse(prepared)
        result["source"] = "regex"
        logger.info("Regex extracted %s lignes", len(result["lignes"]))
        return result

    @classmethod
    def extract_from_pdf(cls, pdf_path: str) -> dict:
        """Open a PDF with pdfplumber and prefer table extraction when available.

        Returns the same result structure as `extract_from_text`.
        """
        try:
            import pdfplumber
        except Exception:
            logger.exception("pdfplumber is required to extract from PDF files")
            return cls._empty_result("pdfplumber_missing")

        pages_text = []
        table_rows = []
        try:
            with pdfplumber.open(str(pdf_path)) as pdf:
                for page in pdf.pages:
                    # Try to extract tables first (structured columns)
                    try:
                        tables = page.extract_tables()
                    except Exception:
                        tables = None

                    if tables:
                        for table in tables:
                            # Table is a list of rows; normalize
                            for row in table:
                                # skip rows that are all empty
                                if not any(cell and str(cell).strip() for cell in row):
                                    continue
                                table_rows.append([str(cell).strip() if cell is not None else "" for cell in row])

                    # Always collect plain text as fallback
                    pages_text.append(page.extract_text() or "")
        except Exception:
            logger.exception("Failed to open PDF: %s", pdf_path)
            return cls._empty_result("pdf_open_failed")

        raw = "\n".join(pages_text)

        # If we found table rows, attempt structured mapping
        if table_rows:
            mapped = cls._map_table_rows(table_rows)
            # combine header parse from raw text with table items
            parsed = cls._fallback_parse(raw)
            parsed["lignes"] = mapped or parsed.get("lignes", [])
            parsed["source"] = "pdf_table"
            return parsed

        # No table rows found — fallback to text parsing
        return cls.extract_from_text(raw)

    @classmethod
    def _fallback_parse(cls, raw_text: str) -> dict:
        """Deterministic regex parsing for PDF content."""
        header = {
            "titre_document": None,
            "reference": None,
            "fournisseur_denomination": None,
            "fournisseur_telephone": None,
            "fournisseur_email": None,
            "fournisseur_adresse": None,
            "delai_execution": None,
        }

        # Enhanced title detection: supports various document types
        title_patterns = [
            r"(?im)^(bon de commande|marche|march[eé]|devis|facture|invoice|demande d[' ]offre)\b[^\n\r]*",
            r"(?im)(bon de commande|marche|march[eé])\s+n[°o]?\s*[\w\-/]+",
        ]
        for pattern in title_patterns:
            title_match = re.search(pattern, raw_text)
            if title_match:
                header["titre_document"] = title_match.group(0).strip()
                break

        # Enhanced email detection: catches more variations
        email_patterns = [
            r"(?:mail|email|e-mail|courrier)\s*[:.]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
            r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
        ]
        for pattern in email_patterns:
            email_match = re.search(pattern, raw_text, re.IGNORECASE)
            if email_match:
                email_val = email_match.group(1) if email_match.groups() else email_match.group(0)
                email_val = cls._clean_extracted_value(email_val)
                if email_val and '@' in email_val:
                    header["fournisseur_email"] = email_val.lower()[:255]
                    break

        # Enhanced phone detection: supports multiple formats
        phone_patterns = [
            r"(?:Tél\.\s*|Tél\s*|Téléphone\s*|Phone\s*|Mob\.\s*|Mobile\s*)[:.]?\s*([+\d\s\-().]+\d)",
            r"(0[5-7]\d{8}|\+212[5-7]\d{8}|00212[5-7]\d{8})",
            r"(06\d{8}|07\d{8}|05\d{8}|\+212\d{9})",
        ]
        for pattern in phone_patterns:
            phone_match = re.search(pattern, raw_text, re.IGNORECASE)
            if phone_match:
                phone_val = phone_match.group(1) if phone_match.groups() else phone_match.group(0)
                phone_val = cls._clean_extracted_value(phone_val)
                if phone_val and any(c.isdigit() for c in phone_val):
                    header["fournisseur_telephone"] = phone_val[:20]
                    break

        # Enhanced reference detection: tries multiple patterns in order
        ref_patterns = [
            r"(?:Réf\s*\(\s*Num[eé]ro\s*du\s*marche\)|Réf\s*du\s*march[eé])\s*[:.]?\s*([^\n\r:]+)",
            r"(?:N[°o]\s*(?:de\s+)?march[eé]|N[°o]\s+marche|March[eé]\s+N[°o]|Num[eé]ro\s+march[eé])\s*[:.]?\s*([^\n\r:]+)",
            r"(?:R[eé]f[eé]rence|Reference|R[eé]f[eé]rence\s+BC|N[°o]\s*BC|BC\s+N[°o]|No\.\s+BC|R[eé]f\.?)\s*[:.]?\s*([^\n\r:,;]+)",
            r"(?:BON|BC)\s+(?:DE\s+COMMANDE\s+)?N[°o]?\s*[:.]?\s*([\d/\-]+)",
        ]
        for pattern in ref_patterns:
            ref_match = re.search(pattern, raw_text, re.IGNORECASE)
            if ref_match:
                ref_candidate = ref_match.group(1) if ref_match.groups() else ref_match.group(0)
                ref_candidate = cls._clean_extracted_value(ref_candidate)
                if ref_candidate and len(ref_candidate.strip()) > 0 and not ref_candidate.lower().startswith('erence'):
                    header["reference"] = ref_candidate[:100]
                    break

        # Enhanced supplier detection: handles naming variations
        supplier_patterns = [
            r"(?:Dénomination\s+(?:sociale\s+)?du\s+fournisseur|Raison\s+sociale\s+(?:du\s+)?fournisseur)\s*[:.]?\s*([^\n\r]+)",
            r"(?:Dénomination|Raison sociale|Fournisseur|Entreprise|Société)\s*[:.]?\s*([^\n\r]+)",
            r"(?:Nom\s+(?:de\s+)?(?:l[' ])?(?:entreprise|fournisseur))\s*[:.]?\s*([^\n\r]+)",
        ]
        for pattern in supplier_patterns:
            supplier_match = re.search(pattern, raw_text, re.IGNORECASE)
            if supplier_match:
                fournisseur_name = supplier_match.group(1).strip()
                # Clean OCR artifacts and prefixes
                fournisseur_name = cls._clean_extracted_value(fournisseur_name)
                # Remove trailing phone/email indicators
                fournisseur_name = re.sub(r'\s*[-–]\s*T[eé]l\s*[:.]?\s*.+', '', fournisseur_name, flags=re.IGNORECASE)
                fournisseur_name = re.sub(r'\s+ice\s*$', '', fournisseur_name, flags=re.IGNORECASE)
                # Truncate at first break (email/phone often continues on same line)
                fournisseur_name = fournisseur_name.split('@')[0].split('0[5-7]')[0].strip()
                if fournisseur_name and len(fournisseur_name) > 2 and len(fournisseur_name) < 500:
                    header["fournisseur_denomination"] = fournisseur_name[:255]
                    break

        # Enhanced address detection: tries multiple label variations
        address_patterns = [
            r"(?:Adresse\s+(?:du\s+)?fournisseur|Localisation|Siège\s+social)\s*[:.]?\s*([^\n\r]+)",
            r"(?:Adresse|Address|Lieu)\s*[:.]?\s*([^\n\r]+)",
        ]
        for pattern in address_patterns:
            address_match = re.search(pattern, raw_text, re.IGNORECASE)
            if address_match:
                address_val = address_match.group(1).strip()
                address_val = cls._clean_extracted_value(address_val)
                if address_val and len(address_val) > 2:
                    header["fournisseur_adresse"] = address_val[:500]
                    break

        # Collect all délai/livraison candidates and choose the best one
        deadline_patterns = [
            r"(?:Délai\s+d[' ]exécution|Délai\s+de\s+livraison|Date\s+(?:de\s+)?livraison|Date\s+d[' ]exécution)\s*[:.]?\s*([^\n\r]+)",
            r"(?:Délai|Livraison|Exécution)\s*[:.]?\s*([^\n\r]+)",
        ]
        delai_candidates = []
        for pattern in deadline_patterns:
            for m in re.finditer(pattern, raw_text, re.IGNORECASE):
                val = cls._clean_extracted_value(m.group(1).strip())
                if val:
                    delai_candidates.append(val)

        if delai_candidates:
            header["delai_execution"] = cls._choose_best_delai(delai_candidates)

        # bc_match fallback: if reference not found by main patterns, try BON DE COMMANDE format
        if not header["reference"]:
            bc_match = re.search(r"BON DE COMMANDE\s+N[°o]?\s*([\d/]+)", raw_text, re.IGNORECASE)
            if bc_match:
                header["reference"] = bc_match.group(1)

        lignes = []
        # Enhanced line item patterns: supports various table formats
        line_patterns = [
            # Main pattern: Num | Designation | Qty | Price | Total (with or without MAD)
            re.compile(
                r"^(\d{1,3})\s+(.+?)\s+(\d+)\s*(?:\(?\w*\)?)?\s+([\d\s,]+)\s*(?:MAD)?\s+([\d\s,]+)\s*MAD?",
                re.MULTILINE | re.DOTALL,
            ),
            # Alternative: more flexible format
            re.compile(
                r"^(\d{1,3})\s+(.{5,200}?)\s+(\d+)\s+([\d.,\s]+)\s+([\d.,\s]+)",
                re.MULTILINE,
            ),
        ]
        
        for pattern in line_patterns:
            for m in pattern.finditer(raw_text):
                raw_designation = re.sub(r"\s+", " ", m.group(2)).strip()
                
                # Skip if designation is just a quantity indicator like "1 (U)" or "- " or just whitespace
                if re.match(r'^\s*(\d+\s*\(\s*\w+\s*\)|[-–]\s*)$', raw_designation):
                    continue
                
                # Skip if it's a number or empty
                if not raw_designation or raw_designation.isdigit() or len(raw_designation) < 3:
                    continue
                
                designation, description = cls._split_designation_and_description(raw_designation)
                
                if not designation or len(designation) < 3:
                    continue
                
                # Clean the designation
                designation = cls._clean_extracted_value(designation)
                description = cls._clean_extracted_value(description) if description else ""

                if cls._is_summary_row(designation, description, m.group(4), m.group(5), m.group(3), raw_text):
                    continue
                
                if designation and len(designation) >= 3:
                    lignes.append({
                        "designation": designation[:500],
                        "description": description[:4000] if description else "",
                        "quantite": cls._coerce_int(m.group(3), default=1),
                        "unite": "U",
                        "prix_unitaire_ht": cls._coerce_decimal(m.group(4).replace(" ", "").replace(",", ".")),
                        "prix_total_ht": cls._coerce_decimal(m.group(5).replace(" ", "").replace(",", ".")),
                    })
            
            if lignes:
                break  # Use first pattern that yields results

        if not lignes:
            # Fallback: extract any non-header line as item
            for line in raw_text.splitlines():
                line = re.sub(r"\s+", " ", line).strip()
                # Filter out header rows, totals, and metadata
                if re.search(r'^(?:Désignation|Quantité|Prix|N[°o]|Montant|Date|Tél|Email|Adresse|Type de source)', line, re.IGNORECASE):
                    continue
                if re.search(r'(?:total|montant|somme|tva|ttc|ht|hors|extraction terminée)\s*:?\s*\d+', line, re.IGNORECASE):
                    continue
                # Skip lines that are just quantity indicators
                if re.match(r'^\s*(\d+\s*\(\s*\w+\s*\)|[-–]\s*)$', line):
                    continue
                if len(line) >= 5 and len(line) < 500:  # Reasonable line length
                    designation, description = cls._split_designation_and_description(line)
                    if cls._is_summary_row(designation, description, row_text=line, line_text=line):
                        continue
                    if designation and len(designation) >= 3:
                        designation = cls._clean_extracted_value(designation)
                        description = cls._clean_extracted_value(description) if description else ""
                        lignes.append({
                            "designation": designation[:500],
                            "description": description[:4000] if description else "",
                            "quantite": 1,
                            "unite": "U",
                            "prix_unitaire_ht": None,
                            "prix_total_ht": None,
                        })
        
        # Final fallback: try to parse table-like blocks (header + rows)
        if not lignes:
            table_items = cls._extract_table_like_items(raw_text)
            if table_items:
                lignes.extend(table_items)
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
    def _clean_extracted_value(value: str) -> str:
        """Remove OCR artifacts and common prefixes from extracted values."""
        if not value:
            return None
        
        # Remove "ou identité :" prefix (OCR/label artifact)
        value = re.sub(r'^(?:ou\s+)?(?:identité\s*[:.]?\s*)?', '', value, flags=re.IGNORECASE).strip()
        
        # Remove "ou de livraison :" prefix
        value = re.sub(r'^(?:ou\s+)?(?:de\s+)?(?:livraison\s*[:.]?\s*)?', '', value, flags=re.IGNORECASE).strip()
        
        # Remove "ou" prefix (generic artifact)
        value = re.sub(r'^ou\s+', '', value, flags=re.IGNORECASE).strip()
        
        # Clean extra spaces and normalize
        value = re.sub(r'\s+', ' ', value).strip()
        
        return value or None

    @classmethod
    def build_import_metadata(cls, result: dict) -> dict:
        """Build clean metadata without confidence scores or artifacts."""
        header = result.get("header") or {}
        
        # Build metadata with cleaned values, exclude any confidence fields
        metadata = {
            "titre_fichier": cls._clean_extracted_value(header.get("titre_document") or result.get("titre_document")) or "",
            "reference_document": cls._clean_extracted_value(header.get("reference") or result.get("reference")) or "",
            "fournisseur_denomination": cls._clean_extracted_value(header.get("fournisseur_denomination") or result.get("fournisseur_denomination")) or "",
            "fournisseur_telephone": cls._clean_extracted_value(header.get("fournisseur_telephone") or result.get("fournisseur_telephone")) or "",
            "fournisseur_email": cls._clean_extracted_value(header.get("fournisseur_email") or result.get("fournisseur_email")) or "",
            "fournisseur_adresse": cls._clean_extracted_value(header.get("fournisseur_adresse") or result.get("fournisseur_adresse")) or "",
            "delai_execution": cls._clean_extracted_value(header.get("delai_execution") or result.get("delai_execution")) or "",
        }
        
        # Ensure all values are strings and have max length
        for key in metadata:
            if metadata[key]:
                metadata[key] = str(metadata[key])[:500]
            else:
                metadata[key] = ""
        
        return metadata

    @staticmethod
    def _split_designation_and_description(text: str) -> tuple[str, str]:
        cleaned = re.sub(r"\s+", " ", (text or "")).strip()
        if not cleaned:
            return "", ""

        # Trim "Caractéristiques et" from start
        cleaned = re.sub(r'^Caract[eé]ristiques\s+et\s+', '', cleaned, flags=re.IGNORECASE)

        # If the cleaned text contains 'Caractéristiques' in the middle or end,
        # split there: left becomes designation, right becomes description.
        # This moves technical details into description and keeps designation concise.
        m_car = re.search(r'\bCaract[eé]ristiques?\b[:\-\s]*(.*)$', cleaned, re.IGNORECASE)
        if m_car:
            left = cleaned[:m_car.start()].strip()
            right = m_car.group(1).strip()
            # Strip "et spécifications :" and similar leading artifacts from description
            right = re.sub(r'^(?:et\s+)?sp[eé]cifications?\s*[:\-]\s*', '', right, flags=re.IGNORECASE).strip()
            right = re.sub(r'^et\s+', '', right, flags=re.IGNORECASE).strip()
            # If left is empty, keep some first tokens as designation
            if not left:
                tokens = cleaned.split()
                left = " ".join(tokens[:8])
            return left, right

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

    @classmethod
    def _map_table_rows(cls, table_rows: list[list[str]]) -> list:
        """Map extracted table rows (list of lists) to our ligne dicts.

        Heuristics:
        - Find header row by searching for 'désignation' or 'description' words.
        - Map column indices for designation, description, qty, pu, pt.
        - Parse rows after header and coerce numeric fields.
        """
        if not table_rows:
            return []

        # Normalize header candidates
        header_idx = None
        headers = None
        for i, row in enumerate(table_rows[:4]):
            joined = ' '.join(cell.lower() for cell in row if cell)
            if 'désignation' in joined or 'designation' in joined or 'description' in joined:
                header_idx = i
                headers = row
                break

        # If no header row found, assume first row as header if contains words like 'quantité' or 'pu'
        if header_idx is None and table_rows:
            first = ' '.join(cell.lower() for cell in table_rows[0] if cell)
            if any(k in first for k in ('quant', 'pu', 'prix', 'pt', 'total')):
                header_idx = 0
                headers = table_rows[0]

        # Default mapping heuristics
        col_map = {
            'designation': None,
            'description': None,
            'quantite': None,
            'pu': None,
            'pt': None,
        }

        if headers:
            for idx, h in enumerate(headers):
                htxt = (h or '').lower()
                if any(k in htxt for k in ('désignation', 'designation', 'article', 'libelle', 'description')) and col_map['designation'] is None:
                    col_map['designation'] = idx
                if any(k in htxt for k in ('description',)) and col_map['description'] is None:
                    col_map['description'] = idx
                if any(k in htxt for k in ('quant', 'qty', 'qte')) and col_map['quantite'] is None:
                    col_map['quantite'] = idx
                if any(k in htxt for k in ('pu', 'prix unitaire', 'unit', 'price')) and col_map['pu'] is None:
                    col_map['pu'] = idx
                if any(k in htxt for k in ('pt', 'total', 'montant', 'prix total', 'pt ht')) and col_map['pt'] is None:
                    col_map['pt'] = idx

        # Fallback: if designation not found, assume first column
        if col_map['designation'] is None:
            col_map['designation'] = 0

        items = []
        start_row = (header_idx + 1) if header_idx is not None else 0
        for row in table_rows[start_row:]:
            # Protect against short rows
            if not any(c and c.strip() for c in row):
                continue
            try:
                raw_designation = row[col_map['designation']] if col_map['designation'] < len(row) else ''
            except Exception:
                raw_designation = row[0] if row else ''

            raw_description = ''
            if col_map['description'] is not None and col_map['description'] < len(row):
                raw_description = row[col_map['description']] or ''

            # If description column is empty but designation contains ' - ' or '|' separate
            if not raw_description and raw_designation and ('|' in raw_designation or ' - ' in raw_designation):
                parts = re.split(r'\s*[|\-]\s*', raw_designation, maxsplit=1)
                if len(parts) == 2:
                    raw_designation, raw_description = parts[0].strip(), parts[1].strip()

            # Extract qty/pu/pt
            qty = None
            pu = None
            pt = None
            if col_map['quantite'] is not None and col_map['quantite'] < len(row):
                raw_qty = (row[col_map['quantite']] or '')
                m_q = re.search(r"(\d{1,6})", str(raw_qty))
                qty = cls._coerce_int(m_q.group(1)) if m_q else None
            else:
                # try to find a number token in the row after designation
                tail = ' '.join(row[1:])
                m_qty = re.search(r"\b(\d{1,6})\b", tail)
                if m_qty:
                    qty = cls._coerce_int(m_qty.group(1))

            if col_map['pu'] is not None and col_map['pu'] < len(row):
                pu = cls._coerce_decimal(row[col_map['pu']])
            else:
                m_pu = re.search(r"([\d\s.,]+)\s*(?:MAD|DH)?\s*$", ' '.join(row))
                if m_pu:
                    pu = cls._coerce_decimal(m_pu.group(1))

            if col_map['pt'] is not None and col_map['pt'] < len(row):
                pt = cls._coerce_decimal(row[col_map['pt']])
            else:
                # try last numeric token
                tokens = [t for t in row if t and re.search(r"\d", t)]
                if tokens:
                    pt = cls._coerce_decimal(tokens[-1])

            designation, description = cls._split_designation_and_description(raw_designation or '')
            # Merge column description if available
            if raw_description:
                if description:
                    description = (description + ' ' + raw_description).strip()
                else:
                    description = raw_description

            designation = cls._clean_extracted_value(designation) or ''
            description = cls._clean_extracted_value(description) or ''

            if not designation or len(designation) < 2:
                continue

            if cls._is_summary_row(designation, description, pu, pt, qty, row_text=' '.join(row)):
                continue

            items.append({
                'designation': designation[:500],
                'description': description[:4000],
                'quantite': qty or 1,
                'unite': 'U',
                'prix_unitaire_ht': pu,
                'prix_total_ht': pt,
            })

        return items

    @classmethod
    def _is_summary_row(
        cls,
        designation: str | None,
        description: str | None,
        pu: str | None = None,
        pt: str | None = None,
        qty: str | None = None,
        row_text: str | None = None,
        line_text: str | None = None,
    ) -> bool:
        """Return True for subtotal/total rows that must not become articles."""
        parts = [designation, description, pu, pt, qty, row_text, line_text]
        text = re.sub(r"\s+", " ", " ".join(str(p) for p in parts if p)).strip().lower()
        if not text:
            return False

        if cls.SUMMARY_LABEL_RE.search(text):
            return True

        if cls.AMOUNT_ONLY_RE.match(text):
            return True

        compact_designation = re.sub(r"\s+", " ", str(designation or "")).strip()
        if compact_designation and cls.AMOUNT_ONLY_RE.match(compact_designation):
            return True

        # Rows with no letters in designation are almost always totals/section rows.
        if compact_designation and not re.search(r"[A-Za-zÀ-ÿ]", compact_designation):
            return True

        return False

    @staticmethod
    def _choose_best_delai(candidates: list) -> str:
        """Choose the best délai candidate from a list.

        Prefer numeric durations (e.g., '30 jours'), then explicit dates, and avoid
        city-only values like 'FES' if another meaningful candidate exists.
        """
        if not candidates:
            return None

        # Prefer candidates with 'jour' and a number
        jours = []
        for c in candidates:
            m = re.search(r"(\d+)\s*(?:jour|jours|day|days)", c, re.IGNORECASE)
            if m:
                jours.append((int(m.group(1)), c))
        if jours:
            # take the largest numeric delay (or first if equal)
            jours.sort(key=lambda x: -x[0])
            return str(jours[0][0]) + ' jours'

        # Next prefer explicit dates (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd)
        date_patterns = [r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", r"\b\d{4}-\d{2}-\d{2}\b"]
        for pat in date_patterns:
            for c in candidates:
                if re.search(pat, c):
                    return c

        # Filter out city-only candidates (all letters and short)
        filtered = [c for c in candidates if not (re.fullmatch(r"[A-ZÀ-ÖØ-Ý]{2,4}", c.strip()) and len(c.strip()) <= 4)]
        if filtered:
            # return the first meaningful one
            return filtered[0]

        # fallback: return the first candidate
        return candidates[0]

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
            # Remove all whitespace (including non-breaking) and normalize decimal separator
            cleaned = re.sub(r"\s+", "", str(value))
            cleaned = cleaned.replace(',', '.')
            # Extract leading numeric portion (strip currency codes like MAD, DH)
            m = re.search(r"[-+]?\d+(?:\.\d+)?", cleaned)
            if not m:
                return None
            num = m.group(0)
            return Decimal(num).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            return None

    @classmethod
    def _extract_table_like_items(cls, raw_text: str) -> list:
        """Attempt to parse table-like blocks where rows may span multiple lines.

        Strategy:
        - Look for a header line containing 'Désignation' or 'Description'
        - Collect subsequent non-empty lines until a blank line or next header
        - For each block line, try to match qty/price at end of line; if not present,
          accumulate following lines as description until a line with price found.
        """
        lines = [re.sub(r"\s+", " ", l).strip() for l in raw_text.splitlines()]
        items = []
        # Find header index
        header_idx = None
        for i, l in enumerate(lines):
            if re.search(r"\bD[eé]signation\b|\bDescription\b", l, re.IGNORECASE):
                header_idx = i
                break

        if header_idx is None:
            return []

        row_lines = []
        for l in lines[header_idx+1:]:
            if not l:
                # stop at blank line after table
                break
            # skip metadata-looking lines
            if re.search(r'^(?:Titre|Référence|Fournisseur|Email|Adresse|Délai)\b', l, re.IGNORECASE):
                break
            row_lines.append(l)

        # Merge rows where necessary: detect rows that end with price pattern
        buffer = []
        for l in row_lines:
            # If line ends with two numbers (PU and PT) like '7 500,00 7 500,00' or '7,500.00 7500'
            m_end = re.search(r"([\d\s.,]+)\s+([\d\s.,]+)$", l)
            if m_end:
                # This line likely contains qty/pu/pt or pu/pt
                buffer.append(l)
                full = ' '.join(buffer)
                # Try to extract quantity and prices
                # pattern: optional leading index, designation text, qty, pu, pt
                m_row = re.search(r"^(?:\d+\s+)?(.+?)\s+(\d{1,6})\s+([\d\s.,]+)\s+([\d\s.,]+)$", full)
                if m_row:
                    raw_designation = m_row.group(1).strip()
                    designation, description = cls._split_designation_and_description(raw_designation)
                    designation = cls._clean_extracted_value(designation)
                    description = cls._clean_extracted_value(description) or ""
                    if cls._is_summary_row(designation, description, m_row.group(3), m_row.group(4), m_row.group(2), row_text=full):
                        continue
                    qty = cls._coerce_int(m_row.group(2), default=1)
                    pu = cls._coerce_decimal(m_row.group(3))
                    pt = cls._coerce_decimal(m_row.group(4))
                    items.append({
                        "designation": designation[:500],
                        "description": description[:4000],
                        "quantite": qty,
                        "unite": "U",
                        "prix_unitaire_ht": pu,
                        "prix_total_ht": pt,
                    })
                else:
                    # fallback: try a simpler pattern (designation ends with pu pt)
                    m_simple = re.search(r"^(.+?)\s+(\d{1,6})\s+([\d\s.,]+)\s+([\d\s.,]+)$", full)
                    if m_simple:
                        raw_designation = m_simple.group(1).strip()
                        designation, description = cls._split_designation_and_description(raw_designation)
                        designation = cls._clean_extracted_value(designation)
                        if cls._is_summary_row(designation, description, m_simple.group(3), m_simple.group(4), m_simple.group(2), row_text=full):
                            continue
                        items.append({
                            "designation": designation[:500],
                            "description": cls._clean_extracted_value(description) or "",
                            "quantite": cls._coerce_int(m_simple.group(2), default=1),
                            "unite": "U",
                            "prix_unitaire_ht": cls._coerce_decimal(m_simple.group(3)),
                            "prix_total_ht": cls._coerce_decimal(m_simple.group(4)),
                        })
                buffer = []
            else:
                # likely continuation of previous line or long description; buffer it
                buffer.append(l)

        return items

    @staticmethod
    def _empty_result(source: str) -> dict:
        return {
            "fournisseur": {},
            "commande": {},
            "lignes": [],
            "totaux": {},
            "source": source,
        }
