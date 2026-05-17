.PHONY: build up down logs migrate superuser shell restart createsuperuser

# Construire toutes les images Docker
build:
	docker compose build

# Démarrer tous les services en arrière-plan
up:
	docker compose up -d

# Arrêter tous les services
down:
	docker compose down

# Afficher les logs en continu (Ctrl+C pour quitter)
logs:
	docker compose logs -f

# Appliquer les migrations Django
migrate:
	docker compose exec backend python manage.py migrate

# Créer un superutilisateur Django (admin)
superuser:
	docker compose exec backend python manage.py createsuperuser

# Ouvrir le shell Django
shell:
	docker compose exec backend python manage.py shell

# Redémarrer tous les services
restart:
	docker compose restart

# Afficher le statut des services
ps:
	docker compose ps

# Raccourci : build + up + migrate en une commande
start: build up
	@echo "Attente du démarrage des services..."
	@sleep 5
	docker compose exec backend python manage.py migrate
	@echo ""
	@echo "Projet lancé !"
	@echo "  Frontend : http://localhost:5173"
	@echo "  API      : http://localhost:8000/api/"
	@echo "  Admin    : http://localhost:8000/admin/"
