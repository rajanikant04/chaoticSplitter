import json
import logging
import re
from typing import List, Dict, Any
import requests
from app.config import Settings

logger = logging.getLogger("chaoticSplitter.gemma")

GROUP_EXTRACTION_PROMPT = """You are a precise JSON extractor.
Extract the group/event name and the list of participant names from the user's spoken voice transcript.

Strict Requirements:
1. Output ONLY a valid JSON object. Do not include markdown codeblocks or conversational text.
2. The JSON structure MUST be exactly:
{{
  "group_name": "Name of the trip, event, or hangout",
  "members": ["Friend1", "Friend2"]
}}
3. Each member name must be capitalized.
4. Extract ONLY people names, never generic words like "friends", "trip", "and", "everyone".
5. If at least 2 distinct friends cannot be found, provide meaningful defaults or the names mentioned.
6. If the user is saying as he is included in the splitting process, then the user is also a member of the group. Use the "User" member name for the user.

Transcript: "{transcript}"
"""

def extract_group_with_gemma(transcript: str) -> Dict[str, Any]:
    """
    Calls Ollama Cloud API with Gemma 4 (gemma4:31b) to extract group_name and members from a transcript.
    Falls back gracefully to clean rule-based extraction if unconfigured or error occurs.
    """
    if not transcript or not transcript.strip():
        return {"group_name": "Weekend Hangout", "members": ["Alice", "Bob"]}

    ollama_api_key = Settings.OLLAMA_API_KEY
    ollama_host = Settings.OLLAMA_BASE_URL
    model_name = Settings.OLLAMA_MODEL or "gemma4:31b"

    try:
        url = f"{ollama_host.rstrip('/')}/api/chat"
        headers = {"Content-Type": "application/json"}
        if ollama_api_key:
            headers["Authorization"] = f"Bearer {ollama_api_key}"

        prompt = GROUP_EXTRACTION_PROMPT.format(transcript=transcript)

        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.1,
            }
        }

        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        
        message = data.get("message", {})
        raw_output = (message.get("content", "") if isinstance(message, dict) else "").strip() or str(data.get("response", "")).strip()

        # Extract JSON block
        json_match = re.search(r"\{[\s\S]*\}", raw_output)
        cleaned = json_match.group(0) if json_match else raw_output

        parsed = json.loads(cleaned)
        group_name = parsed.get("group_name", "Weekend Hangout").strip() or "Weekend Hangout"
        members = [m.strip().capitalize() for m in parsed.get("members", []) if m and isinstance(m, str)]
        
        # Deduplicate preserving order
        seen = set()
        unique_members = [m for m in members if not (m.lower() in seen or seen.add(m.lower()))]

        if len(unique_members) >= 2:
            return {"group_name": group_name, "members": unique_members}
    except Exception as e:
        logger.warning(f"Ollama Cloud extraction failed, falling back to rule-based parser: {e}")

    # Fallback heuristic parser
    return _heuristic_group_parser(transcript)


def _heuristic_group_parser(text: str) -> Dict[str, Any]:
    """Rule-based fallback when Ollama is unavailable."""
    lower = text.lower()
    group_name = "Weekend Hangout"
    names_part = text

    if "with" in lower:
        idx = lower.find("with")
        before_with = text[:idx].strip()
        if before_with:
            group_name = before_with.title()
        names_part = text[idx + 4:]

    # Clean words
    extracted = re.split(r"\band\b|,|\s+", names_part)
    filtered = [
        w.capitalize() for w in extracted
        if len(w) > 1 and w.lower() not in {"a", "the", "my", "our", "friends", "trip", "group", "dinner", "lunch", "with"}
    ]

    seen = set()
    members = [m for m in filtered if not (m.lower() in seen or seen.add(m.lower()))]
    if len(members) < 2:
        members = ["Alice", "Bob"]

    return {"group_name": group_name, "members": members}
