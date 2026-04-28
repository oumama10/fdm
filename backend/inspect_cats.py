import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()
cursor.execute('SELECT id_sous_categorie, nom_sous_categorie, id_categorie_id, id_parent_sous_categorie_id FROM resources_souscategorie')
results = cursor.fetchall()
print('id | nom | cat | parent')
for row in results:
    print(row)
