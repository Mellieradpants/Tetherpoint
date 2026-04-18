"""Meaning layer: the ONLY AI interpretation layer.

Operates only on selected nodes. If no API key is available,
returns explicit 'meaning not executed' status.
"""

from __future__ import annotations

import json
import os
from typing import Optional

from app.schemas.models import (
    MeaningLens,
    MeaningNodeResult,
    MeaningResult,
    StructureNode,
)

LENSES = [
    "modality_shift",
    "scope_change",
    "actor_power_shift",
    "action_domain_shift",
    "threshold_standard_shift",
    "obligation_removal",
]


def _build_prompt(node: StructureNode) -> str:
    return (
        "You are a precise analytical system. Given the following text extracted from a document, "
        "evaluate it against each of the following lenses. For each lens, respond with a JSON object "
        "containing 'lens', 'detected' (boolean), and 'detail' (string or null).\n\n"
        f'Text: "{node.source_text}"\n\n'
        "Lenses to evaluate:\n"
        "1. modality_shift - Does the text shift obligation modality (e.g., 'shall' to 'may')?\n"
        "2. scope_change - Does the text narrow or expand scope relative to its apparent domain?\n"
        "3. actor_power_shift - Does the text redistribute authority or power among actors?\n"
        "4. action_domain_shift - Does the text move an action into a different domain?\n"
        "5. threshold_standard_shift - Does the text raise or lower a threshold or standard?\n"
        "6. obligation_removal - Does the text remove or weaken an obligation?\n\n"
        "Respond ONLY with a JSON array of objects, one per lens. No extra text."
    )


def _call_openai(prompt: str, api_key: str) -> Optional[list[dict]]:
    """Call OpenAI-compatible API. Returns parsed lens results or None on failure."""
    try:
        import httpx
    except ImportError:
        return None

    try:
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        print(f"Meaning API failure: {type(e).__name__}: {e}")
        return None


def process_meaning(
    selected_nodes: list[StructureNode],
    run: bool = True,
) -> MeaningResult:
    """Process meaning for selected nodes. AI layer."""
    if not run:
        return MeaningResult(
            status="skipped",
            message="Meaning layer skipped by options",
        )

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return MeaningResult(
            status="skipped",
            message="Meaning not executed: no OPENAI_API_KEY configured",
        )

    node_results: list[MeaningNodeResult] = []

    for node in selected_nodes:
        prompt = _build_prompt(node)
        raw = _call_openai(prompt, api_key)

        if raw is None:
            lenses = [
                MeaningLens(lens=l, detected=False, detail="API call failed")
                for l in LENSES
            ]
        else:
            lenses = []
            for item in raw:
                lenses.append(
                    MeaningLens(
                        lens=item.get("lens", "unknown"),
                        detected=bool(item.get("detected", False)),
                        detail=item.get("detail"),
                    )
                )

        node_results.append(
            MeaningNodeResult(
                node_id=node.node_id,
                source_text=node.source_text,
                lenses=lenses,
            )
        )

    return MeaningResult(status="executed", node_results=node_results)
