import base64
import json
import logging
import re
from typing import Dict, Any
import requests
from fastapi import HTTPException
from app.config import Settings
from app.schemas import ReceiptSchema, LineItem

logger = logging.getLogger("chaoticSplitter.ocr")

RECEIPT_PARSE_PROMPT = """You are an accurate receipt OCR extraction system.
Analyze the provided receipt image and extract the bill details into strict JSON.

Strict Requirements:
1. Output ONLY a valid JSON object matching the schema below. No conversational explanations or markdown text.
2. The JSON structure MUST be exactly:
{
  "merchant_name": "Name of the restaurant/merchant (or 'Restaurant' if not legible)",
  "currency": "INR",
  "items": [
    {
      "item_id": 1,
      "name": "Item Name",
      "quantity": 1,
      "total_price": 100.0
    }
  ],
  "subtotal": 100.0,
  "tax_total": 5.0,
  "service_charge_or_tip": 0.0,
  "discount_total": 0.0,
  "grand_total": 105.0
}
3. 'items' must be a list with sequential integer item_id starting from 1.
4. Ensure 'total_price' for each item is a number (quantity * unit price).
5. If tax or tip is not mentioned on receipt, set to 0.0.
6. If the image does not contain legible receipt items, return an empty items list with merchant_name 'Unrecognized Receipt' and zero totals. Never return apologies or explanations.
"""

def parse_receipt_image(image_bytes: bytes, filename: str = "receipt.jpg") -> ReceiptSchema:
    """
    Parses a receipt image using Ollama Cloud with the multimodal vision model (default gemma4:31b).
    Returns a validated ReceiptSchema object.
    """
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty receipt image uploaded")

    ollama_api_key = Settings.OLLAMA_API_KEY
    ollama_host = Settings.OLLAMA_BASE_URL if ollama_api_key else "http://127.0.0.1:11434"
    model_name = Settings.OCR_MODEL or "gemma4:31b"

    # Encode image bytes to base64 string
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        url = f"{ollama_host.rstrip('/')}/api/chat"
        headers = {"Content-Type": "application/json"}
        if ollama_api_key:
            headers["Authorization"] = f"Bearer {ollama_api_key}"

        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": RECEIPT_PARSE_PROMPT,
                    "images": [image_base64],
                }
            ],
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.1,
            }
        }

        response = requests.post(url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        data = response.json()
        
        message = data.get("message", {})
        raw_output = message.get("content", "").strip() or data.get("response", "").strip()

        # Extract JSON block
        json_match = re.search(r"\{[\s\S]*\}", raw_output)
        cleaned = json_match.group(0) if json_match else raw_output

        parsed = json.loads(cleaned)

        # Parse and sanitize line items
        raw_items = parsed.get("items", [])
        items = []
        computed_subtotal = 0.0

        for idx, it in enumerate(raw_items, start=1):
            name = str(it.get("name", f"Item {idx}")).strip() or f"Item {idx}"
            try:
                qty = int(it.get("quantity", 1))
            except (ValueError, TypeError):
                qty = 1
            try:
                price = float(it.get("total_price", 0.0))
            except (ValueError, TypeError):
                price = 0.0

            computed_subtotal += price
            items.append(LineItem(
                item_id=idx,
                name=name,
                quantity=max(1, qty),
                total_price=round(price, 2)
            ))

        subtotal = float(parsed.get("subtotal") or computed_subtotal)
        tax_total = float(parsed.get("tax_total", 0.0) or 0.0)
        tip = float(parsed.get("service_charge_or_tip", 0.0) or 0.0)
        discount = float(parsed.get("discount_total", 0.0) or 0.0)
        grand_total = float(parsed.get("grand_total") or (subtotal + tax_total + tip - discount))

        return ReceiptSchema(
            merchant_name=str(parsed.get("merchant_name", "Restaurant")).strip() or "Restaurant",
            currency=str(parsed.get("currency", "INR")).strip() or "INR",
            items=items,
            subtotal=round(subtotal, 2),
            tax_total=round(tax_total, 2),
            service_charge_or_tip=round(tip, 2),
            discount_total=round(discount, 2),
            grand_total=round(grand_total, 2)
        )

    except requests.exceptions.RequestException as req_err:
        logger.error(f"Failed to communicate with Ollama OCR ({model_name}): {req_err}")
        raise HTTPException(
            status_code=502,
            detail=f"Ollama OCR service unreachable at {ollama_host}. Ensure Ollama is running with '{model_name}'."
        )
    except json.JSONDecodeError as json_err:
        logger.error(f"Ollama OCR did not return valid JSON: {json_err}")
        raise HTTPException(
            status_code=500,
            detail=f"OCR model '{model_name}' returned unparseable output."
        )
    except Exception as exc:
        logger.error(f"Unexpected error in OCR extraction: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Receipt OCR failed: {str(exc)}"
        )
