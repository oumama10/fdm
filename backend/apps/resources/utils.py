"""Utility functions for resources app normalization."""
import re

# All canonical taxonomy names, keyed by their normalize_key() form for fast lookup.
# Built once at import time so matching is O(1) per call.
_TAXONOMY_CANONICAL: dict[str, str] = {}

def _build_taxonomy_lookup() -> dict[str, str]:
    entries = [
        # Consommable sous-categories
        'Fourniture De Bureau',
        'Toners',
        'Papiers Et Enveloppes',
        'Produits Hygieniques',
        'Accessoires Electriques',
        'Accessoires Plomberies',
        'Accessoires De Sports',
        'Consommation Et Pause',
        # Bien Inventaire roots
        'Mobilier De Bureau',
        'Materiel Informatique',
        'Materiel Enseignement',
        'Fourniture Informatique',
        # Mobilier De Bureau children
        'Chaise roulante', 'Bureau simple', 'Table basse', 'Chaise visiteur',
        'Climatiseur', 'Chaise iso', 'Chaise ecritoire', 'Fauteuil president',
        'Porte manteau', 'Armoire metallique GF', 'Armoire metallique PF',
        'CLAPET a 10 cases', 'CLAPET a 4cases', 'Bain huile', 'Table',
        'TABOURET', 'Refrigerateur', 'Congelateur', 'Escabeau',
        'ARMOIRE COULISSANTE', 'Armoire metallique',
        # Materiel Informatique children
        'Ordinateur de bureau', 'All In One', 'Ordinateur Portable', 'Imprimante',
        'Imprimante couleur', 'Photocopieuse', 'Scanner', 'Appareil photo',
        'Tablette', 'Scanner Onduleur', 'CAMERA', 'FAX', 'Imprimante multifonction',
        # Materiel Enseignement children
        'Videoprojecteur', 'Ecran de projection', 'Micro cravatte', 'Microbaladeur',
        'Tableau magnetique GF', "Tableau d'affichage GF", 'Tableau magnetique PF',
        'Tableau magnetique MF', 'TV', 'TABLEAU INTERACTIF',
        "TABLE D'EXAMEN", 'ESCABEAU INOX',
        # Fourniture Informatique children
        'Switch', 'Pointeur', 'Ralonge 5M', 'Ralonge 5 ports',
        'Cable VGA', 'Cable HDMI', 'STREAMING', 'SERVEUR',
        'ADAPTATEUR', 'DD EXTERNE', 'SUPPORT AFFICHE',
    ]
    result = {}
    for name in entries:
        key = _normalize_key_internal(name)
        result[key] = name
    return result


def _normalize_key_internal(text: str) -> str:
    """Internal key builder used during module init (avoids circular reference)."""
    if not text:
        return ""
    text = text.lower().strip()
    text = (
        text.replace("é", "e").replace("è", "e").replace("ê", "e").replace("ë", "e")
        .replace("à", "a").replace("â", "a").replace("ä", "a")
        .replace("ù", "u").replace("û", "u").replace("ü", "u")
        .replace("ô", "o").replace("ö", "o")
        .replace("î", "i").replace("ï", "i")
        .replace("ç", "c").replace("œ", "oe").replace("æ", "ae")
    )
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


_TAXONOMY_CANONICAL = _build_taxonomy_lookup()


def normalize_key(text: str) -> str:
    """Normalize a string for case-insensitive comparison.
    
    Converts to lowercase and removes accents/special characters for consistent matching.
    """
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower().strip()
    # Remove accents
    text = (
        text.replace("é", "e")
        .replace("è", "e")
        .replace("ê", "e")
        .replace("ë", "e")
        .replace("à", "a")
        .replace("â", "a")
        .replace("ä", "a")
        .replace("ù", "u")
        .replace("û", "u")
        .replace("ü", "u")
        .replace("ô", "o")
        .replace("ö", "o")
        .replace("î", "i")
        .replace("ï", "i")
        .replace("ç", "c")
        .replace("œ", "oe")
        .replace("æ", "ae")
    )
    # Remove non-alphanumeric characters
    text = re.sub(r"[^a-z0-9\s]", "", text)
    # Collapse multiple spaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_sous_categorie_name(text: str) -> str:
    """Normalize sous-catégorie names for storage.

    Returns the canonical spelling for known taxonomy names.
    Falls back to title case for unknowns.
    """
    if not text:
        return ""
    key = normalize_key(text.strip())
    if key in _TAXONOMY_CANONICAL:
        return _TAXONOMY_CANONICAL[key]
    # Unknown name — best-effort title case
    return " ".join(word.capitalize() for word in text.strip().split())
