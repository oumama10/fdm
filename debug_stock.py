import unicodedata
from apps.resources.models import Ressource, InstanceRessource


def normalize(value):
    s = str(value or "")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = "".join(ch for ch in s if ch.isalnum() or ch.isspace() or ch == "-")
    return s.strip().lower()

print("resources:")
for r in Ressource.objects.select_related("id_categorie", "id_sous_categorie").all():
    print(r.id_ressource, r.designation, "cat=", r.id_categorie.nom_categorie, "sub=", getattr(r.id_sous_categorie, "nom_sous_categorie", r.id_sous_categorie))

print("instances:")
for i in InstanceRessource.objects.select_related("id_ressource__id_sous_categorie").all():
    print(i.id_instance, i.id_ressource_id, "res=", i.id_ressource.designation, "sub=", i.id_ressource.id_sous_categorie.nom_sous_categorie)

active = "Réfrigérateur"
print("normalized active:", normalize(active))
for r in Ressource.objects.select_related("id_sous_categorie").all():
    print("r", r.id_ressource, "norm sub:", normalize(r.id_sous_categorie.nom_sous_categorie), "match", normalize(r.id_sous_categorie.nom_sous_categorie) == normalize(active))
