import sqlite3
import sys

# Ensure utf-8 output to see accents
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('backend/db.sqlite3')
cur = conn.cursor()
cur.execute('SELECT id_sous_categorie, nom_sous_categorie, id_categorie_id, id_parent_sous_categorie_id FROM resources_souscategorie')
for r in cur.fetchall():
    nom = r[1].lower()
    if 'frige' in nom or 'chaise' in nom or 'armoire' in nom or 'congel' in nom:
        print(f"ID={r[0]}, NAME={r[1]}, CATEGORY={r[2]}, PARENT={r[3]}")
