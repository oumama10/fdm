"""
Keyword-based designation normalizer (NLP stub).

Replace the body of `normalize_designation` with a real ML/NLP model once
available.  The public contract (function signature and return shape) must
remain stable so that ocr_task.py never needs to change.
"""

import re
import unicodedata

# ---------------------------------------------------------------------------
# Keyword lists (accent-free, lower-case for comparison)
# ---------------------------------------------------------------------------

_CONSOMMABLE_KEYWORDS: frozenset[str] = frozenset(
    {
        "seringue", "gant", "masque", "bandage", "coton", "alcool",
        "pansement", "compresse", "sparadrap", "solute", "serum",
        "aiguille", "catheter", "garrot", "bistouri", "suture",
        "stylo", "crayon", "rame", "papier", "cartouche", "encre",
        "tablette", "gelule", "comprimes", "ampoule", "flacon",
        "poche", "perfusion", "desinfectant", "savon", "gel",
    }
)

_INVENTAIRE_KEYWORDS: frozenset[str] = frozenset(
    {
        "ordinateur", "laptop", "imprimante", "bureau", "chaise",
        "armoire", "microscope", "centrifugeuse", "automate",
        "appareil", "dispositif", "projecteur", "tableau", "ecran",
        "moniteur", "clavier", "souris", "machine", "equipement",
        "instrument", "lit", "fauteuil", "chariot", "refrigerateur",
        "congelateur", "autoclave", "incubateur", "scanner",
    }
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _strip_accents(text: str) -> str:
    """Return *text* lowercased and stripped of diacritical marks."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _tokenize(text: str) -> frozenset[str]:
    """Split *text* (accent-free) into a frozen set of word tokens."""
    return frozenset(re.split(r"[\s/,;.()\-]+", _strip_accents(text)))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def normalize_designation(designation: str) -> dict:
    """
    Normalize *designation* and classify it as consommable / bien_inventaire.

    Returns a dict with:
        designation_normalisee  (str)   — cleaned designation text
        type_detecte            (str)   — 'consommable' | 'bien_inventaire' | ''
        id_categorie_suggeree   (int|None)
        id_ressource_liee       (int|None)
        confiance_ia            (float) — 0.0 to 1.0
    """
    cleaned = re.sub(r"\s+", " ", designation.strip())
    tokens = _tokenize(cleaned)

    type_detecte = ""
    confiance_ia = 0.0

    consommable_hits = tokens & _CONSOMMABLE_KEYWORDS
    inventaire_hits = tokens & _INVENTAIRE_KEYWORDS

    if consommable_hits and not inventaire_hits:
        type_detecte = "consommable"
        # More keyword hits → higher confidence, capped at 0.85
        confiance_ia = min(0.45 + 0.10 * len(consommable_hits), 0.85)
    elif inventaire_hits and not consommable_hits:
        type_detecte = "bien_inventaire"
        confiance_ia = min(0.50 + 0.10 * len(inventaire_hits), 0.85)
    elif consommable_hits and inventaire_hits:
        # Ambiguous — pick whichever has more hits but flag low confidence
        if len(consommable_hits) >= len(inventaire_hits):
            type_detecte = "consommable"
        else:
            type_detecte = "bien_inventaire"
        confiance_ia = 0.30  # ambiguous → low confidence → will trigger review

    return {
        "designation_normalisee": cleaned,
        "type_detecte": type_detecte,
        "id_categorie_suggeree": None,
        "id_ressource_liee": None,
        "confiance_ia": confiance_ia,
    }
