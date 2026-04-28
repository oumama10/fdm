# Quick Reference: What Changed

## Files Modified

### 1. `backend/apps/procurement/services/ai_extractor.py` - COMPLETELY REWRITTEN
- **Before**: Called OpenRouterClient.extract_bc_document(text) via LLM
- **After**: Pure library-based parsing with regex patterns and text analysis
- **Size**: ~350 lines → ~330 lines (removed LLM-related code)

### 2. `backend/apps/procurement/tasks/pdf_task.py`
- **Line ~133**: Confidence score changed
  ```python
  # BEFORE
  confiance_ia=Decimal("0.90") if result.get("source") == "llm" else Decimal("0.50"),
  
  # AFTER  
  confiance_ia=Decimal("0.65") if result.get("lignes") else Decimal("0.40"),
  ```

### 3. `backend/apps/procurement/tasks/ocr_task.py`
- **Line ~73**: Updated exception message
  ```python
  # BEFORE
  logger.exception("LLM extraction failed")
  
  # AFTER
  logger.exception("Library-based extraction failed")
  ```
  
- **Line ~145**: Confidence score changed
  ```python
  # BEFORE
  confiance_ia=Decimal("0.90"),
  
  # AFTER
  confiance_ia=Decimal("0.70"),  # Library based extraction
  ```

## What Still Works Exactly the Same
✅ PDF extraction via pdfplumber  
✅ Excel/XLSX reading via openpyxl  
✅ StagingItem creation  
✅ NLP normalization  
✅ Frontend displays (same data format)  
✅ Database queries (same fields)  

## What's New
✨ No external LLM API calls → Faster, cheaper, offline-capable  
✨ Two-stage extraction: Tables first, then patterns  
✨ Broader language support (multiple Moroccan/French formats)  
✨ Confidence scores reflect library-based accuracy

## Environment Variables Affected
❌ OPENROUTER_API_KEY - No longer needed for PDF/Excel extraction  
⚠️ Still needed for: article_classifier.py (article categorization)

## How to Test

```bash
# Make sure services are running
cd backend
python manage.py shell

# Test extraction directly
from apps.procurement.services.ai_extractor import AIExtractor

pdf_text = """
BON DE COMMANDE N° BC-2025-001
Fournisseur: ACME SA
Tél: +212612345678
Email: contact@acme.ma

1 | Papier A4 500 feuilles | 50 | U | 150.00 MAD | 7500.00 MAD
2 | Stylo Bic noir | 200 | U | 5.00 MAD | 1000.00 MAD
"""

result = AIExtractor.extract_from_text(pdf_text)
print(result)
# Should return dict with lignes, header, source="library"
```

## Verification Checklist
- ✅ No import errors (py_compile passed)
- ✅ All three files compile cleanly
- ✅ Same output format as before
- ✅ Backward compatible (no DB changes)
- ⏳ Test with actual PDFs from your business
- ⏳ Monitor extraction accuracy in staging review

## If Issues Occur
1. Check log messages: "Library extraction extracted X lignes"
2. Verify PDF text is readable: `pdfplumber.open(file).pages[0].extract_text()`
3. Confidence scores lower than expected? Check if document matches patterns
4. Missing header fields? Verify regex patterns match your document format
