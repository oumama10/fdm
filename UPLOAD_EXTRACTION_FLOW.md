# FMPDF Upload & Extraction Flow (Detailed)

This document explains **exactly** how the current Excel upload and AI extraction pipeline works in FMPDF, from the user click to the generated staging lines and market metadata.

---

## 1) Goal of the flow

The flow allows a user (typically `service_financiere`) to:

1. Upload one Excel file (`.xlsx`)
2. Trigger extraction without pre-selecting a market
3. Let backend create the import context automatically
4. Extract:
   - document metadata (reference, supplier/company, phone, email)
   - article lines (designation + quantity + normalized values)
5. Route the process into review/approval (staging)

---

## 2) Frontend entry point

### Page
- `frontend/src/pages/financiere/ImportExcelPage.jsx`

### UI elements shown
- Drag-and-drop zone (`react-dropzone`) accepting **.xlsx only**
- `source_type` radio selection:
  - `marche`
  - `bon_commande`
  - `donation`
- Button: **Lancer l'extraction**

### Request sent
When user clicks **Lancer l'extraction**, frontend sends multipart form data to:

- `POST /api/procurement/import/direct/`

Body fields:
- `fichier_excel` → selected file
- `source_type` → selected radio value

### Polling behavior
After successful POST (`201`), frontend polls:

- `GET /api/procurement/import/{id}/`

Polling interval: every 3 seconds while status is not final.

### Frontend status handling
- `statut_import == en_revision` → show **Extraction en cours...**
- `statut_import == brouillon`:
  - if role is `gestionnaire_magasin`: navigate to `/gestionnaire/staging/{id}`
  - if role is `service_financiere`: show success message and navigate to `/financiere/marches`
- `statut_import == rejete`:
  - show error toast with backend `observations`

---

## 3) Direct import backend endpoint

### View
- `backend/apps/procurement/views.py`
- Class: `DirectImportView`

### Route
- `backend/apps/procurement/urls.py`
- `path("import/direct/", DirectImportView.as_view(), name="import-direct")`

### Permissions
- `IsServiceFinanciere | IsGestionnaireOrAdmin`

### What happens on POST
1. Validate file presence (`fichier_excel` or fallback key `fichier_excel_original`)
2. Normalize source type:
   - import model uses `bc` for bon de commande
   - market model uses `bon_commande`
3. Create placeholder `MarcheBC` with generated reference:
   - `IMPORT-<timestamp>`
4. Create `ImportExcelBC` linked to that market:
   - file
   - source_type
   - statut_import = `en_revision`
5. Trigger extraction task
6. Return:
   - `id_import`
   - `id_marche`
   - `statut_import`

---

## 4) Task trigger strategy (Celery + fallback)

### Helper
- `backend/apps/procurement/views.py`
- function `_trigger_extract(import_id)`

### Behavior
- First tries async queue:
  - `extract_excel_items.delay(import_id)`
- If Redis/Celery is unavailable:
  - logs exception
  - runs extraction synchronously: `extract_excel_items(import_id)`

This avoids HTTP 500 when Redis is down in local/dev environments.

---

## 5) OCR/Excel extraction task

### File
- `backend/apps/procurement/tasks/ocr_task.py`

### Main task
- `extract_excel_items(import_id)`

### High-level sequence
1. Lock import row and set `statut_import = en_revision`
2. Open workbook (`openpyxl`, read-only)
3. Select first non-empty sheet
4. Scan top rows for document metadata
5. Detect header row for line extraction
6. Parse each data row into `StagingItem`
7. Bulk-create staging rows
8. Enrich linked `MarcheBC` with extracted metadata
9. Set import status to `brouillon`
10. Notify active gestionnaires (`validation_requise`)
11. On failure: retry with backoff; if exhausted set `rejete` + `observations`

---

## 6) Which fields are extracted

## 6.1 Document-level metadata (for `MarcheBC` + supplier context)
Scanned primarily from first ~40 rows.

Extracted keys:
- `reference`
- `fournisseur_nom`
- `fournisseur_email`
- `fournisseur_telephone`

Keyword families used include variants of:
- reference: `reference`, `numero marche`, `n° marche`, `bon de commande`
- supplier/company: `fournisseur`, `societe`, `société`, `denomination`, `prestataire`
- phone: `tel`, `telephone`, `gsm`
- email: `email`, `e-mail`, `mail`

Regex support:
- email pattern
- phone pattern

## 6.2 Article-level extracted lines (stored in `StagingItem`)
Per line:
- `designation_brute`
- `designation_normalisee`
- `quantite`
- `confiance_ia`
- `id_categorie_suggeree`
- `id_ressource_liee`

Notes:
- `type_detecte` is intentionally set empty and removed from the review UI.

---

## 7) Supplier and market enrichment logic

After line extraction:

1. If extracted `reference` is available:
   - update `MarcheBC.reference` (if no conflict with another market)

2. If extracted `fournisseur_nom` is available:
   - try matching existing `Fournisseur` by `nom_societe__icontains`
   - if none found, create a new `Fournisseur` with:
     - `nom_societe` from extracted company name
     - `nom_responsable` defaulted from same extracted value
     - email/phone from extracted metadata (or safe fallback)
   - attach matched/created supplier to `MarcheBC.id_fournisseur`

3. If supplier found and email/phone extracted:
   - update supplier contact values

---

## 8) Polling serializer for progress

### File
- `backend/apps/procurement/serializers.py`

### Serializer
- `ImportExcelBCStatusSerializer`

Fields returned by `GET /api/procurement/import/{id}/`:
- `id_import`
- `id_marche`
- `statut_import`
- `observations`
- `staging_items_count`
- `staging_items_approved_count`

This is what frontend uses to know when extraction is done/rejected.

---

## 9) Staging review visibility by role

- `gestionnaire_magasin`:
  - can access `/gestionnaire/staging/{id}` and review/approve lines
- `service_financiere`:
  - does **not** review staging lines directly
  - after successful extraction, redirected to `/financiere/marches`

---

## 10) Common statuses

For `ImportExcelBC.statut_import`:
- `en_revision` → extraction running
- `brouillon` → extracted and ready for review
- `valide` → typically after all lines approved
- `rejete` → extraction failed/invalid format

---

## 11) Troubleshooting

### A) Redis/Celery unavailable
Symptom: connection refused to `localhost:6379`.

Current behavior: endpoint still works via sync fallback.

### B) `fr_core_news_sm` missing
Symptom: warning in logs, fallback tokenization used.

Impact: extraction still works; NLP confidence/matching quality may be lower.

To install model:

```bash
python manage.py download_spacy_model
```

### C) No staging route access from finance role
Expected by design (review belongs to gestionnaire).

---

## 12) End-to-end summary

1. User uploads `.xlsx` + source type
2. Backend creates placeholder market + import record
3. Extraction task parses metadata + rows
4. Market reference/supplier/contact may be enriched from file
5. Staging rows are generated
6. Import status becomes `brouillon`
7. Gestionnaire reviews and approves lines
8. Stock updates occur via signals after approvals
