# Suivi du Projet FMPDF

## Travail réalisé

- Mise en place d'une architecture modulaire backend avec Django/DRF par domaines métier (`users`, `procurement`, `resources`, `requests`, `decharge`, `returns`, `alerts`, `reporting`).
- Mise en place du frontend React/Vite avec pages métier (import, stock, demandes, décharges, retours, reporting).
- Implémentation des workflows d'import Excel et PDF avec extraction, normalisation NLP, staging et validation gestionnaire.
- Intégration de la logique de classification et de validation des articles avant injection en stock.
- Mise en place de la séparation consommables / biens inventaire:
  - consommables vers `Stock`
  - biens inventaire vers `InstanceRessource`
- Ajout et mise à jour de la documentation d'architecture et des diagrammes (`ARCHITECTURE_AND_WORKFLOWS.md`, `ERD.puml`, workflows PlantUML séparés).
- Harmonisation du flux décharge avec impression, signature terrain, confirmation gestionnaire et mise à jour automatique stock/ressources.

## Difficultés rencontrées

- Écarts entre les données disponibles côté API et les champs réellement affichés dans les modales frontend.
- Problèmes intermittents de connectivité locale entre Vite et le backend (`ECONNREFUSED`), bloquant l'affichage dynamique.
- Différences entre l'ancien flux de signature décharge (upload scan) et le flux métier attendu (confirmation gestionnaire après signature papier).
- Incohérences de payload entre anciennes et nouvelles structures de sérialisation (`id_lot`, référence marché, dates d'acquisition).
- Données historiques incomplètes sur certains champs nouvellement exploités.

## Solutions apportées

- Enrichissement des serializers backend pour exposer les informations de lot/marché nécessaires à l'UI.
- Renforcement de la récupération des données côté frontend avec des fallbacks adaptés.
- Ajustements de la configuration proxy Vite et des appels API pour stabiliser les échanges en local.
- Alignement du workflow décharge sur la règle métier:
  - suppression de la dépendance au scan signé côté chef de service
  - action de confirmation de signature côté gestionnaire
  - déclenchement automatique des mises à jour stock/mouvements/instances.
- Mise à jour des documents de référence (architecture + workflows + entités principales) pour refléter l'état actuel du projet.

## Travail en cours

- Finalisation de l'alignement complet frontend/backend sur le nouveau flux de signature décharge.
- Vérification de non-régression sur les parcours critiques:
  - import -> staging -> validation -> stock
  - demande -> décharge -> signature -> mise à jour stock.
- Nettoyage des libellés et états métier pour améliorer la lisibilité utilisateur.
- Consolidation de la documentation fonctionnelle et technique pour les équipes.

## Prochaines étapes

- Exécuter une campagne de tests E2E orientée workflows métier.
- Réaliser un backfill ciblé des données historiques si nécessaire (dates/références manquantes).
- Standardiser les contrats API (champs, formats, statuts) et figer une convention commune.
- Finaliser la version des diagrammes UML validée par l'équipe fonctionnelle.
- Préparer une checklist de mise en production (services, broker, monitoring, sauvegardes, observabilité).
