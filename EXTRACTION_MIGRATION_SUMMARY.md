# PDF/Excel Extraction Migration: LLM → Library-Based

## Summary
Successfully replaced OpenAI/OpenRouter LLM calls with library-based extraction using `pdfplumber` and regex patterns for PDF/Excel import. The system now extracts structured data from documents without external LLM dependencies.

## Changes Made

### 1. **ai_extractor.py** (Core Extraction Logic)
**File**: `backend/apps/procurement/services/ai_extractor.py`

**Changes**:
- ❌ Removed OpenRouterClient import and LLM call
- ✅ Removed `_normalize_llm_result()` method (no longer needed)
- ✅ Enhanced `_fallback_parse()` → Primary extraction method (now library-only)
- ✅ Added `_extract_table_lines()` → Handles pipe/tab-separated table formats
- ✅ Added `_extract_pattern_lines()` → Regex patterns for numbered/bulleted lists
- ✅ Improved header extraction with broader pattern matching:
  - Document types: bon de commande, marché, facture, devis, invoice, quotation
  - Phone numbers: Moroccan (0[5-7]) and international (+212, +xx) formats
  - Supplier names, addresses, references, deadlines

**Output Structure**: Same dictionary format, now with `"source": "library"`

### 2. **pdf_task.py** (PDF Processing)
**File**: `backend/apps/procurement/tasks/pdf_task.py`

**Changes**:
- Updated confidence score calculation:
  - Changed from: `Decimal("0.90")` if LLM else `Decimal("0.50")`
  - Changed to: `Decimal("0.65")` if items extracted else `Decimal("0.40")`
  - Reflects library-based extraction accuracy

**Note**: PDF text extraction via pdfplumber remains unchanged

### 3. **ocr_task.py** (Excel Processing)  
**File**: `backend/apps/procurement/tasks/ocr_task.py`

**Changes**:
- Updated error message: "LLM extraction failed" → "Library-based extraction failed"
- Updated confidence score: `Decimal("0.90")` → `Decimal("0.70")`
  - Higher than PDF (0.70 vs 0.65) because Excel has more structured data

## Technical Details

### Header Extraction Patterns
```python
# Title: Bon de commande, Marché, Facture, Devis, Invoice, Quotation
# Email: Standard RFC patterns
# Phone: 0[5-7]XXXXXXXX, +212XXXXXXXXX, +1-999-999-9999, etc.
# Reference: BC No, Marché No, Commande No, Order No
# Supplier: Dénomination, Raison sociale, Fournisseur, Supplier
# Address: Adresse du fournisseur
# Deadline: Délai d'exécution, Date de livraison, Delivery Date
```

### Line Item Extraction (Fallback Chain)
1. **Table Format**: Pipe/tab-separated columns (No|Designation|Qty|Unit|Price|Total)
2. **Numbered List**: Pattern with quantities and prices (1. Item 10 50.00 MAD 500.00 MAD)
3. **Fallback**: Any substantial text line (skips headers, footers, totals)

## Output Format (Unchanged)
```python
{
    "source": "library",  # Previously "llm" or "fallback"
    "header": {
        "titre_document": str,
        "reference": str,
        "fournisseur_denomination": str,
        "fournisseur_telephone": str,
        "fournisseur_email": str,
        "fournisseur_adresse": str,
        "delai_execution": str,
    },
    "fournisseur": {...},
    "commande": {...},
    "lignes": [
        {
            "designation": str,      # Max 500 chars
            "description": str,      # Max 4000 chars
            "quantite": int,
            "unite": str,
            "prix_unitaire_ht": Decimal | None,
            "prix_total_ht": Decimal | None,
        },
        ...
    ],
    "totaux": {
        "montant_ht": Decimal | None,
        "montant_tva": Decimal | None,
        "montant_ttc": Decimal | None,
    },
}
```

## Benefits
✅ **No LLM Calls**: Eliminates external API dependencies, latency, and costs  
✅ **Faster Processing**: No network round trips, purely local parsing  
✅ **Same Output Format**: Drop-in replacement for frontend and staging  
✅ **Better For Structured Docs**: Excels with tabular/list formats common in procurement  
✅ **Offline Capable**: Works without internet connection  

## Trade-offs
⚠️ **Less Flexible**: May not handle highly unstructured or handwritten PDFs  
⚠️ **No Context Understanding**: Cannot infer meaning from context alone  

## Confidence Scores
| Source | Type | Confidence | Reason |
|--------|------|------------|--------|
| Library | Excel | 0.70 | Structured data, header rows |
| Library | PDF | 0.65 | Text extraction less structured |
| Library | Fallback | 0.40 | Minimal pattern matches |

## Testing Recommendations
1. ✅ Test with existing PDF/Excel files in `backend/tmp_test_media/`
2. Verify staging items created with correct metadata
3. Check confidence scores in StagingItem records
4. Validate with real procurement documents from your business

## Notes
- `article_classifier.py` still uses LLM for categorization (separate feature)
- `OpenRouterClient` remains but unused in extraction pipeline
- All extracted data flows through NLP normalization as before
- Database schema unchanged - fully backward compatible

## Rollback
If needed, revert `ai_extractor.py` to previous version and restore OpenRouterClient calls.
