#!/usr/bin/env python
import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if len(sys.argv) < 2:
    print('Usage: python run_pdf_extract.py <path-to-pdf>')
    sys.exit(1)

pdf_path = Path(sys.argv[1])
if not pdf_path.exists():
    print('File not found:', pdf_path)
    sys.exit(2)

from apps.procurement.services.ai_extractor import AIExtractor

res = AIExtractor.extract_from_pdf(str(pdf_path))
print(json.dumps(res, ensure_ascii=False, indent=2))
