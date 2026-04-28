import unicodedata


def normalize_key(value):
    return (
        unicodedata.normalize("NFD", str(value or ""))
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
        .lower()
    )


SUBCATEGORY_CANONICAL_BY_KEY = {
    normalize_key("Fourniture De Bureau"): "Fourniture De Bureau",
    normalize_key("Fournitures De Bureau"): "Fourniture De Bureau",
    normalize_key("Fourniture de bureau"): "Fourniture De Bureau",
    normalize_key("Toners"): "Toners",
    normalize_key("Toner"): "Toners",
    normalize_key("Papiers Et Enveloppes"): "Papiers Et Enveloppes",
    normalize_key("Papier Et Enveloppes"): "Papiers Et Enveloppes",
    normalize_key("Papiers"): "Papiers Et Enveloppes",
    normalize_key("Papier"): "Papiers Et Enveloppes",
    normalize_key("Produits Hygieniques"): "Produits Hygieniques",
    normalize_key("Produits Hygiéniques"): "Produits Hygieniques",
    normalize_key("Accessoires Electriques"): "Accessoires Electriques",
    normalize_key("Accessoires Électriques"): "Accessoires Electriques",
    normalize_key("Accessoires Plomberies"): "Accessoires Plomberies",
    normalize_key("Accessoires De Sports"): "Accessoires De Sports",
    normalize_key("Consommation Et Pause"): "Consommation Et Pause",

    normalize_key("Armoire metallique GF"): "Armoire métallique GF",
    normalize_key("Armoire metallique PF"): "Armoire métallique PF",
    normalize_key("Bain huile"): "Bain d'huile",
    normalize_key("Bureau simple"): "Bureau simple",
    normalize_key("Chaise ecritoire"): "Chaise écritoire",
    normalize_key("Chaise iso"): "Chaise iso",
    normalize_key("Congélateur"): "Congélateur",
    normalize_key("Fourniture Informatique"): "Fourniture Informatique",
    normalize_key("Materiel Enseignement"): "Matériel Enseignement",
    normalize_key("Materiel Informatique"): "Matériel Informatique",
    normalize_key("Mobilier De Bureau"): "Mobilier De Bureau",
    normalize_key("Refrigerateur"): "Réfrigérateur",
    normalize_key("table"): "Table",
}


def normalize_sous_categorie_name(value):
    raw_value = " ".join(str(value or "").split())
    if not raw_value:
        return raw_value
    return SUBCATEGORY_CANONICAL_BY_KEY.get(normalize_key(raw_value), raw_value)