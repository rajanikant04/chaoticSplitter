import json
import logging
import re
from typing import List, Dict, Any
import requests
from app.config import Settings
from app.schemas import SplitPlanRequest, VoiceSplitPlan, ItemShare

logger = logging.getLogger("chaoticSplitter.split_service")

SPLIT_PLAN_PROMPT_TEMPLATE = """You are an intelligent restaurant bill split reasoner.
Map each line item from the receipt to the participants who ordered or consumed it, based on the user's instructions.

Receipt Items:
{receipt_items_json}

Group Members:
{members_list}

User Instructions:
"{instructions}"

Unmentioned Items Policy:
{unclaimed_rule} (Default: If an item on the receipt is not mentioned, split it equally among all participants with weight 1.0)

Strict Requirements:
1. Output ONLY a valid JSON object matching the schema below. No markdown fences or conversational explanations.
2. The JSON structure MUST be exactly:
{{
  "participants": ["Member1", "Member2"],
  "allocations": [
    {{"item_id": 1, "person": "Member1", "weight": 1.0}},
    {{"item_id": 1, "person": "Member2", "weight": 1.0}}
  ],
  "unclaimed_rule": "{unclaimed_rule}",
  "reasoning_summary": "1-2 sentence human-readable summary of how the dishes were mapped"
}}
3. For every receipt item, allocate to the consumers mentioned. If shared, give equal weight 1.0 to each sharer.
4. If an item is unmentioned in instructions, allocate to all participants with weight 1.0 under split_all policy.
5. All participant names must be capitalized and match the group members (or new participants mentioned in instructions).
6. 'item_id' MUST match the integer ID from the Receipt Items.
"""

def generate_split_plan_with_gemma(request: SplitPlanRequest) -> VoiceSplitPlan:
    """
    Calls Gemma 4 (gemma4:31b) on Ollama Cloud to reason over receipt line items
    and conversational instructions to produce a structured VoiceSplitPlan.
    Falls back gracefully to a deterministic equal split if an error occurs.
    """
    receipt = request.receipt
    instructions = (request.instructions or "").strip()
    members = [m.strip().capitalize() for m in request.members if m.strip()]
    unclaimed_rule = request.unclaimed_rule or "split_all"

    # Default fallback members if none passed
    if not members:
        members = ["Alice", "Bob"]

    # If no instructions given, perform immediate deterministic equal split
    if not instructions:
        return _fallback_equal_split(receipt, members, unclaimed_rule, "Split all receipt items equally among all group members.")

    ollama_api_key = Settings.OLLAMA_API_KEY
    ollama_host = Settings.OLLAMA_HOST if ollama_api_key else "http://127.0.0.1:11434"
    model_name = Settings.OLLAMA_MODEL or "gemma4:31b"

    # Format receipt items for prompt
    items_summary = [
        {
            "item_id": it.item_id,
            "name": it.name,
            "quantity": it.quantity,
            "total_price": it.total_price
        }
        for it in receipt.items
    ]

    prompt = SPLIT_PLAN_PROMPT_TEMPLATE.format(
        receipt_items_json=json.dumps(items_summary, indent=2),
        members_list=", ".join(members),
        instructions=instructions,
        unclaimed_rule=unclaimed_rule
    )

    try:
        url = f"{ollama_host.rstrip('/')}/api/chat"
        headers = {"Content-Type": "application/json"}
        if ollama_api_key:
            headers["Authorization"] = f"Bearer {ollama_api_key}"

        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.1}
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

        raw_participants = parsed.get("participants", members)
        participants = [p.strip().capitalize() for p in raw_participants if p and isinstance(p, str)]
        if not participants:
            participants = members

        # Validate allocations
        valid_item_ids = {it.item_id for it in receipt.items}
        raw_allocations = parsed.get("allocations", [])
        allocations = []
        seen_pairs = set()

        for alloc in raw_allocations:
            try:
                item_id = int(alloc.get("item_id"))
                person = str(alloc.get("person", "")).strip().capitalize()
                weight = float(alloc.get("weight", 1.0))
            except (ValueError, TypeError):
                continue

            if item_id in valid_item_ids and person:
                pair_key = (item_id, person)
                if pair_key not in seen_pairs:
                    seen_pairs.add(pair_key)
                    allocations.append(ItemShare(item_id=item_id, person=person, weight=max(0.1, weight)))

        # Ensure all items have at least one allocation (apply unclaimed rule)
        allocated_item_ids = {a.item_id for a in allocations}
        unallocated_item_ids = valid_item_ids - allocated_item_ids
        for missing_id in unallocated_item_ids:
            if unclaimed_rule == "payer_only" and participants:
                allocations.append(ItemShare(item_id=missing_id, person=participants[0], weight=1.0))
            else:
                for p in participants:
                    allocations.append(ItemShare(item_id=missing_id, person=p, weight=1.0))

        reasoning_summary = str(parsed.get("reasoning_summary", "")).strip() or "Mapped items to consumers based on your instructions."

        return VoiceSplitPlan(
            participants=participants,
            allocations=allocations,
            unclaimed_rule=unclaimed_rule,
            reasoning_summary=reasoning_summary
        )

    except Exception as e:
        logger.warning(f"Gemma 4 split plan generation failed ({e}), falling back to deterministic equal split")
        return _fallback_equal_split(receipt, members, unclaimed_rule, f"Equal split fallback: {instructions[:60]}...")


def _fallback_equal_split(receipt, members: List[str], unclaimed_rule: str, summary: str) -> VoiceSplitPlan:
    """Deterministic fallback: allocates every receipt item equally to all group members."""
    allocations = []
    for it in receipt.items:
        for m in members:
            allocations.append(ItemShare(item_id=it.item_id, person=m, weight=1.0))

    return VoiceSplitPlan(
        participants=members,
        allocations=allocations,
        unclaimed_rule=unclaimed_rule,
        reasoning_summary=summary
    )
