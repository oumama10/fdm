import json
import logging
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class OpenRouterClient:
    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

    @classmethod
    def extract_bc_document(cls, raw_text: str) -> dict:
        api_key = getattr(settings, "OPENROUTER_API_KEY", None)
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")

        prompt = (
            "You are an expert at extracting structured data from Moroccan public procurement documents "
            "(Bons de Commande and Marchés).\n\n"
            "Extract the document header separately from the line items.\n\n"
            "Return ONLY a valid JSON object with this exact structure (no explanation, no markdown, no code blocks):\n\n"
            "{\n"
            "  \"titre_document\": \"document title or null\",\n"
            "  \"reference\": \"reference or null\",\n"
            "  \"fournisseur_denomination\": \"company name or null\",\n"
            "  \"fournisseur_telephone\": \"phone or null\",\n"
            "  \"fournisseur_email\": \"email or null\",\n"
            "  \"fournisseur_adresse\": \"address or null\",\n"
            "  \"delai_execution\": \"deadline, delivery date, or execution date or null\",\n"
            "  \"lignes\": [\n"
            "    {\n"
            "      \"numero\": 1,\n"
            "      \"designation\": \"ONLY product name (short title)\",\n"
            "      \"description\": \"technical specifications / detailed description\",\n"
            "      \"quantite\": 1,\n"
            "      \"unite\": \"U or null\",\n"
            "      \"prix_unitaire_ht\": 8500.00,\n"
            "      \"prix_total_ht\": 8500.00\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- titre_document must be the main document title when present\n"
            "- reference must be the BC or document reference shown in the header\n"
            "- fournisseur_* fields must contain the supplier identity if present\n"
            "- delai_execution must be the delivery / execution delay or date if present\n"
            "- designation must contain ONLY the product name (example: CONGELATEUR vertical armoire INOX)\n"
            "- description must contain all technical specifications/details linked to the line\n"
            "- quantite must be a number (integer), default 1 if missing\n"
            "- prix_unitaire_ht and prix_total_ht must be numbers (float), null if not found\n"
            "- All monetary values are in MAD, return as plain numbers without currency symbol\n"
            "- If a field is not found in the document, use null\n"
            "- Do NOT truncate designations\n\n"
            "DOCUMENT:\n"
            f"{raw_text}"
        )

        try:
            response = requests.post(
                cls.BASE_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://fmpdf.local",
                },
                json={
                    "model": getattr(settings, "OPENROUTER_MODEL", "openai/gpt-4o-mini"),
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                },
                timeout=60,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise RuntimeError(f"OpenRouter HTTP error: {exc}") from exc

        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)

        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            logger.error("OpenRouter returned invalid JSON: %s", content[:500])
            raise RuntimeError(f"Invalid JSON from LLM: {exc}") from exc
