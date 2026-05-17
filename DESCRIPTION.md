# Description complète du projet FMPDF

---

## 1. Vue d'ensemble du projet

**FMPDF** est un système de gestion de magasin (stock) destiné à un établissement institutionnel (université / hôpital) basé au Maroc. Il couvre l'intégralité du cycle de vie des ressources matérielles : acquisition (marchés, bons de commande, donations), stockage, distribution aux services demandeurs, signature des décharges, retours et reporting.

Le projet est constitué de deux composantes principales :

- **Backend** : API REST développée avec Django (Python) et Django REST Framework, exposant des ressources en JSON (camelCase). Le traitement asynchrone lourd (extraction OCR/Excel, génération de PDF) est délégué à Celery via Redis.
- **Frontend** : Single Page Application React (Vite) consommant l'API, avec des interfaces distinctes selon le rôle de l'utilisateur connecté.

Paramètres de localisation : langue `fr-fr`, fuseau horaire `Africa/Casablanca`.

---

## 2. Acteurs et responsabilités

Cinq rôles sont définis dans le modèle `Role` (champ `nom_role`) :

### 2.1 Administrateur (`admin`)
- Création et gestion des comptes utilisateurs (activation, désactivation, affectation de rôle et de service).
- Gestion des fournisseurs (`Fournisseur`).
- Lecture du journal d'audit (`JournalAudit`) avec filtres (utilisateur, table, période, recherche texte).
- Accès total à toutes les ressources de l'API.

### 2.2 Gestionnaire de Magasin (`gestionnaire_magasin`)
- **Import** : téléversement de fichiers PDF ou Excel, révision et validation des articles extraits (StagingItems).
- **Stock** : consultation en temps réel des stocks (consommables et biens d'inventaire), gestion des mouvements.
- **Demandes** : consultation de toutes les demandes, décision de validation (total / partiel / refus), génération automatique de la décharge.
- **Décharges** : confirmation de la signature physique dans le système.
- **Retours** : réception et traitement des retours matériel.
- **Marchés** : création manuelle, confirmation de réception, suivi des étapes.
- Destinataire des alertes de stock bas et des alertes de délai livraison.

### 2.3 Chef de Service (`chef_service`)
- Création des demandes de matériel (avec lignes d'articles et niveau d'urgence).
- Consultation de ses propres demandes uniquement.
- Téléchargement du PDF de décharge associé à sa demande.
- Création de retours matériel pour les biens affectés à son service.
- Réception des notifications : DEMANDE_REJETEE, DECHARGE_GENEREE, DECHARGE_SIGNEE.

### 2.4 Service Financier (`service_financiere`)
- Destinataire des emails d'alerte délai (marchés en attente de livraison approchant ou dépassant leur échéance).
- Accès en lecture aux rapports (reporting).

### 2.5 Fournisseur (`fournisseur`)
- Profil fournisseur lié à un compte `Utilisateur` (relation `OneToOne`).
- Rôle principalement référentiel dans la version actuelle : un fournisseur peut être associé à un `MarcheBC`.

---

## 3. Architecture technique

### 3.1 Vue globale

```
┌────────────────────────────────────┐       ┌─────────────────────┐
│         React SPA (Vite)           │◄─────►│  Django REST API    │
│  Zustand · Tailwind · Axios        │  JWT  │  (DRF · camelCase)  │
└────────────────────────────────────┘       └──────────┬──────────┘
                                                        │
                                              ┌─────────┴──────────┐
                                              │       Celery        │
                                              │  queues: ocr / pdf  │
                                              │         alerts      │
                                              └─────────┬──────────┘
                                                        │
                                                   ┌────┴────┐
                                                   │  Redis  │
                                                   │ broker  │
                                                   └─────────┘
```

### 3.2 Backend Django

| Élément | Valeur |
|---|---|
| Modèle auth | `users.Utilisateur` (AbstractBaseUser, `USERNAME_FIELD = "email"`) |
| ORM | Django ORM avec `select_related`, `prefetch_related`, `F()` pour les mises à jour atomiques |
| Sérialisation | DRF + `djangorestframework-camel-case` (toutes les réponses JSON sont en camelCase) |
| Documentation API | `drf-spectacular` (OpenAPI 3, route `/api/schema/`) |
| Fichiers statiques | WhiteNoise (`CompressedManifestStaticFilesStorage`) |
| Fichiers média | `FileSystemStorage` (répertoire `/app/media/`) |
| Base de données | SQLite (développement, timeout 20s) ou PostgreSQL (production via `DATABASE_URL`) |
| Langue / Fuseau | `fr-fr` / `Africa/Casablanca` |

**Applications Django :**

| App | Responsabilité |
|---|---|
| `users` | Utilisateurs, rôles, services, fournisseurs, permissions, audit |
| `resources` | Ressources, stocks, instances, mouvements de stock |
| `procurement` | Marchés/BC, imports PDF/Excel, staging, lots d'articles |
| `requests` | Demandes et lignes de demande |
| `decharge` | Décharges, lignes, signatures |
| `returns` | Retours matériel |
| `alerts` | Notifications, alertes délai, journal d'audit |
| `reporting` | Vues de reporting en lecture seule |
| `core` | Permissions DRF, configuration Celery, utilitaires partagés |

### 3.3 Frontend React

| Élément | Technologie |
|---|---|
| Build | Vite |
| Style | Tailwind CSS |
| État global | Zustand avec middleware `persist` (localStorage) pour le token JWT |
| Requêtes API | Axios (appels HTTP bruts) + React Query (cache, refetch automatique, gestion de l'état serveur), organisés par domaine dans `src/api/` (decharge.js, procurement.js, requests.js, resources.js, returns.js) |
| Pages | Organisées par rôle : `src/pages/gestionnaire/`, `src/pages/chef/`, `src/pages/financier/` |
| Composants | `NotificationBell`, `StatusBadge`, `AppLayout` (barre de navigation + cloche) |

### 3.4 Traitement asynchrone (Celery)

| File (queue) | Tâches |
|---|---|
| `ocr` | `extract_pdf_items`, `extract_excel_items` — extraction et création des StagingItems |
| `pdf` | `generate_decharge_pdf` — génération du PDF de décharge avec ReportLab |
| `alerts` | `check_marche_deadlines` (Celery Beat, périodique), `send_notification_email` |

Configuration Redis : `CELERY_BROKER_URL` (base 0), `CELERY_RESULT_BACKEND` (base 1).

Les tâches `extract_excel_items` et `extract_pdf_items` utilisent un mécanisme de retry avec backoff exponentiel (`max_retries=3`, délai = `2^retries × 60s`). En cas d'échec définitif, l'import est marqué `rejete`.

---

## 4. Modèle de données

### 4.1 App `users`

**`Role`** — `nom_role` (unique) : `service_financiere | gestionnaire_magasin | chef_service | admin | fournisseur`

**`Service`** — type : `administratif | chu | decanat | pharmacie | dentaire | labo | association`

**`Utilisateur`** (AbstractBaseUser + PermissionsMixin)
- `id_utilisateur` (PK), `email` (unique, USERNAME_FIELD), `nom_complet`, `actif`, `is_staff`, `titre_poste`
- FK → `Role`, FK → `Service`
- Propriétés : `is_gestionnaire`, `is_chef_service`, `is_financiere`, `is_fournisseur`, `is_admin`

**`Fournisseur`** — `nom_societe`, `email`, `evaluation`; OneToOne → `Utilisateur`

**`Permission` / `RolePermission`** — table de permissions granulaires par module/action, liée aux rôles.

### 4.2 App `resources`

**`Categorie`** — `nom_categorie` : `Consommable | Bien Inventaire`

**`SousCategorie`** — hiérarchique (auto-référence `id_parent_sous_categorie`), FK → `Categorie`

**`Ressource`**
- `designation`, `description`, `unite_mesure`, `seuil_alerte`
- FK → `Categorie`, FK optionnel → `SousCategorie`
- Propriétés : `is_consommable`, `is_bien_inventaire`, `est_en_alerte`

**`Stock`** (uniquement pour les consommables)
- OneToOne → `Ressource`
- `quantite_disponible`, `quantite_reservee`, `seuil_alerte`
- Propriété calculée : `quantite_reelle = quantite_disponible - quantite_reservee`
- Signal `pre_save` → cache l'état précédent pour détecter le passage en alerte
- Signal `post_save` → `on_stock_bas` → `_notify_gestionnaires_for_stock`

**`InstanceRessource`** (uniquement pour les biens d'inventaire)
- `numero_inventaire` (format `INV-YYYY-NNNN`, généré par signal `pre_save`)
- `statut` : `en_stock | en_service | en_maintenance | hors_service | retire`
- `etat` : `neuf | bon_etat | endommage | hors_service | retourne`
- `date_acquisition`, `valeur_acquisition`, `localisation_actuelle`
- FK → `Ressource`, FK optionnel → `Service` (service actuel), FK optionnel → `LotArticle`

**`MouvementStock`**
- `type_mouvement` : `entree | sortie | retour | transfert | rebut`
- `quantite`, `date_mouvement`
- `source` : GenericForeignKey (ContentType + object_id) — référence polymorphe vers la ligne de décharge ou l'import
- FK → `Ressource`, FK optionnel → `InstanceRessource`, FK optionnel → `Utilisateur`

### 4.3 App `procurement`

**`MarcheBC`**
- `reference` (unique), `type_acquisition` : `marche | bon_commande | donation`
- `source` : `manuel | import`
- `statut` : `en_attente_livraison | receptionne_et_stocke`
- Délais automatiques : `marche` → 90j, `bon_commande` → 40j, `donation` → 0j
- `date_livraison_prevue` calculée automatiquement dans `save()`
- À la création : `MarcheEtape.create_default_etapes()` crée 8 étapes (étape 1 `marche_cree` déjà `complete`)
- FK optionnel → `Fournisseur`, FK optionnel → `Utilisateur` (créateur)

**`MarcheEtape`**
- `nom_etape` : `marche_cree | contrat_signe | en_attente_livraison | livraison_en_cours | receptionne_magasin | controle_qualite | paiement_en_cours | paiement_effectue`
- `statut` : `en_attente | en_cours | complete | bloque`
- `ordre` (1–8)

**`ImportExcelBC`**
- `statut_import` : `brouillon | en_revision | valide | non_conforme | rejete | en_attente | autre`
- `file_type` : `xlsx | pdf`
- `source_type` : `bc | marche | donation`
- Métadonnées extraites du document : `reference_document`, `fournisseur_denomination`, `fournisseur_telephone`, `fournisseur_email`, `fournisseur_adresse`, `delai_execution`
- OneToOne → `MarcheBC`

**`StagingItem`** — zone tampon de révision des articles extraits
- `designation_brute` (texte OCR brut), `designation_normalisee` (normalisée)
- `type_detecte` : `consommable | bien_inventaire` (ou vide)
- `statut` : `en_attente | modifie | approuve | rejete`
- `quantite`, `unite`, `prix_unitaire_ht`, `prix_total_ht`
- FK optionnel → `Categorie` (suggérée), FK optionnel → `SousCategorie` (suggérée)
- FK optionnel → `Ressource` (liée après approbation)

**`LotArticle`** — regroupe les articles d'un même marché pour une ressource donnée
- `numero_lot`, `designation`, `quantite_commandee`, `quantite_recue`
- FK → `MarcheBC`, FK → `Ressource`

### 4.4 App `requests`

**`Demande`**
- `numero` : format `DEM-YYYY-NNNN` (généré dans `save()`)
- `urgence` : `normal | moyen | urgent`
- `statut` : `en_attente | partielle | totale | refusee`
- `justification`, `commentaire_validation`, `motif_refus`
- FK → `Utilisateur` (chef demandeur), FK → `Service`, FK optionnel → `Utilisateur` (validé par)

**`LigneDemande`**
- `quantite_demandee`, `quantite_accordee` (0 par défaut), `quantite_livree` (0 par défaut)
- FK → `Demande`, FK → `Ressource`

### 4.5 App `decharge`

**`Decharge`**
- `numero_decharge` : format `DCH-YYYY-NNNN` (généré dans `save()`)
- `date_generation`, `date_livraison`, `fichier_pdf` (généré par Celery)
- OneToOne → `Demande`; FK → `Utilisateur` (généré par), FK optionnel → `Utilisateur` (livré à)

**`LigneDecharge`**
- `type_ligne` : `consommable | bien_inventaire`
- `quantite`
- FK → `Decharge`, FK → `Ressource`
- FK optionnel → `InstanceRessource` (obligatoire si `bien_inventaire`, interdit si `consommable`)
- Contrainte DB : `CheckConstraint("decharge_instance_required_by_type")`

**`SignatureDecharge`**
- `statut` : `non_signe | signe` (défaut : `non_signe`)
- `date_signature`, `date_validation_systeme`
- OneToOne → `Decharge`; FK optionnel → `Utilisateur` (chef de service), FK optionnel → `Utilisateur` (validé par)

### 4.6 App `returns`

**`RetourMateriel`**
- `motif_retour` : `panne | inutilise`
- `statut` : `en_attente | receptionne`
- `decision` : `hors_service | en_stock | repare | non_repare | rebut | reaffecte`
- `date_retour`, `date_reception`, `justification_decision`
- FK → `Ressource`, FK optionnel → `InstanceRessource`, FK → `Utilisateur` (retourné par), FK optionnel → `Utilisateur` (traité par)

### 4.7 App `alerts`

**`AlerteDelai`**
- `niveau_alerte` : `info | warning | critique`
- `penalite_applicable`, `acquitte`
- `date_echeance`; FK → `MarcheBC`
- Propriété `jours_restants` calculée à la volée

**`Notification`**
- `type` : `demande_soumise | demande_validee | demande_rejetee | decharge_generee | decharge_signee | retour_enregistre | alerte_stock | import_staging`
- `niveau` : `info | success | warning | danger`
- `message` (max 500 car.), `lien`, `lu`, `objet_id`
- FK → `Utilisateur` (destinataire)

**`JournalAudit`**
- `type_action`, `table_cible`, `id_enregistrement_cible`
- `ancienne_valeur`, `nouvelle_valeur` (texte libre)
- `date_action`, `adresse_ip`, `user_agent`
- FK optionnel → `Utilisateur`

### 4.8 Machines d'états résumées

| Entité | Transitions |
|---|---|
| `Demande.statut` | `en_attente` → `partielle` \| `totale` \| `refusee` |
| `StagingItem.statut` | `en_attente` → `modifie` (PATCH champs surveillés) → `approuve` \| `rejete` |
| `ImportExcelBC.statut_import` | `brouillon` → `en_revision` (tâche OCR) → `valide` \| `rejete` (signal) |
| `MarcheBC.statut` | `en_attente_livraison` → `receptionne_et_stocke` |
| `SignatureDecharge.statut` | `non_signe` → `signe` |
| `RetourMateriel.statut` | `en_attente` → `receptionne` |
| `InstanceRessource.statut` | `en_stock` → `en_service` → `en_maintenance` \| `hors_service` \| `retire` |

---

## 5. Workflows métier détaillés

### WF1 — Import PDF/Excel → Validation → Stock

1. **Le gestionnaire** téléverse un fichier PDF ou Excel via `POST /api/procurement/import/direct/` (`file_type`, `source_type`).
2. **Le système** crée un `ImportExcelBC` (`statut = "brouillon"`) lié à un `MarcheBC` provisoire, puis déclenche la tâche Celery `extract_pdf_items` ou `extract_excel_items` (queue `ocr`).
3. **La tâche** passe le statut à `en_revision`, extrait les articles avec `AIExtractor` (pdfplumber + regex), crée les `StagingItem` (`statut = "en_attente"`). L'import reste à `en_revision` jusqu'à la fin de la révision manuelle.
4. **Le gestionnaire** consulte l'import (`GET /api/procurement/import/?scope=extraites`) et examine chaque article :
   - **Approuver directement** (`POST /procurement/staging/{id}/approve/`) → `statut = "approuve"`
   - **Modifier puis approuver** (`PATCH /procurement/staging/{id}/` — champs surveillés détectés → `statut = "modifie"`, puis `POST .../approve/`) → `statut = "approuve"`
   - **Rejeter** (`POST /procurement/staging/{id}/reject/`) → `statut = "rejete"`
5. **Le signal `on_staging_approuve`** (post_save sur `StagingItem`) :
   - Appelle `_find_or_create_ressource()` : recherche par désignation exacte (insensible à la casse), sinon crée une `Ressource`.
   - Appelle `_integrate_item_into_stock()` : pour un consommable → `Stock.quantite_disponible += quantite` + `MouvementStock(entree)` ; pour un bien inventaire → création de `N` instances `InstanceRessource` (`statut = en_stock`, `etat = neuf`, numérotées `INV-YYYY-NNNN`) + `MouvementStock(entree)`.
   - Appelle `_check_import_complete()` : si tous les articles sont traités et au moins un approuvé → `ImportExcelBC.statut = "valide"`, `MarcheBC.statut = "receptionne_et_stocke"`, `_sync_marche_reference()` (mise à jour de la référence), `_complete_reception_etapes()` (4 étapes passées à `complete`).

### WF2 — Demande → Validation → Décharge → Signature

1. **Le chef de service** crée une demande (`POST /api/requests/demandes/`) avec lignes (`id_ressource + quantite_demandee`) et niveau d'urgence. Statut → `en_attente`. Le gestionnaire reçoit une notification `DEMANDE_SOUMISE`.
2. **Le gestionnaire** consulte les demandes (`GET /api/requests/demandes/`), vérifie le stock, renseigne `quantite_accordee` par ligne, et appelle `POST /api/requests/demandes/{id}/valider/` avec `decision = "total" | "partiel" | "refus"`.
   - **Refus** : `Demande.statut = "refusee"`, notification `DEMANDE_REJETEE` envoyée au chef.
   - **Total** : `Demande.statut = "totale"`, `quantite_accordee = quantite_demandee` sur toutes les lignes.
   - **Partiel** : `Demande.statut = "partielle"`, `quantite_accordee < quantite_demandee` sur au moins une ligne.
3. **En cas d'accord (total ou partiel)**, `valider()` effectue dans une transaction atomique :
   - Vérification préalable du stock : pour chaque consommable avec `quantite_accordee > 0`, si `Stock.quantite_disponible < qa` → HTTP 400 (le stock ne peut jamais devenir négatif).
   - Création d'une `Decharge` (numéro `DCH-YYYY-NNNN`) et des `LigneDecharge` correspondantes.
   - **Mise à jour immédiate du stock** pour chaque ligne :
     - Consommable : `Stock.quantite_disponible -= quantite_accordee` ET `Stock.quantite_reservee += quantite_accordee` (via `F()` — atomique SQL) + `MouvementStock(sortie)`.
     - Bien inventaire : `InstanceRessource.statut = "en_service"`, `id_service_actuel = service`, `date_derniere_affectation = today()` + `MouvementStock(sortie)`.
   - Création d'une `SignatureDecharge` (`statut = "non_signe"`).
   - Déclenchement de la tâche `generate_decharge_pdf` (queue `pdf`).
   - Notification du chef : `DECHARGE_GENEREE`.
4. **Le chef** télécharge le PDF (`GET /api/decharge/decharges/{id}/pdf/`) et signe le document papier physiquement (aucune action système à cette étape).
5. **Le gestionnaire** reçoit le document signé, vérifie la signature, et confirme en un seul clic dans le système (`POST /decharges/{id}/signature/confirmer/`) → `SignatureDecharge.statut = "signe"` (transition unique `non_signe → signe`). Après la sauvegarde, la vue libère les réservations : pour chaque ligne consommable, `Stock.quantite_reservee -= quantite` (via `F()`). La `quantite_disponible` n'est pas modifiée à cette étape car elle a déjà été décrémentée à la validation.
6. **Le signal `on_signature_valide`** (post_save sur `SignatureDecharge`, déclenché uniquement si `statut = "signe"`) :
   - Met à jour `quantite_livree = quantite_accordee` sur chaque `LigneDemande`, puis recalcule `Demande.statut` (`totale` ou `partielle`).
   - Notifie le chef : `DECHARGE_SIGNEE`.
   - **Aucune logique stock dans ce signal** — toute la gestion du stock est dans les vues explicitement (`valider()` pour la sortie/réservation, `confirmer()` pour la libération).

### WF3 — Retour de Matériel

1. **Le chef de service** crée un retour (`POST /api/returns/retours/`) avec `motif_retour = "panne" | "inutilise"`, `id_ressource`, `id_instance_ressource`. Statut → `en_attente`. Notification `RETOUR_ENREGISTRE` envoyée au gestionnaire.
2. **Le gestionnaire** consulte les retours (`GET /api/returns/retours/`), inspecte physiquement le matériel, puis réceptionne (`PATCH statut → "receptionne"`, `date_reception = now()`).
3. Selon le motif :
   - **`panne`** : `InstanceRessource.statut = "hors_service"`, `etat = "hors_service"`, `id_service_actuel = null`.
   - **`inutilise`** : `InstanceRessource.statut = "retourne"`, `id_service_actuel = null` (visible dans l'inventaire comme « Retourné » ; le gestionnaire peut manuellement le repasser en `"en_stock"` après inspection).
4. Le gestionnaire renseigne `justification_decision` et enregistre (`PATCH /api/returns/retours/{id}/`).

### WF4 — Création de Marché Manuel → Confirmation Réception

1. **Le gestionnaire** remplit le formulaire marché (`POST /api/procurement/marches/`) avec type d'acquisition, articles, et choisit le statut initial.
   - **Statut = `receptionne_et_stocke`** : les articles sont intégrés immédiatement au stock (`_find_or_create_ressource + _integrate_item`), `MouvementStock(entree)` créé, MarcheBC visible dans la liste.
   - **Statut = `en_attente_livraison`** : MarcheBC créé avec délai calculé, `date_livraison_prevue` calculée (`marche` → +90j, `bon_commande` → +40j, `donation` → +0j), 8 étapes créées (étape 1 `complete`, autres `en_attente`). La tâche périodique `check_marche_deadlines` surveille les échéances.
2. **Le gestionnaire** clique « Confirmer réception » (`POST /api/procurement/marches/{id}/confirmer-reception/`) :
   - `MarcheBC.statut = "receptionne_et_stocke"`, `date_reception = now()`
   - Intégration des articles au stock
   - 4 étapes de réception marquées `complete`

---

## 6. Système de notifications

### 6.1 Types de notifications

| Type | Niveau | Déclencheur |
|---|---|---|
| `demande_soumise` | info | Création d'une demande → notifie tous les gestionnaires actifs |
| `demande_validee` | success | (prévu dans le modèle, envoi dans `valider()`) |
| `demande_rejetee` | danger | Décision `refus` dans `valider()` ou `refuser()` → notifie le chef |
| `decharge_generee` | success | Décharge créée dans `valider()` → notifie le chef |
| `decharge_signee` | success | Vue `confirmer()` déclenche le signal `on_signature_valide` → notifie le chef |
| `retour_enregistre` | warning | Création d'un retour → notifie les gestionnaires |
| `alerte_stock` | warning | Stock consommable passe sous le seuil → notifie les gestionnaires |
| `import_staging` | info | Import envoyé en révision (`envoyer_gestionnaire`) → notifie les gestionnaires |

### 6.2 Déduplication

La fonction `create_notification()` filtre les doublons sur la fenêtre `(destinataire, type, objet_id, created_at >= now() - window)` :
- Fenêtre par défaut : **5 minutes** (évite les notifications doublons sur double-clic ou signal multiple)
- Fenêtre `ALERTE_STOCK` : **24 heures** (évite le spam lors de mouvements de stock fréquents)

### 6.3 Alertes délai (Celery Beat)

La tâche périodique `check_marche_deadlines` (queue `alerts`) scrute tous les marchés `en_attente_livraison` :

| Jours restants | Action |
|---|---|
| 8–14j | Alerte `warning` (`AlerteDelai`) + notification in-app aux gestionnaires |
| 1–7j | Alerte `critique` + email aux gestionnaires et service financier |
| < 0j (dépassé) | Alerte `critique` + `penalite_applicable = True` + email d'urgence |

### 6.4 Emails

- `send_notification_email` (tâche Celery) : envoie un email HTML au destinataire d'une notification, puis marque `lu = True`.
- `send_alert_email` : email d'alerte délai (template `emails/alerte_delai.html`) envoyé via `send_mail`.
- Backend email configurable via `.env` (`EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, etc.).

---

## 7. Sécurité et contrôle d'accès

### 7.1 Authentification JWT

- **Token d'accès** : durée de vie 8 heures
- **Token de rafraîchissement** : durée de vie 7 jours
- Champ identifiant : `USER_ID_FIELD = "id_utilisateur"`, claim `"user_id"`
- Module `rest_framework_simplejwt.token_blacklist` activé pour la révocation des tokens

### 7.2 Classes de permission DRF

| Classe | Condition |
|---|---|
| `IsAdmin` | `id_role.nom_role == "admin"` |
| `IsGestionnaire` | `id_role.nom_role == "gestionnaire_magasin"` |
| `IsGestionnaireOrAdmin` | l'un ou l'autre |
| `IsChefService` | `id_role.nom_role == "chef_service"` |
| `IsServiceFinanciere` | `id_role.nom_role == "service_financiere"` |
| `IsFournisseur` | `id_role.nom_role == "fournisseur"` |
| `IsChefServiceOwner` | `obj.id_chef_demandeur == request.user` (niveau objet) |
| `IsFournisseurOwner` | `obj.id_fournisseur == user.fournisseur_profile` (niveau objet) |

### 7.3 Contrôle par vue

- **Demandes** : création → `IsChefService` ; modification/suppression/validation → `IsGestionnaireOrAdmin` ; liste/détail → les deux rôles (le chef ne voit que ses propres demandes via filtre queryset + vérification objet).
- **Utilisateurs** : CRUD → `IsAdmin` uniquement.
- **Services** : lecture → `IsAuthenticated` ; écriture → `IsAdmin`.
- **Rôles** : lecture seule → `IsAuthenticated`.
- **Journal d'audit** : lecture seule → `IsAdmin`.

### 7.4 CORS

`CORS_ALLOWED_ORIGINS` configurable via `.env` (par défaut : `http://localhost:5173`, `http://localhost:3000`).

### 7.5 Journal d'audit

Le modèle `JournalAudit` trace les actions significatives (`type_action`, `table_cible`, `id_enregistrement_cible`, `ancienne_valeur`, `nouvelle_valeur`, `adresse_ip`, `user_agent`). Accessible en lecture seule par les administrateurs via `GET /api/users/audit/`.

---

## 8. Besoins fonctionnels

| # | Besoin |
|---|---|
| BF-01 | Importer un fichier PDF ou Excel et extraire automatiquement les articles (désignation, quantité, prix) |
| BF-02 | Permettre au gestionnaire de réviser, corriger, approuver ou rejeter chaque article extrait avant intégration au stock |
| BF-03 | Gérer deux types de ressources : consommables (suivi par quantité) et biens d'inventaire (suivi par instance individuelle numérotée INV-YYYY-NNNN) |
| BF-04 | Permettre au chef de service de soumettre des demandes de matériel avec lignes, urgence et justification |
| BF-05 | Permettre au gestionnaire de valider (total/partiel) ou refuser une demande, avec génération automatique de la décharge correspondante |
| BF-06 | Générer un PDF de décharge A4 (en-tête institutionnel avec 3 logos, tableau d'articles) via ReportLab |
| BF-07 | Gérer le circuit de signature physique de la décharge (téléchargement PDF → signature papier → confirmation système) |
| BF-08 | Mettre à jour automatiquement le stock (sortie) et le statut des instances à la validation de la demande (et libérer la réservation consommable à la confirmation de signature) |
| BF-09 | Permettre la création de retours matériel (panne ou inutilisé) avec traitement et mise à jour du statut de l'instance |
| BF-10 | Créer des marchés/bons de commande/donations manuellement ou par import, avec suivi des 8 étapes de réception |
| BF-11 | Calculer automatiquement les délais de livraison et générer des alertes (in-app + email) en cas d'approche ou dépassement |
| BF-12 | Notifier en temps réel les acteurs concernés (in-app) pour tous les événements majeurs |
| BF-13 | Fournir un tableau de bord de reporting (stock instantané, mouvements) |
| BF-14 | Tracer toutes les actions significatives dans un journal d'audit |
| BF-15 | Gérer les utilisateurs, rôles et services (CRUD admin) |

---

## 9. Besoins non fonctionnels

| # | Besoin | Mise en œuvre |
|---|---|---|
| BNF-01 | **Performance** — les opérations lourdes ne bloquent pas l'API | Celery (queues `ocr`, `pdf`, `alerts`) pour OCR, PDF et emails |
| BNF-02 | **Cohérence des données** — pas d'état partiel en cas d'erreur | Transactions atomiques (`transaction.atomic()`) dans `valider()` |
| BNF-03 | **Concurrence** — pas de condition de course sur le stock | `F()` expressions pour les mises à jour de quantité (atomiques au niveau SQL) |
| BNF-04 | **Idempotence** — pas de double création | Guard `Decharge.objects.filter(id_demande=demande).exists()` dans `valider()` |
| BNF-05 | **Sécurité** | JWT + blacklist, CORS configuré, permissions DRF strictes ; téléversement de fichiers : limite 10 Mo, liste blanche d'extensions (`.pdf`, `.xlsx`), vérification des magic bytes (`%PDF`, `PK`) |
| BNF-06 | **Traçabilité** | `JournalAudit`, `MouvementStock` (GenericForeignKey pour la source) |
| BNF-07 | **Localisation** | `LANGUAGE_CODE = "fr-fr"`, `TIME_ZONE = "Africa/Casablanca"` |
| BNF-08 | **Maintenabilité** | Apps Django découplées, signaux post_save clairement délimités ; toute la logique stock dans les vues (jamais dans les signaux) |
| BNF-09 | **Scalabilité** | Redis + workers Celery dédiés par queue (ajout horizontal de workers) |
| BNF-10 | **Documentation API** | OpenAPI auto-générée via `drf-spectacular` (`/api/schema/`) |
| BNF-11 | **Rétention de token** | `token_blacklist` pour invalider les refresh tokens à la déconnexion |
| BNF-12 | **Sécurité fichiers** — protection contre le path traversal | Les tâches Celery (`ocr`, `pdf`) valident le chemin résolu via `pathlib.Path.resolve().startswith(MEDIA_ROOT)` avant tout accès fichier |
| BNF-13 | **Performance — index DB** | `db_index=True` sur 9 champs fréquemment filtrés (`Demande.statut`, `Demande.date_demande`, `Notification.lu`, `Notification.type`, `Notification.created_at`, `InstanceRessource.statut`, `InstanceRessource.etat`, `MarcheBC.statut`, `MarcheBC.source`) |
| BNF-14 | **Performance — cache HTTP** | `Cache-Control: max-age=25, private` sur `GET /api/alerts/notifications/unread-count/` (polling toutes les 30 s) |
| BNF-15 | **Intégrité stock** — pas de stock négatif | Guard pré-transactionnel dans `valider()` : si `quantite_disponible < qa` → HTTP 400 avant toute modification |

---

## 10. API REST — Référence des endpoints

### 10.1 Authentification (`/api/auth/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| POST | `/api/auth/token/` | Obtenir access + refresh token (email + password) | Publique |
| POST | `/api/auth/token/refresh/` | Rafraîchir le token d'accès | Publique |
| POST | `/api/auth/token/blacklist/` | Révoquer le refresh token | Authentifié |

### 10.2 Utilisateurs (`/api/users/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET / POST | `/api/users/utilisateurs/` | Lister / créer des utilisateurs | IsAdmin |
| GET / PATCH / PUT | `/api/users/utilisateurs/{id}/` | Détail / modifier un utilisateur | IsAdmin |
| GET | `/api/users/services/` | Lister les services | IsAuthenticated |
| POST | `/api/users/services/` | Créer un service | IsAdmin |
| GET | `/api/users/roles/` | Lister les rôles | IsAuthenticated |
| GET | `/api/users/fournisseurs/` | Lister les fournisseurs | IsAdmin |
| GET | `/api/users/audit/` | Journal d'audit (filtres : utilisateur, table, date, search) | IsAdmin |

### 10.3 Ressources (`/api/resources/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET / POST | `/api/resources/ressources/` | Lister / créer des ressources | IsAuthenticated |
| GET / PATCH | `/api/resources/ressources/{id}/` | Détail / modifier une ressource | IsAuthenticated |
| GET / POST | `/api/resources/stocks/` | Lister / créer des stocks | IsAuthenticated |
| GET / PATCH | `/api/resources/stocks/{id}/` | Détail / modifier un stock | IsAuthenticated |
| GET / POST | `/api/resources/instances/` | Lister / créer des instances | IsAuthenticated |
| GET / PATCH | `/api/resources/instances/{id}/` | Détail / modifier une instance | IsAuthenticated |
| GET | `/api/resources/mouvements/` | Historique des mouvements | IsAuthenticated |
| GET | `/api/resources/categories/` | Lister les catégories | IsAuthenticated |
| GET | `/api/resources/sous-categories/` | Lister les sous-catégories | IsAuthenticated |

### 10.4 Procurement (`/api/procurement/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET / POST | `/api/procurement/marches/` | Lister / créer des marchés | IsGestionnaireOrAdmin |
| GET / PATCH | `/api/procurement/marches/{id}/` | Détail / modifier un marché | IsGestionnaireOrAdmin |
| POST | `/api/procurement/marches/{id}/confirmer-reception/` | Confirmer la réception | IsGestionnaireOrAdmin |
| GET / POST | `/api/procurement/import/` | Lister / créer des imports | IsGestionnaireOrAdmin |
| POST | `/api/procurement/import/direct/` | Téléverser un fichier PDF ou Excel | IsGestionnaireOrAdmin |
| GET / PATCH | `/api/procurement/staging/{id}/` | Détail / modifier un staging item | IsGestionnaireOrAdmin |
| POST | `/api/procurement/staging/{id}/approve/` | Approuver un staging item | IsGestionnaireOrAdmin |
| POST | `/api/procurement/staging/{id}/reject/` | Rejeter un staging item | IsGestionnaireOrAdmin |

### 10.5 Demandes (`/api/requests/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET | `/api/requests/demandes/` | Lister les demandes (filtrées par rôle) | IsGestionnaireOrAdmin \| IsChefService |
| POST | `/api/requests/demandes/` | Créer une demande | IsChefService |
| GET | `/api/requests/demandes/{id}/` | Détail d'une demande | Idem liste (+ IsChefServiceOwner) |
| PATCH | `/api/requests/demandes/{id}/` | Modifier une demande | IsGestionnaireOrAdmin |
| POST | `/api/requests/demandes/{id}/valider/` | Valider (total / partiel / refus) — `decision` obligatoire | IsGestionnaireOrAdmin |
| GET | `/api/requests/demandes/requester-options/` | Liste des chefs de service actifs | IsAuthenticated |

### 10.6 Décharges (`/api/decharge/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET | `/api/decharge/decharges/` | Lister les décharges | IsGestionnaireOrAdmin \| IsChefService |
| POST | `/api/decharge/decharges/` | Créer une décharge manuellement | IsGestionnaireOrAdmin |
| GET | `/api/decharge/decharges/{id}/` | Détail d'une décharge | IsGestionnaireOrAdmin \| chef propriétaire |
| GET | `/api/decharge/decharges/{id}/download_pdf/` | Télécharger le PDF stocké (ou générer à la volée) | IsGestionnaireOrAdmin \| chef propriétaire |
| GET | `/api/decharge/decharges/{id}/pdf/` | Générer le PDF frais (filtre optionnel `?type=consommable\|bien_inventaire`) | IsGestionnaireOrAdmin \| chef propriétaire |
| GET | `/api/decharge/decharges/{id}/types/` | Composition des types de lignes (`has_consommable`, `has_bien_inventaire`, `is_mixed`) | IsGestionnaireOrAdmin \| chef propriétaire |
| POST | `/api/decharge/decharges/{id}/regenerate_pdf/` | Relancer la génération Celery du PDF | IsGestionnaireOrAdmin |
| GET | `/api/decharge/decharges/{id}/signature/detail/` | Détail de la signature | IsGestionnaireOrAdmin \| chef propriétaire |
| POST | `/api/decharge/decharges/{id}/signature/confirmer/` | Confirmer la signature (`non_signe → signe`) + libérer réservations | IsGestionnaireOrAdmin |

### 10.7 Retours (`/api/returns/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET / POST | `/api/returns/retours/` | Lister / créer des retours | IsAuthenticated |
| GET / PATCH | `/api/returns/retours/{id}/` | Détail / traiter un retour | IsAuthenticated |

### 10.8 Alertes & Notifications (`/api/alerts/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET | `/api/alerts/notifications/` | Lister les notifications du user connecté | IsAuthenticated |
| PATCH | `/api/alerts/notifications/{id}/lu/` | Marquer une notification comme lue | IsAuthenticated |
| PATCH | `/api/alerts/notifications/mark-all-lu/` | Marquer toutes les notifications comme lues | IsAuthenticated |
| GET | `/api/alerts/notifications/unread-count/` | Nombre de notifications non lues — `Cache-Control: max-age=25, private` | IsAuthenticated |
| GET | `/api/alerts/alertes-delai/` | Lister les alertes délai | IsGestionnaireOrAdmin |
| PATCH | `/api/alerts/alertes-delai/{id}/acquitter/` | Acquitter une alerte délai | IsGestionnaireOrAdmin |

### 10.9 Reporting (`/api/reporting/`)

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET | `/api/reporting/dashboard/` | Indicateurs du tableau de bord (stock, demandes en attente) | IsGestionnaireOrAdmin |
| GET | `/api/reporting/dashboard-summary/` | Résumé synthétique : consommables, biens, alertes actives, demandes/retours/imports en attente | IsGestionnaireOrAdmin |
| GET | `/api/reporting/bilan_annuel/` | Bilan annuel par catégorie (entrées, sorties, demandes) | IsAuthenticated |
| GET | `/api/reporting/statistiques_achats/` | Statistiques achats (montants, marchés par type) | IsAuthenticated |
| GET | `/api/reporting/stock/periodique/` | Évolution périodique du stock | IsAuthenticated |

### 10.10 Schéma OpenAPI

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/schema/` | Schéma OpenAPI 3 (drf-spectacular) |

---

## 11. Points techniques notables

### 11.1 Extraction automatique sans LLM (AIExtractor)

La classe `AIExtractor` (`apps/procurement/services/ai_extractor.py`) extrait les articles des documents sans recourir à un modèle de langage :
- **PDF** : `pdfplumber` pour extraire le texte page par page, puis expressions régulières pour identifier les lignes d'articles (désignation, quantité, unité, prix HT).
- **Excel** : `openpyxl` pour lire la feuille active en mode `read_only`/`data_only`, concaténation des cellules par ligne (`|`), puis même pipeline regex que le PDF.
- `AIExtractor.build_import_metadata()` extrait également les métadonnées de l'en-tête du document (référence, fournisseur, délai d'exécution).

### 11.2 Numérotation automatique séquentielle par année

Trois entités génèrent leur numéro automatiquement, avec réinitialisation à chaque année :

| Entité | Format | Mécanisme |
|---|---|---|
| `Demande` | `DEM-YYYY-NNNN` | `save()` — requête `filter(numero__startswith=prefix).order_by("-numero").first()` |
| `Decharge` | `DCH-YYYY-NNNN` | `save()` — même pattern |
| `InstanceRessource` | `INV-YYYY-NNNN` | Signal `pre_save` — `generate_numero_inventaire()` via comptage |

### 11.3 Détection automatique du statut « modifié » (StagingItem)

Dans `StagingItemViewSet.perform_update()`, six champs sont surveillés (`_MODIFIE_TRACKED`) :
`designation_normalisee`, `type_detecte`, `id_categorie_suggeree_id`, `id_sous_categorie_suggeree_id`, `quantite`, `prix_unitaire_ht`.

Avant `serializer.save()`, les valeurs actuelles sont capturées ; après l'enregistrement, si au moins un champ a changé (et que le statut n'est pas déjà `approuve` ou `rejete`), `statut` est automatiquement mis à `"modifie"` via une sauvegarde partielle (`save(update_fields=["statut"])`).

### 11.4 Contrainte d'intégrité DB sur LigneDecharge

Un `CheckConstraint` Django (transposé en contrainte SQL) garantit :
- Si `type_ligne = "bien_inventaire"` → `id_instance_ressource` doit être non nul.
- Si `type_ligne = "consommable"` → `id_instance_ressource` doit être nul.

Cette contrainte est renforcée également au niveau Python dans `LigneDecharge.clean()`.

### 11.5 Mises à jour de stock sans condition de course

Toutes les modifications de `Stock.quantite_disponible` et `InstanceRessource.statut` lors des validations passent par des expressions `F()` ou des `update()` directs au niveau ORM, évitant les race conditions inhérentes au pattern « lire-modifier-écrire » en Python.

### 11.6 Source polymorphe des mouvements de stock (GenericForeignKey)

`MouvementStock` utilise `ContentType` + `object_id` + `GenericForeignKey("content_type", "object_id")` pour référencer la source d'un mouvement quelle que soit sa nature : `LigneDecharge` (sortie sur signature), `StagingItem` (entrée sur approbation import), ou toute autre entité future — sans modification du schéma.

### 11.7 Idempotence du endpoint `valider()`

Avant de créer la décharge, `valider()` vérifie `Decharge.objects.filter(id_demande=demande).exists()`. En cas de double soumission (double-clic UI, retry réseau), la seconde requête reçoit un `HTTP 400` au lieu de créer une décharge en doublon.

### 11.8 Gestion des retries Celery avec backoff exponentiel

Les tâches `extract_excel_items` et `extract_pdf_items` sont configurées avec `max_retries=3` et `bind=True`. En cas d'exception, la tâche se relance avec un délai de `2^retries × 60 secondes` (1 min, 2 min, 4 min). Après épuisement des tentatives, `_mark_rejected()` marque l'import `rejete` avec le message d'erreur tronqué (max 1 800 caractères).

### 11.9 camelCase automatique sur toute l'API

`djangorestframework-camel-case` est configuré comme renderer et parser par défaut. Tout champ snake_case du modèle Django (ex. `id_chef_demandeur`) est automatiquement transformé en camelCase dans les réponses JSON (ex. `idChefDemandeur`) et le frontend envoie les données en camelCase qui sont retraduites en snake_case côté serveur. Cela évite toute conversion manuelle dans les serializers.

### 11.10 Architecture de génération PDF (ReportLab)

Le PDF de décharge est généré par ReportLab sur format A4 :
- **En-tête** : trois logos institutionnels (`logo_left.png`, `logo_center.png`, `logo_right.png`) chargés depuis `DECHARGE_LOGO_DIR`.
- **Titre** : boîte dynamique avec numéro de décharge et date.
- **Tableau articles** : deux formats selon le type de ligne :
  - Consommables : colonnes ARTICLE / QUANTITÉ / AFFECTATION
  - Biens d'inventaire : colonnes DÉSIGNATION / N°INV / QTE / AFFECTATION
- La tâche Celery `generate_decharge_pdf` (queue `pdf`) stocke le fichier dans `media/decharges/pdf/` et met à jour `Decharge.fichier_pdf`.

### 11.11 Patron de réservation de stock (`quantite_disponible` / `quantite_reservee`)

Le stock consommable est géré en deux phases distinctes :

| Moment | Événement | Effet sur `Stock` |
|---|---|---|
| `valider()` — validation de la demande | Création de la décharge | `quantite_disponible -= qa` ET `quantite_reservee += qa` |
| `confirmer()` — confirmation de signature | Livraison physique effective | `quantite_reservee -= qa` (libération de la réservation) |

- `quantite_disponible` : quantité réellement sortie du stock physique (ne remonte jamais lors d'une signature).
- `quantite_reservee` : quantité engagée mais pas encore physiquement livrée (visible dans l'interface comme « N en réserve »).
- `quantite_reelle` (propriété calculée) : `quantite_disponible - quantite_reservee` — quantité disponible pour de nouvelles demandes.
- Toutes les mises à jour passent par `F()` expressions ORM pour éviter les race conditions.
- Script de migration de données (`fix_stock_reservations.py`) pour corriger l'état des décharges non signées créées avant l'introduction du suivi des réservations.

### 11.12 Sécurité des téléversements de fichiers

Le endpoint `POST /api/procurement/import/direct/` applique trois niveaux de validation :
1. **Taille** : rejet si le fichier dépasse 10 Mo.
2. **Extension** : liste blanche `.pdf` et `.xlsx` uniquement.
3. **Magic bytes** : lecture des 4 premiers octets — `%PDF` pour les PDF, signature `PK` pour les fichiers XLSX (format ZIP). Un fichier dont le contenu ne correspond pas à son extension déclarée est rejeté avec HTTP 400.

Les tâches Celery qui accèdent aux fichiers uploadés valident le chemin résolu (`pathlib.Path(path).resolve().startswith(MEDIA_ROOT)`) afin de bloquer toute tentative de path traversal.
