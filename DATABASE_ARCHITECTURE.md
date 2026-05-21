# Database Architecture — FDM (Facility & Distribution Management)

> Generated: 2026-05-21 | Django ORM | SQLite (dev) / PostgreSQL-ready | 25 models across 7 app modules

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Module Reference](#2-module-reference)
   - [users](#21-users)
   - [resources](#22-resources)
   - [procurement](#23-procurement)
   - [requests](#24-requests)
   - [decharge](#25-decharge)
   - [returns](#26-returns)
   - [alerts](#27-alerts)
3. [Relationship Map (ERD)](#3-relationship-map-erd)
4. [Cross-Module FK Index](#4-cross-module-fk-index)
5. [Detected Issues](#5-detected-issues)
6. [Improvement Recommendations](#6-improvement-recommendations)
7. [Risk & Refactoring Priorities](#7-risk--refactoring-priorities)

---

## 1. Schema Overview

```
users ─────────────────────────────────────────────────────────────────────
  Role ──< RolePermission >── Permission
  Etablissement ──< Batiment ──< Service ──< Beneficiaire
  Service ──< Utilisateur >── Role
  Utilisateur ──| Fournisseur (OneToOne, optional)

resources ─────────────────────────────────────────────────────────────────
  TypeArticle ──< Categorie ──< SousCategorie
  TypeArticle ──< Ressource >── Categorie, SousCategorie (optional)
  Ressource ──| Stock (OneToOne, consommable only)
  Ressource ──< InstanceRessource (bien_inventaire only)
  Ressource ──< MouvementStock
  InstanceRessource ──< MouvementStock

procurement ────────────────────────────────────────────────────────────────
  MarcheBC ──| ImportExcelBC (OneToOne)
  MarcheBC ──< MarcheEtape
  MarcheBC ──< LotArticle >── Ressource
  ImportExcelBC ──< StagingItem >── Ressource, TypeArticle, SousCategorie

requests ───────────────────────────────────────────────────────────────────
  Demande ──< LigneDemande >── Ressource

decharge ───────────────────────────────────────────────────────────────────
  Demande ──| Decharge (OneToOne)
  Decharge ──< LigneDecharge >── Ressource, InstanceRessource
  Decharge ──| SignatureDecharge (OneToOne)

returns ────────────────────────────────────────────────────────────────────
  RetourMateriel >── Ressource, InstanceRessource

alerts ─────────────────────────────────────────────────────────────────────
  MarcheBC ──< AlerteDelai
  Utilisateur ──< Notification
  Utilisateur ──< JournalAudit
```

**Table count by module:**

| Module       | Tables |
|-------------|--------|
| users        | 9      |
| resources    | 7      |
| procurement  | 5      |
| requests     | 2      |
| decharge     | 3      |
| returns      | 1      |
| alerts       | 3      |
| **Total**    | **30** |

> Note: `reporting` and `core` apps contain no models.

---

## 2. Module Reference

---

### 2.1 users

**Business purpose:** Authentication, authorization, and organizational hierarchy. Defines who can do what, which building/service they belong to, and who the physical recipients of resources are.

---

#### MODEL: Role

**Purpose:** Named role that determines a user's access level.

| Column        | Type            | Constraints                          | Notes                                        |
|---------------|-----------------|--------------------------------------|----------------------------------------------|
| `id_role`     | AutoField (PK)  | PRIMARY KEY                          |                                              |
| `nom_role`    | CharField(100)  | UNIQUE, choices                      | `service_financiere \| gestionnaire_magasin \| chef_service \| admin` |
| `description` | TextField       | blank=True                           |                                              |

**Timestamps:** None  
**Soft delete:** No  
**Relationships:** → `RolePermission` (1:N), ← `Utilisateur` (N:1)

---

#### MODEL: Permission

**Purpose:** Granular capability declaration at `module × action` level.

| Column        | Type           | Constraints                        | Notes               |
|---------------|----------------|------------------------------------|---------------------|
| `id_permission` | AutoField (PK) | PRIMARY KEY                      |                     |
| `module`      | CharField(100) | unique_together(module, action)   |                     |
| `action`      | CharField(100) | unique_together(module, action)   |                     |
| `description` | TextField      | blank=True                        |                     |

**Timestamps:** None  
**Soft delete:** No  
**Relationships:** → `RolePermission` (1:N)

---

#### MODEL: RolePermission

**Purpose:** Many-to-many junction between Role and Permission with an `accorde` flag.

| Column          | Type          | Constraints                          | Notes              |
|-----------------|---------------|--------------------------------------|--------------------|
| `id`            | AutoField (PK)| Django auto-PK (no custom `id_*`)   | ⚠ inconsistency    |
| `id_role`       | FK → Role     | CASCADE, unique_together             |                    |
| `id_permission` | FK → Permission | CASCADE, unique_together           |                    |
| `accorde`       | BooleanField  | default=True                         |                    |

**Timestamps:** None  
**Soft delete:** No  
**Note:** The `accorde=False` row pattern enables explicit deny — but this is never checked in any view (permissions appear unused in runtime authorization logic).

---

#### MODEL: Etablissement

**Purpose:** Top-level physical location (institution/campus).

| Column           | Type           | Constraints | Notes |
|------------------|----------------|-------------|-------|
| `id_etablissement` | AutoField (PK) | PRIMARY KEY |     |
| `nom`            | CharField(200) | UNIQUE      |       |

**Timestamps:** None  
**Soft delete:** No

---

#### MODEL: Batiment

**Purpose:** Building within an establishment.

| Column             | Type           | Constraints                          | Notes |
|--------------------|----------------|--------------------------------------|-------|
| `id_batiment`      | AutoField (PK) | PRIMARY KEY                          |       |
| `nom`              | CharField(200) | unique_together(nom, id_etablissement)|      |
| `id_etablissement` | FK → Etablissement | CASCADE, related_name=batiments  |       |

**Timestamps:** None  
**Soft delete:** No

---

#### MODEL: Service

**Purpose:** Administrative or functional department. Requests and beneficiaries are scoped to a service.

| Column                    | Type           | Constraints                 | Notes                                      |
|---------------------------|----------------|-----------------------------|--------------------------------------------|
| `id_service`              | AutoField (PK) | PRIMARY KEY                 |                                            |
| `nom_service`             | CharField(200) |                             | ⚠ no UNIQUE constraint                    |
| `type_service`            | CharField(100) | choices                     | `administratif\|chu\|decanat\|pharmacie\|dentaire\|labo\|association` |
| `description`             | TextField      | blank=True                  |                                            |
| `lettre_nomination_chef`  | FileField      | upload_to=services/nominations/ blank/null |                           |
| `id_batiment`             | FK → Batiment  | SET_NULL, null/blank        |                                            |

**Timestamps:** None  
**Soft delete:** No

---

#### MODEL: Beneficiaire

**Purpose:** Physical person or room that receives resources (end recipient on décharge).

| Column           | Type           | Constraints        | Notes                                                               |
|------------------|----------------|--------------------|---------------------------------------------------------------------|
| `id_beneficiaire`| AutoField (PK) | PRIMARY KEY        |                                                                     |
| `nom`            | CharField(200) |                    |                                                                     |
| `role_type`      | CharField(30)  | choices            | `chef_service\|fonctionnaire\|secretariat\|salle_de_cours\|prof\|personnel` |
| `id_service`     | FK → Service   | CASCADE, related_name=beneficiaires |                               |

**Timestamps:** None  
**Soft delete:** No

---

#### MODEL: Utilisateur

**Purpose:** System user. Custom auth model extending `AbstractBaseUser + PermissionsMixin`.

| Column           | Type              | Constraints                   | Notes                                                 |
|------------------|-------------------|-------------------------------|-------------------------------------------------------|
| `id_utilisateur` | AutoField (PK)    | PRIMARY KEY, AUTH_USER_MODEL PK|                                                      |
| `nom_complet`    | CharField(200)    |                               |                                                       |
| `email`          | EmailField        | UNIQUE, USERNAME_FIELD        |                                                       |
| `actif`          | BooleanField      | default=True                  | Mapped to `is_active` property                        |
| `is_staff`       | BooleanField      | default=False                 | Django admin access                                   |
| `titre_poste`    | CharField(100)    | blank=True                    |                                                       |
| `date_creation`  | DateTimeField     | auto_now_add=True             |                                                       |
| `id_role`        | FK → Role         | SET_NULL, null/blank          |                                                       |
| `id_service`     | FK → Service      | SET_NULL, null/blank          |                                                       |

**Timestamps:** `date_creation` (create only)  
**Soft delete:** No (uses `actif` flag)  
**Properties:** `is_gestionnaire`, `is_chef_service`, `is_financiere`, `is_fournisseur`, `is_admin`  
**⚠ Issue:** `is_fournisseur` checks `"fournisseur"` role — this value is **not** in `Role.ROLE_CHOICES`. Dead code.

---

#### MODEL: Fournisseur

**Purpose:** Supplier profile, optionally linked to a user account.

| Column              | Type              | Constraints                   | Notes                             |
|---------------------|-------------------|-------------------------------|-----------------------------------|
| `id_fournisseur`    | AutoField (PK)    | PRIMARY KEY                   |                                   |
| `nom_societe`       | CharField(255)    |                               |                                   |
| `nom_responsable`   | CharField(200)    |                               |                                   |
| `email`             | EmailField        |                               | ⚠ not UNIQUE                     |
| `telephone`         | CharField(20)     | blank=True                    |                                   |
| `adresse`           | TextField         | blank=True                    |                                   |
| `evaluation`        | DecimalField(3,2) | null/blank                    | Rating (presumably 0.00–9.99)     |
| `id_utilisateur`    | OneToOne → Utilisateur | SET_NULL, null/blank    | Optional user account link        |

**Timestamps:** None  
**Soft delete:** No

---

### 2.2 resources

**Business purpose:** Catalog and inventory management. Separates consumables (tracked by quantity via `Stock`) from inventory items (tracked individually via `InstanceRessource`). Movement history is logged in `MouvementStock`.

---

#### MODEL: TypeArticle

**Purpose:** Top-level article type: `consommable` or `bien_inventaire`.

| Column          | Type           | Constraints   | Notes                                              |
|-----------------|----------------|---------------|----------------------------------------------------|
| `id_categorie`  | AutoField (PK) | PRIMARY KEY   | ⚠ PK name `id_categorie` on a TypeArticle — misleading |
| `nom_categorie` | CharField(200) | choices       | `consommable \| bien_inventaire`                   |
| `description`   | TextField      | blank=True    |                                                    |
| `actif`         | BooleanField   | default=True  |                                                    |

**Timestamps:** None  
**Soft delete:** `actif` flag (not enforced in queries)  
**⚠ Issue:** PK field named `id_categorie` belongs to a model named `TypeArticle`. FK from `StagingItem` named `id_categorie_suggeree` points to this model, compounding the confusion.

---

#### MODEL: Categorie

**Purpose:** Category within a type (e.g., "Papeterie" under Consommable).

| Column              | Type           | Constraints                | Notes |
|---------------------|----------------|----------------------------|-------|
| `id_categorie`      | AutoField (PK) | PRIMARY KEY                |       |
| `nom_categorie`     | CharField(200) |                            |       |
| `description`       | TextField      | blank=True                 |       |
| `actif`             | BooleanField   | default=True               |       |
| `id_type`           | FK → TypeArticle | CASCADE                  |       |
| `date_mise_a_jour`  | DateTimeField  | auto_now=True              |       |

**Timestamps:** `date_mise_a_jour` (update only, no create timestamp)  
**Soft delete:** `actif` flag

---

#### MODEL: SousCategorie

**Purpose:** Sub-category under a category.

| Column                | Type           | Constraints            | Notes |
|-----------------------|----------------|------------------------|-------|
| `id_sous_categorie`   | AutoField (PK) | PRIMARY KEY            |       |
| `nom_sous_categorie`  | CharField(200) |                        |       |
| `description`         | TextField      | blank=True             |       |
| `id_categorie`        | FK → Categorie | CASCADE                |       |

**Timestamps:** None  
**Soft delete:** No

---

#### MODEL: Ressource

**Purpose:** Article definition (the "what"). Type determines whether inventory is tracked by Stock or InstanceRessource.

| Column              | Type           | Constraints              | Notes                                        |
|---------------------|----------------|--------------------------|----------------------------------------------|
| `id_ressource`      | AutoField (PK) | PRIMARY KEY              |                                              |
| `designation`       | CharField(255) |                          |                                              |
| `marque`            | CharField(100) | blank, default=""        |                                              |
| `description`       | TextField      | blank=True               |                                              |
| `unite_mesure`      | CharField(20)  | default="unité"          |                                              |
| `seuil_alerte`      | IntegerField   | null/blank, default=None | ⚠ duplicated in `Stock.seuil_alerte`        |
| `id_type`           | FK → TypeArticle | CASCADE                |                                              |
| `id_categorie`      | FK → Categorie | SET_NULL, null/blank     |                                              |
| `id_sous_categorie` | FK → SousCategorie | SET_NULL, null/blank |                                              |

**Timestamps:** None  
**Soft delete:** No  
**Properties:** `is_consommable`, `is_bien_inventaire`, `est_en_alerte`

---

#### MODEL: Stock

**Purpose:** Current quantity ledger for consumable resources.

| Column                 | Type          | Constraints               | Notes                                         |
|------------------------|---------------|---------------------------|-----------------------------------------------|
| `id_stock`             | AutoField (PK)| PRIMARY KEY               |                                               |
| `id_ressource`         | OneToOne → Ressource | CASCADE            | Enforced consommable-only in `clean()`        |
| `quantite_disponible`  | IntegerField  | default=0                 |                                               |
| `quantite_reservee`    | IntegerField  | default=0                 |                                               |
| `seuil_alerte`         | IntegerField  | null/blank, default=None  | ⚠ duplicated from `Ressource.seuil_alerte`   |
| `date_mise_a_jour`     | DateTimeField | auto_now=True             |                                               |

**Timestamps:** `date_mise_a_jour` (update only)  
**Properties:** `quantite_reelle` = `disponible - reservee`, `est_en_alerte`

---

#### MODEL: InstanceRessource

**Purpose:** Individual physical item for inventory-type resources. One row per unit, with lifecycle status.

| Column                       | Type           | Constraints                      | Notes                                          |
|------------------------------|----------------|----------------------------------|------------------------------------------------|
| `id_instance`                | AutoField (PK) | PRIMARY KEY                      |                                                |
| `numero_inventaire`          | CharField(50)  | UNIQUE, blank=True               | Auto-generated `INV-{YYYY}-{XXXX}` if omitted  |
| `date_acquisition`           | DateField      | null/blank                       |                                                |
| `valeur_acquisition`         | DecimalField(10,2) | null/blank                  |                                                |
| `statut`                     | CharField(50)  | choices, db_index, default=en_stock | `en_stock\|en_service\|en_maintenance\|debarras` |
| `etat`                       | CharField(50)  | choices, db_index, default=neuf  | `neuf\|bon_etat\|endommage\|hors_service\|retourne` |
| `date_derniere_affectation`  | DateField      | null/blank                       |                                                |
| `observation`                | TextField      | blank=True                       |                                                |
| `type_affectation`           | CharField(30)  | choices, blank, default=""       | `nouvelle_affectation\|reaffectation`          |
| `id_ressource`               | FK → Ressource | CASCADE                          | Enforced bien_inventaire-only in `clean()`     |
| `id_lieu_affectation`        | FK → Etablissement | SET_NULL, null/blank         |                                                |
| `id_service_actuel`          | FK → Service   | SET_NULL, null/blank             |                                                |
| `id_destinataire`            | FK → Beneficiaire | SET_NULL, null/blank          |                                                |
| `id_lot`                     | FK → LotArticle | SET_NULL, null/blank            | Traceability back to procurement lot           |

**Timestamps:** `date_derniere_affectation` (manual), `date_acquisition` (manual)  
**Soft delete:** No (uses `statut=debarras`)

---

#### MODEL: MouvementStock

**Purpose:** Append-only ledger of all quantity movements for audit and reconstruction.

| Column                  | Type              | Constraints               | Notes                                              |
|-------------------------|-------------------|---------------------------|----------------------------------------------------|
| `id_mouvement`          | AutoField (PK)    | PRIMARY KEY               |                                                    |
| `type_mouvement`        | CharField(50)     | choices                   | `entree\|sortie\|retour\|transfert\|rebut`         |
| `quantite`              | IntegerField      |                           | ⚠ no PositiveIntegerField constraint              |
| `date_mouvement`        | DateTimeField     | auto_now_add=True         |                                                    |
| `observation`           | TextField         | blank=True                |                                                    |
| `content_type`          | FK → ContentType  | SET_NULL, null/blank      | GenericFK source: part 1                           |
| `object_id`             | PositiveIntegerField | null/blank             | GenericFK source: part 2                           |
| `source`                | GenericForeignKey | content_type + object_id  | Polymorphic: which object triggered the movement   |
| `id_ressource`          | FK → Ressource    | CASCADE                   |                                                    |
| `id_instance_ressource` | FK → InstanceRessource | SET_NULL, null/blank | Only for bien_inventaire movements                |
| `id_utilisateur`        | FK → Utilisateur  | SET_NULL, null/blank      |                                                    |

**Timestamps:** `date_mouvement` (create only, auto)  
**Soft delete:** N/A — append-only log

---

### 2.3 procurement

**Business purpose:** Manages procurement contracts (marchés), purchase orders (bons de commande), and donations from creation to warehouse reception. Includes an AI-assisted import pipeline (Excel/PDF → staging → validation → resources).

---

#### MODEL: MarcheBC

**Purpose:** Master procurement record — marché, bon de commande, or donation.

| Column                  | Type           | Constraints                     | Notes                                                       |
|-------------------------|----------------|---------------------------------|-------------------------------------------------------------|
| `id_marche`             | AutoField (PK) | PRIMARY KEY                     |                                                             |
| `reference`             | CharField(100) | UNIQUE                          |                                                             |
| `type_acquisition`      | CharField(20)  | choices                         | `marche\|bon_commande\|donation`                            |
| `source`                | CharField(10)  | choices, db_index, default=manuel | `manuel\|import`                                          |
| `date_creation`         | DateField      | auto_now_add=True               |                                                             |
| `date_attribution`      | DateField      | null/blank                      |                                                             |
| `marque`                | CharField(255) | blank, default=""               |                                                             |
| `comite_conformite`     | TextField      | blank, default=""               |                                                             |
| `delai_reception_jours` | IntegerField   | null/blank                      | Auto-set: marche=90, donation=0, bon_commande=manual        |
| `date_livraison_prevue` | DateField      | null/blank                      | Computed from `date_attribution + delai_reception_jours`    |
| `statut`                | CharField(30)  | choices, db_index               | `en_attente_livraison\|receptionne_et_stocke\|refuse`       |
| `motif_rejet`           | TextField      | blank, default=""               |                                                             |
| `fichier_cps`           | FileField      | upload_to=marches/cps/ blank/null |                                                           |
| `type_donateur`         | CharField(50)  | blank, default=""               | Donation-specific                                           |
| `nom_donateur`          | CharField(255) | blank, default=""               | Donation-specific                                           |
| `organisme_donateur`    | CharField(255) | blank, default=""               | Donation-specific                                           |
| `contact_donateur`      | CharField(255) | blank, default=""               | Donation-specific                                           |
| `id_fournisseur`        | FK → Fournisseur | SET_NULL, null/blank          |                                                             |
| `id_cree_par`           | FK → Utilisateur | SET_NULL, null/blank          |                                                             |

**Timestamps:** `date_creation` (create only)  
**Soft delete:** No  
**Business logic in `save()`:** Computes `delai_reception_jours` and `date_livraison_prevue`; creates default `MarcheEtape` rows on first save.  
**⚠ Issue:** Donation fields (`type_donateur`, `nom_donateur`, etc.) are stored on the same table as marché fields — wide table with conditionally relevant columns. No DB-level enforcement that these are null for non-donations.

---

#### MODEL: MarcheEtape

**Purpose:** Ordered workflow step within a procurement process.

| Column          | Type           | Constraints                         | Notes                                                     |
|-----------------|----------------|-------------------------------------|-----------------------------------------------------------|
| `id_etape`      | AutoField (PK) | PRIMARY KEY                         |                                                           |
| `ordre`         | IntegerField   | MinValue(1), MaxValue(10)           |                                                           |
| `nom_etape`     | CharField(30)  | choices                             | `marche_cree\|contrat_signe\|en_attente_livraison\|livraison_en_cours\|receptionne_magasin\|controle_qualite\|bl_valide\|stocker_au_magasin\|paiement_en_cours\|paiement_effectue` |
| `statut`        | CharField(20)  | choices, default=en_attente         | `en_attente\|en_cours\|complete\|bloque`                  |
| `date_debut`    | DateTimeField  | null/blank                          |                                                           |
| `date_fin`      | DateTimeField  | null/blank                          |                                                           |
| `commentaire`   | TextField      | blank=True                          |                                                           |
| `id_marche`     | FK → MarcheBC  | CASCADE, related_name=etapes        |                                                           |
| `id_modifie_par`| FK → Utilisateur | SET_NULL, null/blank              |                                                           |

**Timestamps:** `date_debut`, `date_fin` (manual)  
**Ordering:** `Meta.ordering = ["ordre"]`  
**Note:** `create_default_etapes()` creates steps 1–7 automatically; steps 8–10 (`stocker_au_magasin`, `paiement_en_cours`, `paiement_effectue`) exist in `NOM_ETAPE_CHOICES` but are never auto-created.

---

#### MODEL: ImportExcelBC

**Purpose:** Tracks an uploaded Excel/PDF file associated with a marché during the AI-extraction import pipeline.

| Column                     | Type           | Constraints                     | Notes                                         |
|----------------------------|----------------|---------------------------------|-----------------------------------------------|
| `id_import`                | AutoField (PK) | PRIMARY KEY                     |                                               |
| `fichier_excel_original`   | FileField      | upload_to=marches/uploads/      |                                               |
| `titre_fichier`            | CharField(255) | blank, default=""               |                                               |
| `date_import`              | DateTimeField  | auto_now_add=True               |                                               |
| `reference_document`       | CharField(150) | blank, default=""               |                                               |
| `fournisseur_denomination` | CharField(255) | blank, default=""               | ⚠ denormalized — duplicates `Fournisseur` data |
| `fournisseur_telephone`    | CharField(50)  | blank, default=""               | ⚠ denormalized                               |
| `fournisseur_email`        | EmailField     | blank, default=""               | ⚠ denormalized                               |
| `fournisseur_adresse`      | TextField      | blank, default=""               | ⚠ denormalized                               |
| `delai_execution`          | CharField(255) | blank, default=""               |                                               |
| `statut_import`            | CharField(20)  | choices, db_index               | `en_attente\|brouillon\|en_revision\|valide\|non_conforme\|autre\|rejete` |
| `file_type`                | CharField(10)  | choices, default=xlsx           | `xlsx\|pdf`                                   |
| `source_type`              | CharField(20)  | choices                         | `bc\|marche\|donation`                        |
| `observations`             | TextField      | blank=True                      |                                               |
| `id_marche`                | OneToOne → MarcheBC | CASCADE, related_name=import_excel | One import per marché             |
| `id_importe_par`           | FK → Utilisateur | SET_NULL, null/blank           |                                               |

**Timestamps:** `date_import` (create only)

---

#### MODEL: StagingItem

**Purpose:** Intermediate row extracted from an import file, pending gestionnaire review and approval before becoming a `Ressource`.

| Column                    | Type              | Constraints              | Notes                                                        |
|---------------------------|-------------------|--------------------------|--------------------------------------------------------------|
| `id_staging`              | AutoField (PK)    | PRIMARY KEY              |                                                              |
| `designation_brute`       | CharField(500)    |                          | Raw text from file                                           |
| `description`             | TextField         | blank, default=""        |                                                              |
| `designation_normalisee`  | CharField(255)    | blank=True               | AI-normalized                                                |
| `quantite`                | IntegerField      | default=0                |                                                              |
| `type_detecte`            | CharField(20)     | choices, blank           | `consommable\|bien_inventaire`                               |
| `statut`                  | CharField(20)     | choices, db_index        | `en_attente\|approuve\|rejete\|modifie`                      |
| `correction_gestionnaire` | TextField         | blank=True               |                                                              |
| `motif_rejet`             | CharField(255)    | blank, default=""        |                                                              |
| `commentaire_rejet`       | TextField         | blank, default=""        |                                                              |
| `prix_unitaire_ht`        | DecimalField(12,2)| null/blank               |                                                              |
| `prix_total_ht`           | DecimalField(12,2)| null/blank               |                                                              |
| `unite`                   | CharField(20)     | blank, default="U"       |                                                              |
| `id_import`               | FK → ImportExcelBC | CASCADE, related_name=staging_items |                                              |
| `id_categorie_suggeree`   | FK → TypeArticle  | SET_NULL, null/blank     | ⚠ FK name implies Categorie but points to TypeArticle        |
| `id_sous_categorie_suggeree` | FK → SousCategorie | SET_NULL, null/blank |                                                              |
| `id_ressource_liee`       | FK → Ressource    | SET_NULL, null/blank     | Populated on approval                                        |

**Timestamps:** None  
**Properties:** `needs_review` = `statut == "en_attente"`

---

#### MODEL: LotArticle

**Purpose:** Line item within a marché/bon de commande: a quantity of a resource ordered/received.

| Column               | Type           | Constraints                      | Notes                                      |
|----------------------|----------------|----------------------------------|--------------------------------------------|
| `id_lot`             | AutoField (PK) | PRIMARY KEY                      |                                            |
| `numero_lot`         | IntegerField   | unique_together(id_marche, numero_lot) |                                       |
| `designation`        | CharField(255) |                                  |                                            |
| `quantite_commandee` | IntegerField   |                                  |                                            |
| `quantite_recue`     | IntegerField   | default=0                        |                                            |
| `observation`        | TextField      | blank=True                       |                                            |
| `id_marche`          | FK → MarcheBC  | CASCADE, related_name=lots       |                                            |
| `id_ressource`       | FK → Ressource | CASCADE                          |                                            |

**Timestamps:** None  
**Note:** `quantite_recue` is a running total. Individual received instances link back via `InstanceRessource.id_lot`, but there's no automatic synchronization between the two.

---

### 2.4 requests

**Business purpose:** Manages the full lifecycle of a resource request from a chef de service: creation, gestionnaire review, and final decision (traite / refuse / en_instance).

---

#### MODEL: Demande

**Purpose:** A resource request submitted by a chef de service.

| Column                     | Type           | Constraints                | Notes                                                            |
|----------------------------|----------------|----------------------------|------------------------------------------------------------------|
| `id_demande`               | AutoField (PK) | PRIMARY KEY                |                                                                  |
| `numero`                   | CharField(30)  | UNIQUE, null/blank         | Auto-generated `DEM-{YYYY}-{NNNN}` on first save                 |
| `date_demande`             | DateTimeField  | auto_now_add, db_index     |                                                                  |
| `urgence`                  | CharField(10)  | choices, default=normal    | `normal\|moyen\|urgent`                                          |
| `statut`                   | CharField(30)  | choices, db_index          | `en_cours\|traite\|en_instance\|refuse`                          |
| `type_demandeur`           | CharField(30)  | default="chef_service"     | ⚠ free text, not FK-backed                                      |
| `beneficiaire_type`        | CharField(30)  | default="service"          | ⚠ free text, denormalized                                       |
| `beneficiaire_nom`         | CharField(200) | blank=True                 | ⚠ denormalized name                                             |
| `beneficiaire_detail`      | TextField      | blank=True                 |                                                                  |
| `justification`            | TextField      | blank=True                 |                                                                  |
| `date_validation`          | DateTimeField  | null/blank                 |                                                                  |
| `commentaire_validation`   | TextField      | blank=True                 |                                                                  |
| `motif_refus`              | TextField      | blank=True                 |                                                                  |
| `id_chef_demandeur`        | FK → Utilisateur | CASCADE, related_name=demandes_soumises |                                                 |
| `id_service`               | FK → Service   | CASCADE                    |                                                                  |
| `id_beneficiaire`          | FK → Beneficiaire | SET_NULL, null/blank    | Structured recipient link                                        |
| `id_valide_par`            | FK → Utilisateur | SET_NULL, null/blank, related_name=demandes_validees |                                     |

**Timestamps:** `date_demande` (create), `date_validation` (manual)  
**Soft delete:** No  
**⚠ Issue:** `beneficiaire_nom`, `beneficiaire_type`, `beneficiaire_detail` are denormalized text fields that coexist with the FK `id_beneficiaire`. No single source of truth for beneficiaire data.  
**⚠ Issue:** `numero` auto-generation in `save()` is not atomic — concurrent inserts can collide.

---

#### MODEL: LigneDemande

**Purpose:** One resource line within a request. Tracks requested, accorded, and delivered quantities.

| Column               | Type           | Constraints                         | Notes |
|----------------------|----------------|-------------------------------------|-------|
| `id_ligne`           | AutoField (PK) | PRIMARY KEY                         |       |
| `quantite_demandee`  | IntegerField   |                                     |       |
| `quantite_accordee`  | IntegerField   | default=0                           |       |
| `quantite_livree`    | IntegerField   | default=0                           |       |
| `observation`        | TextField      | blank=True                          |       |
| `id_demande`         | FK → Demande   | CASCADE, related_name=lignes        |       |
| `id_ressource`       | FK → Ressource | CASCADE                             |       |

**Timestamps:** None  
**⚠ Issue:** No `updated_at` — impossible to know when a quantity was changed without an audit log.

---

### 2.5 decharge

**Business purpose:** A décharge is the formal delivery receipt generated once a demand is approved. It requires a physical signature from the chef de service before the delivery is considered complete.

---

#### MODEL: Decharge

**Purpose:** Delivery document linking one approved demand to its physical delivery.

| Column              | Type             | Constraints                          | Notes                                          |
|---------------------|------------------|--------------------------------------|------------------------------------------------|
| `id_decharge`       | AutoField (PK)   | PRIMARY KEY                          |                                                |
| `numero_decharge`   | CharField(50)    | UNIQUE                               | Auto-generated `DCH-{YYYY}-{NNNN}` on first save |
| `date_generation`   | DateTimeField    | auto_now_add=True                    |                                                |
| `date_livraison`    | DateField        | null/blank                           | Physical delivery date                         |
| `fichier_pdf`       | FileField        | upload_to=decharges/pdf/ null/blank  | Generated PDF                                  |
| `observation`       | TextField        | blank=True                           |                                                |
| `id_demande`        | OneToOne → Demande | CASCADE, related_name=decharge     | One décharge per demande                       |
| `id_genere_par`     | FK → Utilisateur | SET_NULL, null/blank, related_name=decharges_generees |                              |
| `id_livre_a`        | FK → Utilisateur | SET_NULL, null/blank, related_name=decharges_livrees  |                              |

**Timestamps:** `date_generation` (create only), `date_livraison` (manual)  
**Soft delete:** No  
**Properties:** `statut_signature` → reads from related `SignatureDecharge.statut`  
**⚠ Issue:** Sequential `numero_decharge` generation in `save()` is not atomic.

---

#### MODEL: LigneDecharge

**Purpose:** One resource line on the delivery document; references either a stock quantity (consommable) or a specific instance (bien_inventaire).

| Column                  | Type              | Constraints                        | Notes                                                |
|-------------------------|-------------------|------------------------------------|------------------------------------------------------|
| `id_ligne_decharge`     | AutoField (PK)    | PRIMARY KEY                        |                                                      |
| `quantite`              | IntegerField      |                                    |                                                      |
| `type_ligne`            | CharField(20)     | choices                            | `bien_inventaire\|consommable`                       |
| `observation`           | TextField         | blank=True                         |                                                      |
| `id_decharge`           | FK → Decharge     | CASCADE, related_name=lignes       |                                                      |
| `id_ressource`          | FK → Ressource    | CASCADE                            |                                                      |
| `id_instance_ressource` | FK → InstanceRessource | SET_NULL, null/blank          | Required if `bien_inventaire`, must be null if `consommable` |

**DB Constraint:** `CHECK (type_ligne='bien_inventaire' AND id_instance_ressource IS NOT NULL) OR (type_ligne='consommable' AND id_instance_ressource IS NULL)`  
**Validation:** Also enforced in `clean()` at application level.  
**Timestamps:** None

---

#### MODEL: SignatureDecharge

**Purpose:** Records the physical signature lifecycle of a décharge document.

| Column                      | Type           | Constraints                          | Notes                             |
|-----------------------------|----------------|--------------------------------------|-----------------------------------|
| `id_signature`              | AutoField (PK) | PRIMARY KEY                          |                                   |
| `date_signature`            | DateTimeField  | null/blank                           |                                   |
| `statut`                    | CharField(20)  | choices, default=non_signe           | `non_signe\|signe`                |
| `date_validation_systeme`   | DateTimeField  | null/blank                           |                                   |
| `id_decharge`               | OneToOne → Decharge | CASCADE, related_name=signature | One signature record per décharge |
| `id_chef_service`           | FK → Utilisateur | SET_NULL, null/blank, related_name=signatures_soumises |          |
| `id_valide_par`             | FK → Utilisateur | SET_NULL, null/blank, related_name=signatures_validees |          |

**Timestamps:** `date_signature` (manual), `date_validation_systeme` (manual)  
**Note:** Two-step workflow: chef signs (`date_signature`), gestionnaire validates (`date_validation_systeme`).

---

### 2.6 returns

**Business purpose:** Tracks physical items returned to the warehouse (due to breakdown, non-use, damage) and records the gestionnaire's decision on what to do with the returned item.

---

#### MODEL: RetourMateriel

**Purpose:** Return request for a resource instance.

| Column                    | Type           | Constraints              | Notes                                                        |
|---------------------------|----------------|--------------------------|--------------------------------------------------------------|
| `id_retour`               | AutoField (PK) | PRIMARY KEY              |                                                              |
| `date_retour`             | DateField      | auto_now_add=True        |                                                              |
| `motif_retour`            | CharField(20)  | choices                  | `panne\|inutilise\|endommage\|autre`                         |
| `statut`                  | CharField(20)  | choices, db_index        | `en_attente\|receptionne`                                    |
| `date_reception`          | DateTimeField  | null/blank               |                                                              |
| `decision`                | CharField(20)  | choices, blank, default=""| `hors_service\|en_stock\|repare\|debarras\|reaffecte`        |
| `justification_decision`  | TextField      | blank=True               |                                                              |
| `observation`             | TextField      | blank=True               |                                                              |
| `id_ressource`            | FK → Ressource | CASCADE                  |                                                              |
| `id_instance_ressource`   | FK → InstanceRessource | SET_NULL, null/blank |                                                         |
| `id_retourne_par`         | FK → Utilisateur | SET_NULL, null/blank, related_name=retours_soumis |                   |
| `id_traite_par`           | FK → Utilisateur | SET_NULL, null/blank, related_name=retours_traites |                  |

**Timestamps:** `date_retour` (create only), `date_reception` (manual)  
**Soft delete:** No  
**⚠ Issue:** No FK to `Decharge` or `LigneDecharge` — cannot trace a return to the original delivery document.

---

### 2.7 alerts

**Business purpose:** Provides proactive notifications for deadline breaches (procurement), cross-module workflow events (demands, signatures, imports), and an audit trail of all data mutations.

---

#### MODEL: AlerteDelai

**Purpose:** Time-based deadline alert attached to a procurement record.

| Column                | Type           | Constraints                | Notes                                  |
|-----------------------|----------------|----------------------------|----------------------------------------|
| `id_alerte`           | AutoField (PK) | PRIMARY KEY                |                                        |
| `date_echeance`       | DateField      |                            |                                        |
| `niveau_alerte`       | CharField(20)  | choices                    | `info\|warning\|critique`              |
| `date_alerte`         | DateTimeField  | auto_now_add=True          |                                        |
| `penalite_applicable` | BooleanField   | default=False              |                                        |
| `acquitte`            | BooleanField   | default=False              |                                        |
| `id_marche`           | FK → MarcheBC  | CASCADE, related_name=alertes |                                     |

**Timestamps:** `date_alerte` (create only)  
**Properties:** `jours_restants` = `date_echeance - today()`

---

#### MODEL: Notification

**Purpose:** In-app notification for a user, tied to a workflow event type.

| Column            | Type           | Constraints                | Notes                                                        |
|-------------------|----------------|----------------------------|--------------------------------------------------------------|
| `id_notification` | AutoField (PK) | PRIMARY KEY                |                                                              |
| `destinataire`    | FK → Utilisateur | CASCADE, related_name=notifications |                                                  |
| `type`            | CharField(30)  | choices, db_index          | `demande_soumise\|demande_validee\|...` (8 types)            |
| `niveau`          | CharField(20)  | choices                    | `info\|success\|warning\|danger`                             |
| `message`         | CharField(500) |                            |                                                              |
| `lien`            | CharField(500) | blank/null                 | Frontend navigation URL                                      |
| `lu`              | BooleanField   | default=False, db_index    |                                                              |
| `created_at`      | DateTimeField  | auto_now_add, db_index     |                                                              |
| `objet_id`        | IntegerField   | null/blank                 | ⚠ orphaned partial polymorphic — no `content_type` FK       |

**Timestamps:** `created_at` (create only)  
**Ordering:** `-created_at`  
**⚠ Issue:** `objet_id` stores a PK of some related object, but without a `content_type` FK the model type cannot be determined programmatically. This is an incomplete GenericFK implementation.

---

#### MODEL: JournalAudit

**Purpose:** Append-only audit log recording what changed, on which record, by whom.

| Column                       | Type              | Constraints              | Notes                                              |
|------------------------------|-------------------|--------------------------|----------------------------------------------------|
| `id_log`                     | AutoField (PK)    | PRIMARY KEY              |                                                    |
| `type_action`                | CharField(100)    |                          |                                                    |
| `table_cible`                | CharField(100)    |                          | Table name as string                               |
| `id_enregistrement_cible`    | IntegerField      |                          | ⚠ raw PK, no FK — cannot JOIN without string match |
| `ancienne_valeur`            | TextField         | blank=True               | Typically JSON-serialized                          |
| `nouvelle_valeur`            | TextField         | blank=True               | Typically JSON-serialized                          |
| `date_action`                | DateTimeField     | auto_now_add=True        |                                                    |
| `adresse_ip`                 | GenericIPAddressField | null/blank            |                                                    |
| `user_agent`                 | CharField(500)    | blank=True               |                                                    |
| `id_utilisateur`             | FK → Utilisateur  | SET_NULL, null/blank     |                                                    |

**Timestamps:** `date_action` (create only)

---

## 3. Relationship Map (ERD)

```
USERS MODULE
┌──────────────┐     ┌─────────────────┐     ┌────────────────┐
│ Etablissement│1──N─│    Batiment      │1──N─│    Service     │
└──────────────┘     └─────────────────┘     └───────┬────────┘
                                                      │1
                                         ┌────────────┴────────────┐
                                         │N                        │N
                                   ┌─────┴──────┐          ┌───────┴───────┐
                                   │Beneficiaire│          │  Utilisateur  │
                                   └────────────┘          └───────┬───────┘
                                                                   │N
                                                            ┌──────┴──────┐
                                                            │    Role     │
                                                            └──────┬──────┘
                                                                   │1
                                                            ┌──────┴──────┐
                                                            │RolePermission│N──1─┐
                                                            └─────────────┘     │
                                                                         ┌──────┴──────┐
                                                                         │ Permission  │
                                                                         └─────────────┘

RESOURCES MODULE
┌────────────┐1──N─┌──────────┐1──N─┌─────────────┐
│ TypeArticle│     │Categorie │     │SousCategorie│
└──────┬─────┘     └────┬─────┘     └──────┬──────┘
       │1               │1                  │1
       │N               │N(opt)             │N(opt)
       └──────────┬─────┘                  │
              ┌───┴────┐                   │
              │Ressource│◄──────────────────┘
              └────┬───┘
           ┌───────┼───────────────────────┐
           │1:1    │1:N                    │1:N
    ┌──────┴───┐  ┌┴───────────────┐  ┌───┴──────────┐
    │  Stock   │  │InstanceRessource│  │MouvementStock│
    └──────────┘  └────────────────┘  └──────────────┘

PROCUREMENT MODULE
┌──────────┐1──1─┌─────────────┐1──N─┌────────────┐
│ MarcheBC │     │ImportExcelBC│     │StagingItem │
└────┬─────┘     └─────────────┘     └────────────┘
     │1
     ├──N─┌──────────────┐
     │    │  MarcheEtape │
     │    └──────────────┘
     └──N─┌──────────────┐
          │  LotArticle  │──N──1─ Ressource
          └──────────────┘
                │1
                │N
          InstanceRessource (via id_lot)

REQUESTS MODULE
┌──────────┐1──N─┌─────────────┐
│ Demande  │     │LigneDemande │──N──1─ Ressource
└────┬─────┘     └─────────────┘
     │1
     │1:1
┌────┴─────┐

DECHARGE MODULE
┌──────────┐1──1─┌──────────────────┐1──1─┌──────────────────┐
│ Decharge │     │SignatureDecharge  │     │    Demande       │
└────┬─────┘     └──────────────────┘     └──────────────────┘
     │1
     └──N─┌───────────────┐
          │ LigneDecharge │──N──1─ Ressource
          └───────┬───────┘──N──1─ InstanceRessource (if bien_inventaire)
                  
RETURNS MODULE
┌────────────────┐──N──1─ Ressource
│ RetourMateriel │──N──1─ InstanceRessource
└────────────────┘

ALERTS MODULE
┌─────────────┐──N──1─ MarcheBC
│ AlerteDelai │
└─────────────┘
┌──────────────┐──N──1─ Utilisateur
│ Notification │
└──────────────┘
┌─────────────┐──N──1─ Utilisateur
│ JournalAudit│
└─────────────┘
```

### Cardinality Summary

| Relationship                               | Type   |
|--------------------------------------------|--------|
| Etablissement → Batiment                   | 1 : N  |
| Batiment → Service                         | 1 : N  |
| Service → Beneficiaire                     | 1 : N  |
| Service → Utilisateur                      | 1 : N  |
| Role → Utilisateur                         | 1 : N  |
| Role → RolePermission → Permission         | N : M  |
| Utilisateur → Fournisseur                  | 1 : 1  |
| TypeArticle → Categorie                    | 1 : N  |
| Categorie → SousCategorie                  | 1 : N  |
| TypeArticle → Ressource                    | 1 : N  |
| Ressource → Stock                          | 1 : 1  |
| Ressource → InstanceRessource              | 1 : N  |
| Ressource → MouvementStock                 | 1 : N  |
| MarcheBC → ImportExcelBC                   | 1 : 1  |
| MarcheBC → MarcheEtape                     | 1 : N  |
| MarcheBC → LotArticle                      | 1 : N  |
| MarcheBC → AlerteDelai                     | 1 : N  |
| ImportExcelBC → StagingItem                | 1 : N  |
| LotArticle → InstanceRessource             | 1 : N  |
| Demande → LigneDemande                     | 1 : N  |
| Demande → Decharge                         | 1 : 1  |
| Decharge → LigneDecharge                   | 1 : N  |
| Decharge → SignatureDecharge               | 1 : 1  |
| Utilisateur → Notification                 | 1 : N  |
| Utilisateur → JournalAudit                 | 1 : N  |

---

## 4. Cross-Module FK Index

| Source Field                              | → Target                        | ON DELETE       |
|-------------------------------------------|---------------------------------|-----------------|
| `Batiment.id_etablissement`               | `users.Etablissement`           | CASCADE         |
| `Service.id_batiment`                     | `users.Batiment`                | SET_NULL        |
| `Beneficiaire.id_service`                 | `users.Service`                 | CASCADE         |
| `Utilisateur.id_role`                     | `users.Role`                    | SET_NULL        |
| `Utilisateur.id_service`                  | `users.Service`                 | SET_NULL        |
| `Fournisseur.id_utilisateur`              | `users.Utilisateur`             | SET_NULL        |
| `RolePermission.id_role`                  | `users.Role`                    | CASCADE         |
| `RolePermission.id_permission`            | `users.Permission`              | CASCADE         |
| `Categorie.id_type`                       | `resources.TypeArticle`         | CASCADE         |
| `SousCategorie.id_categorie`              | `resources.Categorie`           | CASCADE         |
| `Ressource.id_type`                       | `resources.TypeArticle`         | CASCADE         |
| `Ressource.id_categorie`                  | `resources.Categorie`           | SET_NULL        |
| `Ressource.id_sous_categorie`             | `resources.SousCategorie`       | SET_NULL        |
| `Stock.id_ressource`                      | `resources.Ressource`           | CASCADE         |
| `InstanceRessource.id_ressource`          | `resources.Ressource`           | CASCADE         |
| `InstanceRessource.id_lieu_affectation`   | `users.Etablissement`           | SET_NULL        |
| `InstanceRessource.id_service_actuel`     | `users.Service`                 | SET_NULL        |
| `InstanceRessource.id_destinataire`       | `users.Beneficiaire`            | SET_NULL        |
| `InstanceRessource.id_lot`                | `procurement.LotArticle`        | SET_NULL        |
| `MouvementStock.id_ressource`             | `resources.Ressource`           | CASCADE         |
| `MouvementStock.id_instance_ressource`    | `resources.InstanceRessource`   | SET_NULL        |
| `MouvementStock.id_utilisateur`           | `users.Utilisateur`             | SET_NULL        |
| `MarcheBC.id_fournisseur`                 | `users.Fournisseur`             | SET_NULL        |
| `MarcheBC.id_cree_par`                    | `users.Utilisateur`             | SET_NULL        |
| `MarcheEtape.id_marche`                   | `procurement.MarcheBC`          | CASCADE         |
| `MarcheEtape.id_modifie_par`              | `users.Utilisateur`             | SET_NULL        |
| `ImportExcelBC.id_marche`                 | `procurement.MarcheBC`          | CASCADE         |
| `ImportExcelBC.id_importe_par`            | `users.Utilisateur`             | SET_NULL        |
| `StagingItem.id_import`                   | `procurement.ImportExcelBC`     | CASCADE         |
| `StagingItem.id_categorie_suggeree`       | `resources.TypeArticle`         | SET_NULL        |
| `StagingItem.id_sous_categorie_suggeree`  | `resources.SousCategorie`       | SET_NULL        |
| `StagingItem.id_ressource_liee`           | `resources.Ressource`           | SET_NULL        |
| `LotArticle.id_marche`                    | `procurement.MarcheBC`          | CASCADE         |
| `LotArticle.id_ressource`                 | `resources.Ressource`           | CASCADE         |
| `Demande.id_chef_demandeur`               | `users.Utilisateur`             | CASCADE         |
| `Demande.id_service`                      | `users.Service`                 | CASCADE         |
| `Demande.id_beneficiaire`                 | `users.Beneficiaire`            | SET_NULL        |
| `Demande.id_valide_par`                   | `users.Utilisateur`             | SET_NULL        |
| `LigneDemande.id_demande`                 | `requests.Demande`              | CASCADE         |
| `LigneDemande.id_ressource`               | `resources.Ressource`           | CASCADE         |
| `Decharge.id_demande`                     | `requests.Demande`              | CASCADE         |
| `Decharge.id_genere_par`                  | `users.Utilisateur`             | SET_NULL        |
| `Decharge.id_livre_a`                     | `users.Utilisateur`             | SET_NULL        |
| `LigneDecharge.id_decharge`               | `decharge.Decharge`             | CASCADE         |
| `LigneDecharge.id_ressource`              | `resources.Ressource`           | CASCADE         |
| `LigneDecharge.id_instance_ressource`     | `resources.InstanceRessource`   | SET_NULL        |
| `SignatureDecharge.id_decharge`           | `decharge.Decharge`             | CASCADE         |
| `SignatureDecharge.id_chef_service`       | `users.Utilisateur`             | SET_NULL        |
| `SignatureDecharge.id_valide_par`         | `users.Utilisateur`             | SET_NULL        |
| `RetourMateriel.id_ressource`             | `resources.Ressource`           | CASCADE         |
| `RetourMateriel.id_instance_ressource`    | `resources.InstanceRessource`   | SET_NULL        |
| `RetourMateriel.id_retourne_par`          | `users.Utilisateur`             | SET_NULL        |
| `RetourMateriel.id_traite_par`            | `users.Utilisateur`             | SET_NULL        |
| `AlerteDelai.id_marche`                   | `procurement.MarcheBC`          | CASCADE         |
| `Notification.destinataire`               | `users.Utilisateur`             | CASCADE         |
| `JournalAudit.id_utilisateur`             | `users.Utilisateur`             | SET_NULL        |

---

## 5. Detected Issues

### CRITICAL

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **Race condition on sequential number generation** — `Demande.save()` and `Decharge.save()` use a `filter().order_by().first()` to find the last number without any DB-level lock or `SELECT FOR UPDATE`. Two concurrent inserts read the same last number and both use `seq+1`. | `requests/models.py:57–72`, `decharge/models.py:48–61` | Duplicate `numero`/`numero_decharge` under concurrent load. |
| C2 | **`Demande.id_chef_demandeur` ON DELETE CASCADE** — Deleting a user cascades to all their submitted demands, which cascade to décharges, lignes, and signatures. A single user deletion could wipe the entire request history. | `requests/models.py:36` | Irreversible data loss. |
| C3 | **`LigneDemande.id_ressource` ON DELETE CASCADE** — Deleting a resource removes all demand lines referencing it, silently corrupting historical requests. | `requests/models.py:94` | Historical data corruption. |

### HIGH

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| H1 | **Duplicate `seuil_alerte` field** — Both `Ressource.seuil_alerte` and `Stock.seuil_alerte` exist independently. `Ressource.est_en_alerte` tries to use an annotated `instances_en_stock` count (only available if annotated in a queryset), while `Stock.est_en_alerte` uses `Stock.seuil_alerte`. Two thresholds can diverge silently. | `resources/models.py:62, 107` | Alert logic inconsistency; managing two thresholds confuses operators. |
| H2 | **Beneficiaire data duplication** — `Demande` has `beneficiaire_nom`, `beneficiaire_type`, `beneficiaire_detail` (free text) alongside `id_beneficiaire` (FK). The PDF generator reads both paths. No enforcement of consistency between the FK and the text fields. | `requests/models.py:26–28, 38–44` | Inconsistent display; stale names after beneficiaire record update. |
| H3 | **`Notification.objet_id` without `content_type`** — Stores a bare integer PK with no way to determine which table it refers to. A partial `GenericForeignKey` with no resolution path. | `alerts/models.py:92` | Notification links cannot be programmatically resolved to the target object. |
| H4 | **`TypeArticle` PK named `id_categorie`** — The primary key field of `TypeArticle` is named `id_categorie`, identical to `Categorie`'s PK field. `StagingItem.id_categorie_suggeree` FK points to `TypeArticle` but its name implies `Categorie`. | `resources/models.py:13` | Developer confusion; serializers and API consumers may send the wrong FK. |
| H5 | **`RetourMateriel` has no link to original delivery** — No FK to `Decharge` or `LigneDecharge`. Cannot trace a return to its original delivery for audit or warranty purposes. | `returns/models.py` | Broken traceability chain: procurement → delivery → return. |

### MEDIUM

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | **`Utilisateur.is_fournisseur` references non-existent role** — Checks `role_name == "fournisseur"` but `"fournisseur"` is not a valid `Role.ROLE_CHOICES` value. Will always return `False`. | `users/models.py:219` | Dead property; misleads developers into thinking fournisseur is a role. |
| M2 | **Missing `updated_at` on key operational models** — `Demande`, `LigneDemande`, `Decharge`, `LigneDecharge`, `SignatureDecharge`, `RetourMateriel` have no update timestamp. | Multiple models | Cannot determine when a record last changed without scanning `JournalAudit`. |
| M3 | **`MarcheBC.save()` overwrites `date_livraison_prevue` on every save** — Any manual edit to a marché recalculates the delivery date from `date_attribution`. Intentional changes to `date_livraison_prevue` are silently overwritten. | `procurement/models.py:72–84` | Unexpected data mutation on unrelated edits. |
| M4 | **`JournalAudit.id_enregistrement_cible` is a raw `IntegerField`** — No FK or ContentType. The `table_cible` string is the only pointer to the target model. Cannot be used in ORM queries or joins. | `alerts/models.py:107` | Audit log is queryable by value only via raw SQL; no ORM traversal. |
| M5 | **`ImportExcelBC` stores denormalized supplier contact data** — `fournisseur_denomination/telephone/email/adresse` on `ImportExcelBC` duplicate information that may already exist on `Fournisseur`. | `procurement/models.py:184–188` | Data diverges between import record and actual supplier profile. |
| M6 | **No uniqueness constraint on `Service.nom_service`** — Two services with the same name in the same batiment can be created. | `users/models.py:96` | Duplicate services confuse assignment logic. |
| M7 | **`MarcheEtape` steps 8–10 never auto-created** — `stocker_au_magasin`, `paiement_en_cours`, `paiement_effectue` exist in `NOM_ETAPE_CHOICES` but `create_default_etapes()` only creates steps 1–7. | `procurement/models.py:133–156` | Payment tracking steps are unreachable unless created manually. |
| M8 | **`LotArticle.quantite_recue` is not synchronized with `InstanceRessource` count** — The count of instances linked via `InstanceRessource.id_lot` is the actual quantity received, but `quantite_recue` is a separate integer that must be manually kept in sync. | `procurement/models.py:300` | Stock discrepancy if updates are missed. |
| M9 | **`MouvementStock.quantite` is a plain `IntegerField`** — Can store negative values, which is semantically invalid for a quantity column. | `resources/models.py:232` | Negative quantity movements accepted without validation. |

### LOW

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| L1 | **No `created_at` on `Categorie`** — Only `date_mise_a_jour` (auto_now). Creation date is lost. | `resources/models.py` | Minor audit gap. |
| L2 | **`Fournisseur.email` not unique** — Multiple supplier profiles can share the same email. | `users/models.py:233` | Data quality issue; deduplication is impossible at DB level. |
| L3 | **`RolePermission` permission system appears unused** — No view, middleware, or decorator in the codebase reads `RolePermission` records at runtime. Access control is done via `Utilisateur.id_role.nom_role` checks only. | `users/models.py:42` | Dead complexity; `Role → Permission` matrix is maintained but never enforced. |
| L4 | **`TypeArticle.actif` and `Categorie.actif` not enforced in queries** — Soft-delete flags exist but no manager or queryset filters them out by default. | `resources/models.py` | Deactivated categories appear in API results unless filtered explicitly. |
| L5 | **Donation-specific fields on `MarcheBC`** — `type_donateur`, `nom_donateur`, `organisme_donateur`, `contact_donateur` are stored on the main table with no CHECK constraint requiring them to be null for non-donation types. | `procurement/models.py` | Table pollution; these fields are meaningless for marché/bon_commande rows. |

---

## 6. Improvement Recommendations

### 6.1 Fix critical race conditions (C1)

Use `SELECT FOR UPDATE` or a DB-generated sequence for document numbers:

```python
# Option A: database sequence (PostgreSQL)
numero = models.CharField(max_length=30, unique=True, null=True, blank=True)

# Generate in save() using F-string + sequence:
with transaction.atomic():
    last = Demande.objects.select_for_update().filter(
        numero__startswith=prefix
    ).order_by("-numero").first()
    ...
```

For SQLite (dev), wrapping in `transaction.atomic()` + `select_for_update()` is the minimum fix. For production PostgreSQL, prefer a dedicated `SEQUENCE` or `uuid` PKs.

### 6.2 Change CASCADE to PROTECT on critical FKs (C2, C3)

```python
# Demande.id_chef_demandeur
id_chef_demandeur = models.ForeignKey(Utilisateur, on_delete=models.PROTECT, ...)

# LigneDemande.id_ressource
id_ressource = models.ForeignKey(Ressource, on_delete=models.PROTECT, ...)

# LotArticle.id_ressource
id_ressource = models.ForeignKey(Ressource, on_delete=models.PROTECT, ...)
```

Use `PROTECT` for any FK where the child record represents historical/financial data. Use `SET_NULL` only where the FK is contextual metadata.

### 6.3 Consolidate `seuil_alerte` (H1)

Remove `Ressource.seuil_alerte` and use `Stock.seuil_alerte` as the single source. Update `Ressource.est_en_alerte` to read from `stock.seuil_alerte` via `self.stock`.

### 6.4 Clean up `Beneficiaire` denormalization (H2)

Either:
- Remove `beneficiaire_nom/type/detail` from `Demande` and compute them at read time via `id_beneficiaire`
- Or keep the text fields but populate them from the FK in the serializer `create()` method and never write them directly from the frontend

### 6.5 Complete `Notification.objet_id` as a proper GenericFK (H3)

```python
content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True)
objet_id = models.PositiveIntegerField(null=True, blank=True)
objet = GenericForeignKey("content_type", "objet_id")
```

### 6.6 Rename `TypeArticle` PK and `StagingItem` FK (H4)

```python
# TypeArticle
id_type_article = models.AutoField(primary_key=True)  # was id_categorie

# StagingItem
id_type_detecte_suggere = models.ForeignKey(TypeArticle, ...)  # was id_categorie_suggeree
```

Requires a data migration and serializer update.

### 6.7 Add `id_decharge` FK to `RetourMateriel` (H5)

```python
id_decharge_origine = models.ForeignKey(
    "decharge.Decharge", on_delete=models.SET_NULL, null=True, blank=True
)
```

Enables full traceability: procurement → lot → instance → décharge → retour.

### 6.8 Add `updated_at` to operational models (M2)

```python
updated_at = models.DateTimeField(auto_now=True)
```

Add to: `Demande`, `LigneDemande`, `Decharge`, `LigneDecharge`, `SignatureDecharge`, `RetourMateriel`.

### 6.9 Fix `MarcheBC.save()` delivery date recalculation (M3)

Only compute `date_livraison_prevue` during creation or when `delai_reception_jours` or `date_attribution` changes:

```python
def save(self, *args, **kwargs):
    update_fields = kwargs.get("update_fields")
    should_recalc = (
        update_fields is None  # full save
        or "delai_reception_jours" in update_fields
        or "date_attribution" in update_fields
    )
    if should_recalc and self.delai_reception_jours is not None:
        base_date = self.date_attribution or timezone.localdate()
        self.date_livraison_prevue = base_date + timedelta(days=self.delai_reception_jours)
    ...
```

### 6.10 Add `unique_together` on `Service`

```python
class Meta:
    unique_together = ("nom_service", "id_batiment")
```

### 6.11 Replace `JournalAudit` table+id with ContentType

```python
content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True)
id_enregistrement_cible = models.PositiveIntegerField()
```

Enables ORM traversal: `log.content_type.get_object_for_this_type(pk=log.id_enregistrement_cible)`.

### 6.12 Add `PositiveIntegerField` constraint to `MouvementStock.quantite` (M9)

```python
quantite = models.PositiveIntegerField()
```

### 6.13 Consider splitting `MarcheBC` into subtypes (L5)

Create a separate `DonationDetail` model (OneToOne to `MarcheBC`) holding donation-specific fields. This keeps the main table narrow and enforces null-safety at the schema level.

### 6.14 Enforce `actif` filters via custom managers (L4)

```python
class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(actif=True)

class TypeArticle(models.Model):
    ...
    objects = ActiveManager()
    all_objects = models.Manager()
```

---

## 7. Risk & Refactoring Priorities

### Priority 1 — Fix before production load

| Item | Risk | Effort |
|------|------|--------|
| C1: Atomic number generation | Data integrity — duplicate document numbers | Low |
| C2: Protect user→demand cascade | Data loss on user deletion | Low |
| C3: Protect resource→demand-line cascade | Silent history corruption | Low |
| M9: Non-negative quantities | Invalid stock records | Trivial |

### Priority 2 — Fix before scaling reads

| Item | Risk | Effort |
|------|------|--------|
| H1: Remove duplicate `seuil_alerte` | Logic divergence in alerting | Medium |
| H2: Beneficiaire denormalization | Stale display data on PDFs/UI | Medium |
| M2: Add `updated_at` timestamps | Inability to audit change history | Low |
| M3: Fix delivery date overwrite | Unexpected date mutations | Low |

### Priority 3 — Fix for maintainability

| Item | Risk | Effort |
|------|------|--------|
| H3: Complete Notification GenericFK | Broken object links in notifications | Medium |
| H4: Rename TypeArticle PK/FK | Developer confusion, API misuse | Medium (migration required) |
| H5: Add return→delivery FK | Broken traceability chain | Low |
| M6: Unique service name per batiment | Duplicate services | Trivial |
| M7: Auto-create etapes 8–10 | Missing payment tracking steps | Low |
| L3: Remove or enforce RolePermission | Dead complexity | Medium |
| L5: Split donation fields | Table bloat | High effort |

### Priority 4 — Long-term architecture

| Item | Risk | Effort |
|------|------|--------|
| M4: ContentType for JournalAudit | Unqueryable audit log | Medium |
| L4: Active managers | Inactive records polluting queries | Low |
| M8: Sync `quantite_recue` with instances | Stock discrepancy | Medium |
| M1: Remove dead `is_fournisseur` property | Developer mislead | Trivial |
| M5: Remove ImportExcelBC supplier denormalization | Data divergence | Medium |

---

*End of document — 30 tables, 7 modules, 14 critical/high/medium issues identified*
