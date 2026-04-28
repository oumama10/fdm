import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Get table info
cursor.execute('PRAGMA table_info(procurement_stagingitem)')
columns = cursor.fetchall()

print('Fields in procurement_stagingitem table:')
print('=' * 50)
for col in columns:
    cid, name, type_, notnull, default, pk = col
    constraint = "NOT NULL" if notnull else "NULL"
    pk_flag = "PRIMARY KEY" if pk else ""
    print(f"{name}: {type_} {constraint} {pk_flag}".strip())

conn.close()