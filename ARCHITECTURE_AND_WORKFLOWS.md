# FMPDF Architecture and Workflows

This document summarizes the project architecture and the main workflows implemented in the codebase.

## Project Overview

FMPDF is a procurement, validation, and inventory management project built around a document-driven workflow.

Its main purpose is to:

- import procurement documents from Excel and PDF
- extract and normalize article data with AI and NLP support
- validate articles through a manager review flow
- convert approved articles into stock or tracked inventory instances
- manage service requests, delivery receipts, returns, and alerts

Current project state:

- core backend and frontend architecture is in place
- import, staging, stock, and decharge workflows are implemented
- the stock and inventory UI now exposes market and acquisition information
- workflow diagrams and core entity diagrams have been separated into focused PlantUML files

The project is still evolving, but the main operational paths are already connected end-to-end.

## 1. Project Architecture

### 1.1 System Overview

FMPDF is a full-stack procurement and inventory management system with:

- a Django + Django REST Framework backend
- a React + Vite frontend
- Celery for background jobs
- Redis as the task broker in development
- SQLite for local development and PostgreSQL support in production

The application is organized by business domain rather than by technical layer.

### 1.2 Backend Structure

The backend lives in `backend/` and is split into domain apps:

- `apps/users` for authentication, roles, services, and suppliers
- `apps/procurement` for marches, imports, staging, and article validation
- `apps/resources` for resources, stock, inventory instances, and movements
- `apps/requests` for internal requests
- `apps/decharge` for delivery receipts and signatures
- `apps/returns` for return processing
- `apps/alerts` for notifications, audit-related alerts, and deadlines
- `apps/reporting` for read-only operational reporting
- `apps/core` for shared permissions, audit middleware, and infrastructure helpers

Core backend characteristics:

- API routing is exposed under `/api/...`
- authentication uses JWT
- permissions are role-based
- models carry the domain logic, while tasks and signals handle automation

### 1.3 Frontend Structure

The frontend lives in `frontend/` and is a React SPA.

Main elements:

- route-based pages for finance, procurement, stock, requests, returns, and reporting
- reusable API clients under `frontend/src/api`
- React Query for server-state fetching and caching
- a shared UI layer under `frontend/src/components`

The stock page is the main inventory entry point, while the procurement pages drive document import and review.

### 1.4 Data and Automation Layer

The system combines three kinds of backend behavior:

- model persistence for business entities
- signals for immediate side effects after writes
- Celery tasks for long-running extraction, alerts, and document processing

This split is important because many workflows depend on automated transitions after an import, approval, or signature.

### 1.5 Key Domain Models

The main entities are:

- `MarcheBC` for procurement contracts / purchase orders / donations
- `ImportExcelBC` for uploaded import files
- `StagingItem` for extracted lines awaiting validation
- `LotArticle` for validated article lines attached to a market
- `Ressource` for the master resource definition
- `Stock` for consumable quantities
- `InstanceRessource` for tracked inventory items
- `MouvementStock` for stock history
- `Demande`, `LigneDemande`, `Decharge`, `SignatureDecharge`, and `RetourMateriel` for downstream operational flows

## 2. Request and Runtime Flow

### 2.1 Standard API Lifecycle

1. User logs in and receives JWT tokens.
2. Frontend sends requests through the Vite proxy to the Django API.
3. Django authenticates the request.
4. Role permissions decide whether the action is allowed.
5. Serializer validates or formats the payload.
6. ViewSet or APIView executes business logic.
7. Model saves, signals, and tasks perform side effects.
8. JSON response is returned to the frontend.

### 2.2 Where the Main URLs Live

- `/api/auth/` and `/api/users/` for identity and account management
- `/api/procurement/` for imports, staging, marches, and validation
- `/api/resources/` for stock, inventory instances, resources, and movements
- `/api/requests/` for internal service requests
- `/api/decharge/` for delivery receipts
- `/api/returns/` for return workflows
- `/api/alerts/` for notifications and alerts
- `/api/reporting/` for stock reporting

## 3. Workflow Architectures

### 3.1 Excel Import Workflow

Purpose: ingest a procurement spreadsheet and turn it into staging rows for review.

Flow:

1. Financial service uploads an `.xlsx` file.
2. Backend creates a `MarcheBC` placeholder and an `ImportExcelBC` record.
3. Celery task `extract_excel_items` parses the spreadsheet.
4. The task extracts document metadata and article lines.
5. NLP normalization suggests categories and resource mappings.
6. `StagingItem` rows are created in `en_attente` state.
7. The import is left in `brouillon` so a manager can validate it.

Important behavior:

- If Redis is unavailable, extraction can fall back to synchronous execution.
- Supplier and reference metadata can enrich the linked `MarcheBC`.

### 3.2 PDF Import Workflow

Purpose: process procurement PDFs with the same review model as Excel imports.

Flow:

1. User uploads a PDF document.
2. Backend extracts raw text with PDF parsing.
3. The AI extractor calls OpenRouter for structured extraction.
4. If the LLM call fails, fallback parsing is used.
5. The task normalizes each line and creates `StagingItem` rows.
6. The linked `MarcheBC` is enriched with extracted metadata.
7. The import is exposed for review in the staging UI.

Architecture note:

- The LLM path is online and depends on OpenRouter.
- NLP normalization is local and complements the LLM output.

### 3.3 Staging Review and Validation Workflow

Purpose: allow the warehouse manager to approve imported article lines and integrate them into stock.

Flow:

1. Manager opens the staging view for an import.
2. Each `StagingItem` is reviewed and can be adjusted manually.
3. Approved lines are classified as consumable or inventory asset.
4. The backend creates or reuses `Ressource` and `LotArticle` records.
5. The item is marked approved and linked to the resource.
6. Stock integration runs:
   - consumables update `Stock`
   - inventory assets create `InstanceRessource`
7. `MouvementStock` rows are written for traceability.

Core rule:

- Consumables are quantity-based.
- Inventory goods are unit-based and become individually tracked instances.

### 3.4 Stock and Inventory Workflow

Purpose: expose the operational stock and inventory state to the UI.

Flow:

1. Frontend requests `/api/resources/stocks/` for consumables.
2. Frontend requests `/api/resources/instances/` for inventory goods.
3. Backend serializers enrich the data with resource, lot, and market details.
4. The stock page groups and filters data by category and subcategory.
5. The inventory modal displays inventory number, state, status, acquisition date, and market reference.

Display model:

- consumables are listed by stock quantity
- inventory assets are listed by resource and instance

### 3.5 Demande → Decharge Workflow

Purpose: handle service requests and their fulfillment.

Flow:

1. A service chief creates a demand.
2. The request is validated by the appropriate role.
3. A delivery receipt (`Decharge`) is generated and printed by the manager.
4. Articles are delivered to the chief service.
5. The chief service signs the decharge on delivery.
6. The manager changes the decharge state from non signé to signé.
7. Signals and stock hooks update stock or inventory state automatically depending on resource type.

### 3.6 Return Workflow

Purpose: record the return of inventory items and apply the appropriate decision.

Flow:

1. A return request is created.
2. The return line points to the relevant inventory instance or resource.
3. A decision is applied, such as repair, reassignment, or removal.
4. Signals update the inventory state and audit trail.

### 3.7 Alert and Reporting Workflow

Purpose: keep users informed about deadlines and expose stock state for monitoring.

Flow:

1. Celery scans open marches and alert thresholds.
2. Notifications are created for relevant roles.
3. Reporting endpoints expose read-only summaries.
4. The frontend shows alerts and operational stock views.

## 4. Architecture of Each Main Workflow

### 4.1 Procurement Import Workflow Architecture

- Input: Excel or PDF procurement document
- Processor: Celery task + NLP normalization + optional LLM extraction
- Output: `MarcheBC`, `ImportExcelBC`, `StagingItem`
- Review role: `gestionnaire_magasin`
- Finalization: approved lines become `LotArticle` and stock resources

### 4.2 Inventory Stock Workflow Architecture

- Input: validated procurement line
- Processor: validation endpoint + stock integration helper
- Output:
  - `Stock` for consumables
  - `InstanceRessource` for inventory goods
  - `MouvementStock` for auditability

### 4.3 Request and Fulfillment Workflow Architecture

- Input: service demand
- Processor: request approval + decharge generation/printing + signature validation
- Output: automatic stock or inventory update, depending on resource type

### 4.4 Return Workflow Architecture

- Input: returned item or service decision
- Processor: return validation and state update
- Output: inventory status change and audit record

### 4.5 Alert Workflow Architecture

- Input: scheduled deadline scan
- Processor: Celery scheduler and notification creation
- Output: notifications and reporting visibility

## 5. Practical Mental Model

The system is easier to understand if you think of it as four layers:

1. Domain models store the business truth.
2. ViewSets and APIViews expose the workflows.
3. Celery and signals apply automation after writes.
4. React pages render the operational state.

That is why imports, validation, stock creation, and inventory display are all connected but implemented in different places.

## 6. L'avancement du projet

### 6.1 Ce qui est en place

- Le backend Django/DRF est structuré par domaines métier.
- Les workflows d'import Excel et PDF existent et alimentent le staging.
- La validation gestionnaire peut intégrer les articles dans le stock ou en instances d'inventaire.
- Le frontend React dispose des pages principales pour les imports, le stock, les demandes et le reporting.
- Les tâches asynchrones Celery couvrent l'extraction, les alertes et les traitements lourds.

### 6.2 Ce qui a été stabilisé récemment

- L'extraction PDF et Excel alimente correctement les `StagingItem`.
- Les données de marché et de lot sont exposées dans l'API des instances d'inventaire.
- L'écran de stock peut afficher la date d'acquisition et la référence marché.
- Les colonnes inutiles du modal de stock ont été retirées du flux d'affichage.

### 6.3 Points encore sensibles

- La disponibilité du backend doit être stable pour que le proxy Vite fonctionne correctement.
- Redis reste requis pour l'exécution asynchrone, avec fallback local quand il est indisponible.
- Certaines données historiques peuvent encore contenir des champs vides si elles ont été créées avant les corrections récentes.

### 6.4 Prochaines améliorations naturelles

- Compléter les données historiques par un backfill si nécessaire.
- Harmoniser encore les serializers entre les anciennes et nouvelles réponses API.
- Séparer éventuellement ce document en plusieurs fichiers si la documentation continue de grandir.
