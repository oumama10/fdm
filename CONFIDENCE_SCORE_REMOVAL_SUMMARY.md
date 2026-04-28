# Confidence Score Removal Summary

## Overview
Successfully removed the `confiance_ia` (confidence score) field from the entire project. This field was used to track the confidence level of AI-based extraction, but is no longer needed.

## Files Modified

### Backend

1. **models.py** - `StagingItem` model
   - ✅ Removed `confiance_ia` DecimalField (null=True, blank=True, 0-1 range)
   - ✅ Updated `needs_review` property: Changed from `confiance_ia < 0.70` → `statut == "en_attente"`

2. **admin.py** - Django Admin
   - ✅ Removed `confiance_ia` from `StagingItemAdmin.list_display`

3. **serializers.py** - DRF Serializer
   - ✅ Removed `confiance_ia` from `StagingItemSerializer.fields` list
   - ✅ Removed `confiance_ia` from `read_only_fields` list

4. **tasks/pdf_task.py** - PDF Extraction Task
   - ✅ Removed `confiance_ia=Decimal("0.65") if result.get("lignes") else Decimal("0.40")` assignment

5. **tasks/ocr_task.py** - Excel Extraction Task
   - ✅ Removed `confiance_ia=Decimal("0.70")` assignment

6. **views.py** - API Views
   - ✅ Removed `confiance_ia=Decimal("1.00")` from `ManualImportView`

7. **migrations/0008_remove_confiance_ia.py** - NEW MIGRATION
   - ✅ Created migration to drop `confiance_ia` field from database

### Frontend

1. **StagingReviewPage.jsx**
   - ✅ Removed `avgConfidence` calculation from stats
   - ✅ Removed `lowConfidence` filter from stats
   - ✅ Removed "Confiance avg" metric display (4-column grid → 3-column)
   - ✅ Removed "Confiance IA" table header and column display
   - ✅ Removed `isLow` background color styling (yellow highlight for low confidence)
   - ✅ Updated `canBulkApprove` logic (removed `stats.lowConfidence.length === 0` check)

### Test Files

1. **test_staging_creation.py**
   - ✅ Removed `confiance_ia=Decimal("0.90")` assignment

2. **e2e_workflow_test.py**
   - ✅ Removed `conf={row.confiance_ia}` from debug output string

## What Still Exists (Not Changed)

- **NLP normalizer functions** (`nlp_utils.py`, `nlp_normalizer.py`)
  - Still compute and return `confiance_ia` in their results
  - This is OK - the value is calculated but simply not stored in the database
  - Can be easily removed later if needed

- **Documentation files**
  - References to `confiance_ia` remain in ERD, flowcharts, etc.
  - Can be updated separately if documentation review is needed

## Database Changes

To apply the migration:
```bash
cd backend
python manage.py migrate procurement
```

This will:
1. Drop the `confiance_ia` column from `procurement_stagingitem` table
2. Update Django's internal schema tracking

## Behavior Changes

### Before
- Staging items had a confidence score (0.0-1.0) indicating extraction quality
- Items with score < 0.70 would show with yellow background
- "Confiance avg" metric displayed average confidence across all items
- `needs_review` property checked if confidence < 0.70

### After
- Staging items no longer track extraction confidence
- `needs_review` now simply checks if status is "en_attente" (pending)
- No color highlighting based on confidence
- Bulk approve button logic simplified (only checks for linked resources)

## API Changes

### StagingItem Serializer
**Removed from response:**
```json
{
  "confiance_ia": 0.85  // ← NO LONGER INCLUDED
}
```

**Response now looks like:**
```json
{
  "id_staging": 1,
  "designation_brute": "Item ABC",
  "description": "...",
  "designation_normalisee": "...",
  "quantite": 10,
  "statut": "en_attente",
  "needs_review": true,
  // ... other fields (no confiance_ia)
}
```

## Verification Checklist
- ✅ All Python files compile without syntax errors
- ✅ Migration file created and properly formatted
- ✅ All field references removed from models, serializers, views
- ✅ Frontend updated (no more undefined errors for `item.confiance_ia`)
- ⏳ Migration ready to run: `python manage.py migrate procurement`
- ⏳ Test extraction flow after migration

## Next Steps
1. Run Django migration: `python manage.py migrate procurement`
2. Test API endpoints to ensure no breaking changes
3. Verify frontend loads without console errors
4. Test PDF/Excel import and staging workflow
