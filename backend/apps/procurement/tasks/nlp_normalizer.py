"""
spaCy-based designation normalizer for the FMPDF procurement import pipeline.

This module replaces the simple keyword stub in nlp_utils.py with a proper
NLP pipeline backed by the French spaCy model ``fr_core_news_sm``.

Import path : apps.procurement.tasks.nlp_normalizer
Public API  : normalize_designation(raw_text: str) -> dict

Thread safety
-------------
The spaCy model is loaded lazily on the first call and cached at module level.
A ``threading.Lock`` ensures only one thread loads the model even when many
Celery worker threads start almost simultaneously.
"""

from __future__ import annotations

import logging
import re
import threading
import unicodedata
from difflib import SequenceMatcher
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy spaCy model (loaded once per process, thread-safe)
# ---------------------------------------------------------------------------

_NLP_LOCK: threading.Lock = threading.Lock()
_nlp: Any = None  # spacy.Language | False | None


def _get_nlp() -> Any:
    """
    Return the loaded ``fr_core_news_sm`` spaCy pipeline.

    The model is loaded on the first call and then cached.  Parser and NER
    components are disabled because we only need tokenisation and
    lemmatisation.

    Returns ``None`` when the model is not installed, so the caller can fall
    back to simple tokenisation rather than crash.
    """
    global _nlp  # noqa: PLW0603
    if _nlp is False:
        return None
    if _nlp is not None:
        return _nlp
    with _NLP_LOCK:
        if _nlp is None:  # double-checked locking
            try:
                import spacy  # noqa: PLC0415

                _nlp = spacy.load(
                    "fr_core_news_sm",
                    disable=["parser", "ner"],
                )
                logger.info("nlp_normalizer: fr_core_news_sm loaded successfully")
            except OSError:
                logger.warning(
                    "nlp_normalizer: fr_core_news_sm is not installed — "
                    "run 'python manage.py download_spacy_model'."
                    "Falling back to simple tokenisation."
                )
                # Mark as missing so we don't log this warning on every call.
                _nlp = False
    return None if _nlp is False else _nlp


# ---------------------------------------------------------------------------
# Keyword rules
# ---------------------------------------------------------------------------
# Each entry maps a frozenset of accent-free, lowercase keywords to:
#   categorie_nom  — must match Categorie.nom_categorie in the DB
#   type_detecte   — 'consommable' | 'bien_inventaire'
#   sous_categorie — suggested SousCategorie.nom_sous_categorie
# Keywords in the dict are already accent-stripped for fast comparison
# against spaCy lemmas (which are also stripped before matching).

KEYWORD_RULES: list[dict] = [
    {
        "keywords": frozenset(
            {
                "ordinateur", "laptop", "pc", "desktop", "ecran",
                "moniteur", "clavier", "souris", "imprimante",
            }
        ),
        "categorie_nom": "bien_inventaire",
        "type_detecte": "bien_inventaire",
        "sous_categorie": "MATERIEL_INFORMATIQUE",
    },
    {
        "keywords": frozenset(
            {
                "cartouche", "toner", "encre", "papier", "ramette",
                "stylo", "crayon", "classeur",
            }
        ),
        "categorie_nom": "consommable",
        "type_detecte": "consommable",
        "sous_categorie": "PAPETERIE",
    },
    {
        "keywords": frozenset(
            {
                "chaise", "bureau", "table", "armoire", "etagere",
            }
        ),
        "categorie_nom": "bien_inventaire",
        "type_detecte": "bien_inventaire",
        "sous_categorie": "MOBILIER",
    },
    {
        "keywords": frozenset(
            {
                "savon", "gel", "masque", "gant", "desinfectant",
            }
        ),
        "categorie_nom": "consommable",
        "type_detecte": "consommable",
        "sous_categorie": "PRODUITS_HYGIENE",
    },
    {
        "keywords": frozenset(
            {
                "cable", "multiprise", "ampoule", "rallonge",
            }
        ),
        "categorie_nom": "consommable",
        "type_detecte": "consommable",
        "sous_categorie": "ELECTRIQUE",
    },
    {
        "keywords": frozenset(
            {
                "projecteur", "tableau", "microscope",
            }
        ),
        "categorie_nom": "bien_inventaire",
        "type_detecte": "bien_inventaire",
        "sous_categorie": "MATERIEL_ENSEIGNEMENT",
    },
]

# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------


def _strip_accents(text: str) -> str:
    """Lowercase *text* and remove diacritical marks via NFKD decomposition."""
    nfkd = unicodedata.normalize("NFKD", str(text))
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _clean(raw: str) -> str:
    """
    Full normalisation pipeline used both for NLP input and for the stored
    ``designation_normalisee`` value:

    1. NFKD accent decomposition + diacritics removal
    2. Lowercase
    3. Punctuation replaced with spaces (hyphens between word characters kept)
    4. Whitespace collapsed to single spaces, strip leading/trailing
    """
    # Step 1 & 2 — decompose + lowercase
    text = unicodedata.normalize("NFKD", raw)
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    # Step 3 — remove punctuation except intra-word hyphens
    text = re.sub(r"(?<!\w)-|-(?!\w)", " ", text)   # bare hyphens → space
    text = re.sub(r"[^\w\s-]", " ", text)             # other punctuation → space
    # Step 4 — normalise whitespace
    return re.sub(r"\s+", " ", text).strip()


def _similarity(a: str, b: str) -> float:
    """Return a [0, 1] similarity ratio between two accent-stripped strings."""
    return SequenceMatcher(None, _strip_accents(a), _strip_accents(b)).ratio()


# ---------------------------------------------------------------------------
# DB helpers  (deferred imports so the module is importable before Django
#              app registry is ready, e.g. during Celery worker startup)
# ---------------------------------------------------------------------------


def _lookup_categorie(nom_categorie: str) -> int | None:
    """
    Return the ``id_type_article`` PK of the active ``TypeArticle`` whose
    ``nom_categorie`` matches *nom_categorie* (case-insensitive), or ``None``.
    """
    from apps.resources.models import TypeArticle  # noqa: PLC0415

    return (
        TypeArticle.objects.filter(nom_categorie=nom_categorie.lower(), actif=True)
        .values_list("id_type_article", flat=True)
        .first()
    )


def _lookup_ressource(designation_clean: str) -> tuple[int | None, float]:
    """
    Search for an existing ``Ressource`` whose designation is sufficiently
    similar to *designation_clean*.

    Strategy
    --------
    1. Extract the first three meaningful words (len >= 4) from the cleaned
       text to build a narrow DB filter (``icontains``).
    2. Compute ``SequenceMatcher`` similarity in Python for each candidate.
    3. Return the best match if its score is >= 0.8, else ``(None, 0.0)``.
    """
    from apps.resources.models import Ressource  # noqa: PLC0415

    words = [w for w in designation_clean.split() if len(w) >= 4][:3]
    if not words:
        return None, 0.0

    # Build union of icontains querysets without loading all rows
    qs = Ressource.objects.none()
    for word in words:
        qs = qs | Ressource.objects.filter(designation__icontains=word)

    best_id: int | None = None
    best_score = 0.0
    for ressource in qs.only("id_ressource", "designation"):
        score = _similarity(designation_clean, ressource.designation)
        if score > best_score:
            best_score = score
            best_id = ressource.id_ressource

    if best_score >= 0.8:
        return best_id, best_score
    return None, 0.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def normalize_designation(raw_text: str) -> dict:
    """
    Normalise *raw_text* and classify it using spaCy lemmatisation + keyword
    rule matching, with an optional DB lookup for existing resources.

    Parameters
    ----------
    raw_text:
        Raw designation string as extracted from the Excel file.

    Returns
    -------
    dict
        designation_normalisee  (str)       — cleaned, accent-free text
        type_detecte            (str)       — 'consommable' | 'bien_inventaire' | ''
        id_type_suggeree        (int|None)  — FK to resources.TypeArticle
        id_ressource_liee       (int|None)  — FK to resources.Ressource
        confiance_ia            (float)     — confidence score 0.0 – 1.0

    Confidence scoring
    ------------------
    Base score           :  0.20  (always)
    + Keyword matched    : +0.50
    + Ressource found    : +0.30
    − Short text (< 3 w) : −0.20
    Final value clamped to [0.0, 1.0].

    Fallback
    --------
    When the spaCy model is not available, the function degrades gracefully
    to simple whitespace tokenisation (same keyword matching, no lemmatisation).
    """
    cleaned = _clean(raw_text)

    # ── 1. spaCy tokenisation + lemmatisation ─────────────────────────────
    nlp = _get_nlp()
    word_count: int
    search_terms: frozenset[str]

    if nlp is not None:
        doc = nlp(cleaned)
        word_count = sum(1 for tok in doc if not tok.is_space)
        lemmas = [
            _strip_accents(tok.lemma_)
            for tok in doc
            if not tok.is_stop and not tok.is_punct and not tok.is_space
        ]
        search_terms = frozenset(lemmas)
    else:
        # Graceful fallback — no lemmatisation, no stop-word filtering
        tokens = [t for t in cleaned.split() if t]
        word_count = len(tokens)
        search_terms = frozenset(_strip_accents(t) for t in tokens)

    # ── 2. Keyword rule matching (pick rule with most hits) ───────────────
    matched_rule: dict | None = None
    max_hits = 0
    for rule in KEYWORD_RULES:
        hits = len(search_terms & rule["keywords"])
        if hits > max_hits:
            max_hits = hits
            matched_rule = rule

    # ── 3. Confidence scoring ─────────────────────────────────────────────
    confidence = 0.20

    if word_count < 3:
        confidence -= 0.20

    type_detecte = ""
    id_categorie: int | None = None

    if matched_rule is not None:
        confidence += 0.50
        type_detecte = matched_rule["type_detecte"]
        id_categorie = _lookup_categorie(matched_rule["categorie_nom"])

    # ── 4. DB ressource lookup ────────────────────────────────────────────
    id_ressource: int | None = None
    res_id, _res_score = _lookup_ressource(cleaned)
    if res_id is not None:
        id_ressource = res_id
        confidence += 0.30

    # ── 5. Final clamp and return ─────────────────────────────────────────
    confidence = round(max(0.0, min(1.0, confidence)), 2)

    return {
        "designation_normalisee": cleaned,
        "type_detecte": type_detecte,
        "id_type_suggeree": id_categorie,
        "id_ressource_liee": id_ressource,
        "confiance_ia": confidence,
    }
