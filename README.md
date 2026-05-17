# FMPDF — Système de Gestion des Stocks

Application web de gestion de magasin pour un établissement institutionnel.
Couvre l'intégralité du cycle : import de documents, gestion du stock, demandes de matériel, décharges, retours et reporting.

---

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et lancé
- Git

> **Windows** : les commandes `make` nécessitent [GNU Make pour Windows](https://gnuwin32.sourceforge.net/packages/make.htm)
> ou WSL. Si `make` n'est pas disponible, exécutez les commandes Docker directement (voir section [Sans Make](#sans-make)).

---

## Lancement rapide

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd fmpdf

# 2. Créer le fichier de configuration
cp .env.example .env
# Éditez .env si nécessaire (SECRET_KEY, etc.)

# 3. Construire les images Docker
make build

# 4. Démarrer les services
make up

# 5. Appliquer les migrations (première utilisation uniquement)
make migrate

# 6. Créer un compte administrateur
make superuser
```

---

## Accès

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API REST | http://localhost:8000/api/ |
| Admin Django | http://localhost:8000/admin/ |
| Schéma OpenAPI | http://localhost:8000/api/schema/ |

---

## Commandes disponibles

```bash
make build       # Construire toutes les images Docker
make up          # Démarrer tous les services (mode détaché)
make down        # Arrêter tous les services
make logs        # Afficher les logs en temps réel
make migrate     # Appliquer les migrations Django
make superuser   # Créer un superutilisateur
make shell       # Ouvrir le shell Django interactif
make restart     # Redémarrer tous les services
make ps          # Statut des services
make start       # build + up + migrate en une seule commande
```

---

## Sans Make

Si `make` n'est pas disponible, utilisez directement :

```bash
docker compose build
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose logs -f
docker compose down
```

---

## Structure du projet

```
fmpdf/
├── backend/          # API Django (DRF)
│   ├── apps/         # Applications Django (users, resources, requests, …)
│   ├── config/       # Settings, URLs, Celery
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/         # Application React + Vite
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── .env.example      # Variables d'environnement (à copier en .env)
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Django 6 + Django REST Framework |
| Frontend | React + Vite + Tailwind CSS |
| Tâches asynchrones | Celery + Redis |
| Base de données | SQLite (développement) |
| Génération PDF | ReportLab |
| Extraction documents | pdfplumber + openpyxl |

---

## Notes

- La base de données SQLite est créée automatiquement dans `backend/db.sqlite3` au premier `make migrate`.
- Les fichiers uploadés et les PDF générés sont stockés dans un volume Docker nommé `media_data`.
- Les logos institutionnels pour les PDF de décharge doivent être placés dans `backend/static/decharge/`
  (`logo_left.png`, `logo_center.png`, `logo_right.png`). En leur absence, des textes de remplacement sont utilisés.
- Pour relancer uniquement un service : `docker compose restart backend`
- Pour voir les logs d'un seul service : `docker compose logs -f celery_worker`
