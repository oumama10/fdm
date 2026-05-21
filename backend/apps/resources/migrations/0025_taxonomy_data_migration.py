from django.db import migrations


def _find_root(sc_pk, parent_map, root_pks):
    """Walk up the parent chain until we reach a root pk."""
    visited = set()
    current = sc_pk
    while current not in root_pks:
        if current in visited or current not in parent_map:
            return None
        visited.add(current)
        current = parent_map[current]
    return current


def forward_taxonomy(apps, schema_editor):
    TypeArticle = apps.get_model("resources", "TypeArticle")
    SousCategorie = apps.get_model("resources", "SousCategorie")
    Categorie = apps.get_model("resources", "Categorie")
    Ressource = apps.get_model("resources", "Ressource")

    # 1. Normalize TypeArticle values to lowercase
    TypeArticle.objects.filter(nom_categorie="Consommable").update(nom_categorie="consommable")
    TypeArticle.objects.filter(nom_categorie="Bien Inventaire").update(nom_categorie="bien_inventaire")

    # 2. Promote root SousCategorie rows to new Categorie
    roots = {
        sc["pk"]: sc
        for sc in SousCategorie.objects.filter(
            id_parent_sous_categorie__isnull=True
        ).values("pk", "nom_sous_categorie", "description", "id_type_old_id")
    }
    root_pks = set(roots.keys())

    root_to_cat_id = {}
    for root_pk, root_data in roots.items():
        cat = Categorie.objects.create(
            nom_categorie=root_data["nom_sous_categorie"],
            description=root_data["description"] or "",
            actif=True,
            id_type_id=root_data["id_type_old_id"],
        )
        root_to_cat_id[root_pk] = cat.pk

    # 3. Build parent map for all non-root SousCategorie rows
    parent_map = {
        row["pk"]: row["id_parent_sous_categorie_id"]
        for row in SousCategorie.objects.filter(
            id_parent_sous_categorie__isnull=False
        ).values("pk", "id_parent_sous_categorie_id")
    }

    # 4. Re-point each child SousCategorie to the new Categorie
    for child_pk, parent_pk in parent_map.items():
        root_pk = parent_pk if parent_pk in root_pks else _find_root(parent_pk, parent_map, root_pks)
        if root_pk and root_pk in root_to_cat_id:
            SousCategorie.objects.filter(pk=child_pk).update(
                id_categorie_id=root_to_cat_id[root_pk]
            )

    # 5. Build SousCategorie → new Categorie mapping (covers both roots and children)
    sc_to_cat_id = dict(root_to_cat_id)
    for child_pk, parent_pk in parent_map.items():
        root_pk = parent_pk if parent_pk in root_pks else _find_root(parent_pk, parent_map, root_pks)
        if root_pk and root_pk in root_to_cat_id:
            sc_to_cat_id[child_pk] = root_to_cat_id[root_pk]

    # 6. Set Ressource.id_categorie from sous-categorie hierarchy
    for row in Ressource.objects.values("pk", "id_sous_categorie_id"):
        sc_id = row["id_sous_categorie_id"]
        if sc_id and sc_id in sc_to_cat_id:
            Ressource.objects.filter(pk=row["pk"]).update(
                id_categorie_id=sc_to_cat_id[sc_id]
            )

    # 7. Delete root SousCategorie rows — cascades SET_NULL on Ressource.id_sous_categorie
    SousCategorie.objects.filter(pk__in=root_pks).delete()


def backward_taxonomy(apps, schema_editor):
    # Non-reversible: restoring the hierarchy from the flat Categorie table
    # would require knowing the original root IDs, which are gone.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0024_taxonomy_schema_prep"),
    ]

    operations = [
        migrations.RunPython(forward_taxonomy, backward_taxonomy),
    ]
