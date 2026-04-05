# `/financiere/import` Workflow Explained

This workflow handles Excel file uploads by the Financial Service role, with AI-powered extraction, staging, and handoff to the warehouse manager for validation.

---

## 🎯 High-Level Overview

```
User (Financial Service)
    ↓
Upload Excel + Select Source Type (marche/bon_commande/donation)
    ↓
Backend creates MarcheBC + ImportExcelBC
    ↓
Celery extracts metadata + article lines via OCR/NLP
    ↓
StagingItem rows created with normalized data
    ↓
Gestionnaire reviews and approves/rejects
    ↓
Approved items become LotArticle entries in the market
```

---

## 📍 Frontend Entry Point

**Page**: `frontend/src/pages/financiere/ImportExcelPage.jsx`

### User Interaction

1. **Drag-and-drop or click** to select a `.xlsx` file
2. **Choose source type** via radio buttons:
   - `marche` (market/procurement)
   - `bon_commande` (purchase order)
   - `donation` (gift/donation)
3. **Click "Lancer l'extraction"** to trigger the backend

### Form Data Sent

```
POST /api/procurement/import/direct/
Content-Type: multipart/form-data

Body:
  - fichier_excel: <file blob>
  - source_type: "marche" | "bon_commande" | "donation"
```

### Response (201 Created)

```json
{
  "id_import": 42,
  "id_marche": 99,
  "statut_import": "en_revision"
}
```

---

## ⏳ Frontend Polling Loop

After successful upload, frontend polls every **3 seconds**:

```
GET /api/procurement/import/{id_import}/
```

**Watches for status transitions**:

| Status | Frontend Action | Duration |
|--------|-----------------|----------|
| `en_revision` | Show "Extraction en cours..." | While extracting |
| `brouillon` | Extraction done! Ready for review | Stop polling |
| `rejete` | Show error message with observations | Stop polling |
| `valide` | Already sent to gestionnaire | Stop polling |

---

## 🔧 Backend Endpoint

**File**: `backend/apps/procurement/views.py` → `DirectImportView`  
**Permissions**: `IsServiceFinanciere | IsGestionnaireOrAdmin`

### Step-by-Step Backend Processing

#### 1️⃣ Validate File
- Check that `fichier_excel` is present
- Only `.xlsx` files allowed

#### 2️⃣ Normalize Source Type
- Frontend sends `"bon_commande"` → Backend converts to `"bc"` for ImportExcelBC model
- For MarcheBC, keeps `"bon_commande"` (different naming)

#### 3️⃣ Create Market Context
```python
# Generate unique reference based on timestamp
reference = f"IMPORT-{timestamp}"

marche = MarcheBC.objects.create(
    reference=reference,
    type_acquisition=type_acquisition,  # "marche", "bon_commande", or "donation"
    statut="en_attente_livraison",
    id_cree_par=request.user,
    id_fournisseur=None  # Will be filled in by extraction task
)
```

**Auto-generated MarcheEtape**:
- MarcheBC.save() triggers signal that creates 8 default workflow steps

#### 4️⃣ Create Import Record
```python
import_obj = ImportExcelBC.objects.create(
    fichier_excel_original=file,
    source_type=source_type_normalized,
    statut_import="en_revision",  # ← Important: signals extraction has started
    id_marche=marche,
    id_importe_par=request.user
)
```

#### 5️⃣ Trigger Extraction
```python
_trigger_extract(import_obj.id_import)

# This function:
# 1. First tries: extract_excel_items.apply_async(args=[import_id])
# 2. If Redis fails: extract_excel_items.run(import_id, retry_enabled=False)
#    (synchronous fallback so upload doesn't fail)
```

#### 6️⃣ Return Response
```json
{
  "id_import": 42,
  "id_marche": 99,
  "statut_import": "en_revision"
}
```

---

## 🤖 Celery Task: `extract_excel_items`

**File**: `backend/apps/procurement/tasks/ocr_task.py`  
**Queue**: `ocr`  
**Retry**: 3 attempts with exponential backoff

### Extraction Sequence

#### Phase 1: Prepare
```python
# Lock the import row to prevent concurrent extraction
with transaction.atomic():
    import_obj = ImportExcelBC.objects.select_for_update().get(pk=import_id)
    import_obj.statut_import = "en_revision"
    import_obj.save()
```

#### Phase 2: Open Workbook
```python
# Load Excel file
wb = load_workbook(import_obj.fichier_excel_original.path, read_only=True, data_only=True)
ws = _first_non_empty_sheet(wb)  # Pick first sheet with data
```

#### Phase 3: Extract Metadata (Document-Level)
**Scans top ~40 rows for supplier and reference info**

Keywords recognized (accent-insensitive):
- **Reference**: "reference", "numero marche", "n° marche", "bon de commande"
- **Supplier**: "fournisseur", "societe", "denomination", "prestataire"
- **Email**: email regex pattern
- **Phone**: phone regex pattern

Result stored in dict:
```python
metadata = {
    "reference": "BC-2025-001",
    "fournisseur_nom": "ACME Corp",
    "fournisseur_email": "contact@acme.com",
    "fournisseur_telephone": "+212-5-123-456"
}
```

#### Phase 4: Detect Header Row
**Scans downward for row containing keywords**: "designation", "quantite", "qte", "lot"

Once found, determines column indices:
```python
(designation_col_idx, quantite_col_idx) = _detect_data_columns(ws, header_row_idx)
```

#### Phase 5: Extract Article Lines
**For each row after header until EOF**

Per line, extract:
- `designation_brute` → raw text from first non-empty cell
- `quantite` → first numeric value in row (defaults to 0 if not found)
- `confiance_ia` → (to be set by NLP normalizer)
- `designation_normalisee` → cleaned + normalized by spaCy/NLP

**Validation**: Skip lines with invalid designations (e.g., all dashes, URLs, emails, phone numbers)

#### Phase 6: Normalize Designations (NLP)
```python
# Call normalize_designation() from nlp_normalizer.py
# Uses spaCy to:
#   - Tokenize
#   - Remove stop words
#   - Lemmatize
#   - Infer type ("consommable" vs "bien_inventaire")
#   - Calculate confidence score (0.0-1.0)

designation_normalisee, type_detecte, confiance_ia = normalize_designation(designation_brute)
```

#### Phase 7: Bulk Create StagingItem Rows
```python
staging_items = [
    StagingItem(
        designation_brute=designation_brute,
        designation_normalisee=designation_normalisee,
        quantite=quantite,
        confiance_ia=confiance_ia,
        type_detecte=type_detecte,
        statut="en_attente",  # ← Ready for gestionnaire review
        id_import=import_obj,
        id_categorie_suggeree=None  # Gestionnaire may set this
    )
    for ...
]

StagingItem.objects.bulk_create(staging_items, batch_size=500)
```

#### Phase 8: Enrich Market with Metadata
```python
# Update MarcheBC with extracted supplier/reference info
if reference in metadata and not_conflicting:
    marche.reference = reference

if fournisseur_nom in metadata:
    # Try to find existing supplier by name
    fournisseur = Fournisseur.objects.filter(nom_societe__icontains=fournisseur_nom).first()
    
    if not fournisseur:
        # Create new supplier
        fournisseur = Fournisseur.objects.create(
            nom_societe=fournisseur_nom,
            nom_responsable=fournisseur_nom,  # Default
            email=metadata.get("fournisseur_email", ""),
            telephone=metadata.get("fournisseur_telephone", "")
        )
    else:
        # Update existing supplier contact info
        fournisseur.email = metadata.get("fournisseur_email", fournisseur.email)
        fournisseur.telephone = metadata.get("fournisseur_telephone", fournisseur.telephone)
        fournisseur.save()
    
    marche.id_fournisseur = fournisseur

marche.save()
```

#### Phase 9: Mark as Ready
```python
import_obj.statut_import = "brouillon"  # ← Extraction complete, ready for review
import_obj.save()
```

#### Phase 10: Notify Gestionnaires
```python
# Get all active warehouse managers
gestionnaires = Utilisateur.objects.filter(id_role__nom_role="gestionnaire_magasin", actif=True)

# Create web notification for each
for g in gestionnaires:
    Notification.objects.create(
        id_destinataire=g,
        type_notification="validation_requise",
        titre="Import prêt pour révision",
        message=f"L'import #{import_obj.id_import} contient {item_count} article(s) en attente de validation.",
        canal="web"
    )
```

### Failure Handling
If any exception occurs:
1. **Retry**: Celery retries up to 3 times with exponential backoff
2. **After max retries exceeded**: Mark import as `rejete` + store error message in `observations`

---

## 📋 Staging Review (Gestionnaire Role)

**Frontend**: `frontend/src/pages/gestionnaire/StagingReviewPage.jsx`

After extraction completes (status = `brouillon`), the **gestionnaire_magasin** is notified and can:

1. Navigate to `/gestionnaire/staging/{import_id}`
2. **Review** each extracted line:
   - See `designation_brute`, `designation_normalisee`, `quantite`
   - See `confiance_ia` score (% confidence in NLP classification)
3. **Approve** or **Reject** each line
4. **Edit** if needed (override normalized designation, add category)
5. **Submit** approved items

**Endpoint**: `POST /api/procurement/staging/{id}/approve/`
```json
{
  "id_categorie_suggeree": 1,
  "id_ressource_liee": 5
}
```

When approved lines reach threshold, they become `LotArticle` entries attached to the `MarcheBC`.

---

## 🔄 Summary: State Transitions

```
ImportExcelBC.statut_import:

  idle (not created)
    ↓
  en_revision          ← Upload succeeded, extraction starting
    ↓
  brouillon            ← Extraction done, awaiting gestionnaire review
    ↓
  valide               ← Gestionnaire approved, sent to warehouse
    OR
  rejete               ← Extraction failed or gestionnaire rejected
```

---

## 🎛️ Key Configuration

**From Settings** (`backend/config/settings/base.py`):

- `CELERY_BROKER_URL` = Redis connection (defaults to `redis://localhost:6379/0`)
- `CELERY_RESULT_BACKEND` = Redis results storage (`redis://localhost:6379/1`)
- `DECHARGE_TEMPLATE_PATH` = Path to Excel/PDF generation template
- `CORS_ALLOWED_ORIGINS` includes `http://localhost:5173` (frontend)

---

## 🚨 Potential Issues & Edge Cases

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Upload succeeds but extraction never completes | Redis/Celery unavailable but didn't fail over to sync | Check that sync fallback enacted; log should show exception |
| "Seuls les fichiers .xlsx sont acceptés" | Wrong file format (e.g. .xls, .csv) | Frontend enforces MIME type via accept prop |
| Extraction stuck in `en_revision` | Task crashed silently | Check Celery worker logs; check `ImportExcelBC.observations` |
| Extracted items have blank `designation_normalisee` | NLP normalizer returned empty string | Check spaCy model installed and `nlp_normalizer.py` logic |
| No supplier created/linked | `fournisseur_nom` not extracted | Check Excel file has supplier name in top 40 rows |
| High confidence items still require review | NLP confidence threshold is conservative | Gestionnaire can batch-approve low-confidence items manually |

---

## 📊 Data Flow Diagram

```
ImportExcelPage.jsx
    ↓ (user selects file + source_type)
uploadExcelDirect() API call
    ↓
POST /api/procurement/import/direct/
DirectImportView.post()
    ├─ Validate file
    ├─ Create MarcheBC (reference = IMPORT-{timestamp})
    ├─ Create ImportExcelBC (statut = en_revision)
    └─ _trigger_extract(import_id)
       ├─ Try: extract_excel_items.apply_async()
       └─ Except: extract_excel_items.run() [sync fallback]
    
extract_excel_items (Celery task)
    ├─ Lock ImportExcelBC row
    ├─ Open workbook
    ├─ Scan metadata (reference, supplier, email, phone)
    ├─ Detect header row
    ├─ Extract article lines (designation, qty)
    ├─ Normalize via NLP (spaCy)
    ├─ Bulk create StagingItem rows
    ├─ Enrich MarcheBC with supplier
    ├─ Set ImportExcelBC.statut_import = brouillon
    └─ Notify gestionnaires
    
Frontend polls GET /api/procurement/import/{id}/
    ├─ Sees statut_import = brouillon
    └─ Navigates to landing page (financial redirects, gestionnaire to staging review)

Gestionnaire Reviews StagingItems
    ├─ POST /api/procurement/staging/{id}/approve/ (for each approved line)
    └─ Items become LotArticle on MarcheBC
```

---

## ✅ Checklist: Manual Testing

- [ ] Log in as `financiere@test.com`
- [ ] Create sample `.xlsx` file with columns: Désignation, Quantité, Fournisseur (optional)
- [ ] Upload and select source type
- [ ] Click "Lancer l'extraction"
- [ ] Observe polling status updates
- [ ] Wait for extraction to complete (check Celery worker logs if slow)
- [ ] Verify `StagingItem` rows appeared with normalized data
- [ ] Log in as `gestionnaire@test.com`
- [ ] Navigate to staging review page
- [ ] Approve or reject lines
- [ ] Verify approved items link to resources/categories
