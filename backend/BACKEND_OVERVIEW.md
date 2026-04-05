# Backend Overview (FMPDF)

This document explains what exists in the backend and how it works at runtime.

## 1) Tech Stack

- Framework: Django + Django REST Framework
- Auth: JWT (SimpleJWT)
- Async jobs: Celery + Redis
- API schema: drf-spectacular
- DB: PostgreSQL (via `DATABASE_URL`) with SQLite fallback in development
- Data format: camelCase JSON render/parsing configured globally

## 2) High-Level Architecture

The backend is a modular Django project organized by business domain:

- users: authentication, user/role/service/fournisseur management
- resources: stock and inventory entities
- procurement: marche/bon de commande lifecycle + Excel import + staging review
- requests: internal service requests (demandes)
- decharge: delivery receipts and signatures
- returns: material return flow
- alerts: deadline alerts, notifications, audit logs
- reporting: read-only analytical endpoints
- core: shared permissions and audit middleware

The central URL entrypoint mounts each app under `/api/...`.

## 3) Main Data Model Concepts

### Users and Access

- `Utilisateur` is the custom auth model (`AUTH_USER_MODEL`)
- Roles are explicit and used in permissions:
  - `service_financiere`
  - `gestionnaire_magasin`
  - `chef_service`
  - `admin`
  - `fournisseur`
- `Service` links staff to organizational units
- `Fournisseur` may be linked one-to-one to a user account for supplier portal access

### Procurement and Stock

- `MarcheBC`: acquisition object (`marche`, `bon_commande`, `donation`)
- `MarcheEtape`: 8-step lifecycle generated automatically when a marche is created
- `ImportExcelBC`: uploaded Excel attached to a marche
- `StagingItem`: extracted rows pending human validation
- `LotArticle`: final article lines attached to a marche and mapped to resources
- `Ressource`: material definition (consumable vs inventory asset)
- `Stock`: quantity tracking for consumables only
- `InstanceRessource`: individual tracked assets (inventory goods)
- `MouvementStock`: movement ledger/audit for stock operations

### Operations

- `Demande`: request raised by a service chief
- `LigneDemande`: request lines per resource
- `Decharge`: generated delivery receipt, linked one-to-one to a demande
- `SignatureDecharge`: signature workflow for delivery validation
- `RetourMateriel`: return flow with decision outcomes (repair, reassign, scrap, etc.)
- `AlerteDelai` and `Notification`: alerts and user notifications
- `JournalAudit`: technical audit trail entries

## 4) API Surface

Top-level routing:

- `/api/auth/` and `/api/users/` -> users app endpoints
- `/api/resources/` -> categories, resources, stock, instances, movements
- `/api/procurement/` -> marches, etapes, imports, staging, lots
- `/api/requests/` -> demandes
- `/api/decharge/` -> decharges + nested signatures
- `/api/returns/` -> retours
- `/api/alerts/` -> delay alerts + notifications
- `/api/reporting/` -> analytics endpoints
- `/api/schema/` -> OpenAPI schema

Most endpoints are ViewSets exposed by DRF routers.

## 5) Security and Permissions

Permissions are role-based and implemented in reusable permission classes in `apps/core/permissions.py`.

Examples:

- Financial service and warehouse manager can create/import procurement data
- Chef service can create demandes and sign their own decharges
- Fournisseur can read only supplier-scoped procurement records
- Admin has elevated control (including destructive actions)

Authentication flow:

1. `POST /api/auth/login/` returns user + access/refresh tokens
2. Access token is used for protected API calls
3. `POST /api/auth/refresh/` rotates access token
4. `POST /api/auth/logout/` blacklists refresh token

## 6) Core Runtime Flows

### A) Excel Import -> Staging -> Validation

1. User uploads Excel through procurement import endpoint
2. Backend creates:
   - a `MarcheBC`
   - an `ImportExcelBC` record
3. Backend triggers OCR/NLP extraction task (`extract_excel_items`)
4. Task parses workbook, detects headers, extracts designation/quantity, normalizes text
5. Task writes `StagingItem` rows for review
6. Import status moves through states (`en_revision` -> `brouillon`/`valide`/`rejete`)
7. Gestionnaire reviews and approves/rejects staging content

Important behavior:

- If Celery enqueue fails (for example Redis unavailable), code falls back to synchronous extraction so upload still works.

### B) Demande -> Validation -> Decharge -> Signature -> Stock Movement

1. Chef service creates a `Demande`
2. Gestionnaire validates or refuses
3. Gestionnaire creates a `Decharge` from approved demande
4. Chef uploads signed scan
5. Gestionnaire validates signature
6. Signal handler applies inventory side effects:
   - consumables: decrement `Stock.quantite_disponible`
   - inventory assets: set `InstanceRessource` status to in-service
   - create `MouvementStock` rows
7. Demande status is finalized (`complete_avec_decharge`)

### C) Deadline Monitoring and Notifications

1. Scheduled Celery task scans open marches
2. Computes remaining days until expected delivery
3. Creates alert records (`warning`/`critique`) depending on thresholds
4. Sends web notifications and/or email to target roles

## 7) Async Jobs and Scheduling

Celery app config defines queues:

- `default`
- `ocr`
- `pdf`
- `alerts`

Scheduler uses database-backed beat (`django_celery_beat`).

Examples of async tasks:

- OCR extraction from uploaded Excel
- Deadline checks for procurement
- Email notification sending
- PDF generation for decharges

## 8) Middleware and Auditing

`AuditMiddleware` records mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) into `JournalAudit` asynchronously.

Captured details include:

- HTTP method
- route path
- requester user (if authenticated)
- client IP
- user-agent

## 9) Validation Rules Worth Knowing

Some strong domain constraints enforced at model level:

- `Stock` is only valid for consumables
- `InstanceRessource` is only valid for inventory goods
- `LigneDecharge` type must match whether instance reference is present
- `MarcheBC` auto-computes delivery deadline based on acquisition type
- `MarcheEtape` defaults are auto-created on marche creation

## 10) Typical Request Lifecycle

1. HTTP request enters Django
2. JWT authentication resolves user
3. DRF permission checks role rights
4. Serializer validates payload
5. ViewSet executes create/update/list logic
6. Model save + signals enforce side effects
7. Optional async job is dispatched to Celery
8. Response is rendered as camelCase JSON

## 11) Operational Notes

- Environment values are loaded from `.env`
- Media files are stored under `/app/media` in current settings
- In DEBUG mode, Django serves media URLs directly
- API docs are available from generated schema endpoint

## 12) Quick Mental Model

Think of the backend as three layers:

- Business entities (models): who/what the system tracks
- Process APIs (views/viewsets): how users drive workflows
- Automation (signals/tasks): what happens automatically after user actions

That split is why the project scales reasonably: explicit domain modules, predictable API routing, and background processing for heavy or scheduled work.
