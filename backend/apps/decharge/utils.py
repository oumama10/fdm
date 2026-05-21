from collections import defaultdict


def format_numeros_inventaire(numeros: list) -> str:
    """
    Formats a list of N° inventaire into a compact readable string.

    Rules:
    - Sort numerically by sequence number
    - Group consecutive sequences into ranges "INV-2026-0001 à INV-2026-0003"
    - 2 consecutive: listed individually (no "à")
    - 3+ consecutive: range with "à"
    - Multiple groups separated by ", "
    """
    if not numeros:
        return '—'

    parsed = []
    for n in numeros:
        parts = n.split('-')
        if len(parts) == 3:
            try:
                parsed.append((parts[0], parts[1], int(parts[2]), n))
            except ValueError:
                parsed.append((None, None, None, n))
        else:
            parsed.append((None, None, None, n))

    parsed.sort(key=lambda x: (x[1] or '', x[2] or 0))

    groups = []
    i = 0
    while i < len(parsed):
        prefix, year, seq, original = parsed[i]
        if seq is None:
            groups.append(original)
            i += 1
            continue

        j = i + 1
        while j < len(parsed):
            p2, y2, s2, _ = parsed[j]
            if p2 == prefix and y2 == year and s2 == seq + (j - i):
                j += 1
            else:
                break

        run_length = j - i
        if run_length == 1:
            groups.append(f'{prefix}-{year}-{str(seq).zfill(4)}')
        else:
            end_seq = seq + run_length - 1
            groups.append(
                f'{prefix}-{year}-{str(seq).zfill(4)} à '
                f'{prefix}-{year}-{str(end_seq).zfill(4)}'
            )
        i = j

    return ', '.join(groups)


CATEGORY_TITLES = {
    'Mobilier De Bureau':      "DECHARGE DE MATERIEL\nDE BUREAU",
    'Materiel Informatique':   "DECHARGE DE MATERIEL\nINFORMATIQUE",
    'Materiel Enseignement':   "DECHARGE DE MATERIEL\nD'ENSEIGNEMENT",
    'Fourniture Informatique': "DECHARGE DE FOURNITURE\nINFORMATIQUE",
    'Fourniture De Bureau':    "DECHARGE DE FOURNITURE\nDE BUREAU",
    'Toners':                  "DECHARGE DE TONERS",
    'Papiers Et Enveloppes':   "DECHARGE DE PAPIERS\nET ENVELOPPES",
    'Produits Hygieniques':    "DECHARGE DE PRODUITS\nHYGIENIQUES",
    'Accessoires Electriques': "DECHARGE D'ACCESSOIRES\nELECTRIQUES",
    'Accessoires Plomberies':  "DECHARGE D'ACCESSOIRES\nDE PLOMBERIE",
    'Accessoires De Sports':   "DECHARGE D'ACCESSOIRES\nDE SPORTS",
    'Consommation Et Pause':   "DECHARGE DE PRODUITS\nDE CONSOMMATION",
}


def get_decharge_title(lignes) -> str:
    """
    Derives the décharge title from its lignes.

    - 1 unique category  → specific title from CATEGORY_TITLES
    - 2+ categories      → "DÉCHARGE" (generic)

    Climbs to the parent sous_catégorie (métier level) to avoid
    overly-specific leaf names like "CONGELATEUR".
    """
    try:
        categories = set()
        for ligne in lignes:
            scat = ligne.id_ressource.id_sous_categorie
            if scat:
                cat = scat.id_categorie
                name = cat.nom_categorie if cat else scat.nom_sous_categorie
                categories.add(name)

        if len(categories) > 1:
            return "DÉCHARGE"
        if len(categories) == 1:
            cat_name = list(categories)[0]
            return CATEGORY_TITLES.get(cat_name, f"DECHARGE DE MATERIEL\n{cat_name.upper()}")
    except Exception:
        pass
    return "DÉCHARGE"


def is_consommable_decharge(lignes) -> bool:
    """
    Returns True if ALL lignes are consommables.
    Mixed décharges are treated as bien_inventaire (keep N° inventaire column).
    """
    try:
        return all(l.type_ligne == "consommable" for l in lignes)
    except Exception:
        return False


def group_lignes_by_ressource(lignes) -> list:
    """
    Groups LigneDecharge (bien_inventaire) objects by ressource.
    Returns list of dicts ready for PDF table rendering.
    """
    groups = defaultdict(list)
    for ligne in lignes:
        groups[ligne.id_ressource_id].append(ligne)

    rows = []
    for _rid, ligne_list in groups.items():
        ressource = ligne_list[0].id_ressource
        numeros = [
            l.id_instance_ressource.numero_inventaire
            for l in ligne_list
            if l.id_instance_ressource and l.id_instance_ressource.numero_inventaire
        ]
        rows.append({
            'designation':        ressource.designation.upper(),
            'numero_inventaire':  format_numeros_inventaire(numeros),
            'quantite':           sum(l.quantite for l in ligne_list),
        })
    return rows
