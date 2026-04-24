"""Meaning layer: the ONLY AI interpretation layer.

Operates only on selected nodes. If no API key is available,
returns explicit 'meaning not executed' status.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from app.schemas.models import (
    MeaningLens,
    MeaningNodeResult,
    MeaningResult,
    StructureNode,
)

logger = logging.getLogger("tetherpoint.meaning")

LENSES = [
    "modality_shift",
    "scope_change",
    "actor_power_shift",
    "action_domain_shift",
    "threshold_standard_shift",
    "obligation_removal",
]
VALID_LENSES = set(LENSES)


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
        "Output requirements:\n"
        "- Return ONLY valid JSON.\n"
        "- Do not include markdown fences.\n"
        "- Do not include explanatory text.\n"
        "- Return a top-level JSON array.\n"
        "- Each array item must be an object with exactly these keys: lens, detected, detail.\n"
        "- 'lens' must be one of: modality_shift, scope_change, actor_power_shift, "
        "action_domain_shift, threshold_standard_shift, obligation_removal.\n"
        "- 'detected' must be true or false.\n"
        "- 'detail' must be a string or null.\n\n"
        "Example output:\n"
        "["
        "{\"lens\":\"modality_shift\",\"detected\":false,\"detail\":null},"
        "{\"lens\":\"scope_change\",\"detected\":true,\"detail\":\"Scope is narrowed to interstate operators only\"}"
        "]"
    )


def _normalize_lens_payload(content: str) -> list[dict[str, Any]] | dict[str, str]:
    """Parse model output into the expected lens list."""
    cleaned = content.strip()
    candidates: list[str] = []

    def add_candidate(value: str) -> None:
        value = value.strip()
        if value and value not in candidates:
            candidates.append(value)

    add_candidate(cleaned)

    if "```" in cleaned:
        fenced_blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", cleaned, flags=re.I)
        for block in fenced_blocks:
            add_candidate(block)

    bracket_match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", cleaned)
    if bracket_match:
        add_candidate(bracket_match.group(1))

    def repair_json(value: str) -> str:
        repaired = value.strip()
        repaired = repaired.replace("\u201c", '"').replace("\u201d", '"')
        repaired = repaired.replace("\u2018", "'").replace("\u2019", "'")
        repaired = re.sub(r",(\s*[\]}])", r"\1", repaired)
        if "'" in repaired and '"' not in repaired:
            repaired = repaired.replace("'", '"')
        return repaired

    last_error: Exception | None = None
    payload: Any = None
    parsed = False

    for candidate in candidates:
        for attempt in (candidate, repair_json(candidate)):
            try:
                payload = json.loads(attempt)
                parsed = True
                break
            except json.JSONDecodeError as e:
                last_error = e
        if parsed:
            break

    if not parsed:
        logger.exception("Meaning response JSON decode failed")
        return {
            "status": "error",
            "error": "response_parse_failed",
            "message": (
                f"{type(last_error).__name__}: {last_error}"
                if last_error is not None
                else "Unable to parse model response"
            ),
            "raw_response": content,
        }

    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        lenses = payload.get("lenses")
        if isinstance(lenses, list):
            return lenses

    return {
        "status": "error",
        "error": "response_shape_mismatch",
        "message": f"Unexpected response shape: {type(payload).__name__}",
        "raw_response": content,
    }


def _call_openai(prompt: str) -> list[dict[str, Any]] | dict[str, str]:
    """Call OpenAI-compatible API. Returns parsed lens results or a structured error."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return {
            "status": "error",
            "error": "missing_api_key",
            "message": "OPENAI_API_KEY not set",
        }

    try:
        import httpx
    except ImportError as e:
        logger.exception("Meaning dependency import failed")
        return {
            "status": "error",
            "error": "dependency_import_failed",
            "message": f"{type(e).__name__}: {e}",
        }

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
        response_json = resp.json()
        content = response_json["choices"][0]["message"]["content"]
        return _normalize_lens_payload(content)
    except httpx.HTTPError as e:
        logger.exception("Meaning API HTTP failure")
        return {
            "status": "error",
            "error": "api_http_error",
            "message": f"{type(e).__name__}: {e}",
        }
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
        logger.exception("Meaning API response shape failure")
        return {
            "status": "error",
            "error": "api_response_shape_error",
            "message": f"{type(e).__name__}: {e}",
            "raw_response": json.dumps(response_json) if "response_json" in locals() else None,
        }
    except Exception as e:
        logger.exception("Meaning API failure")
        return {
            "status": "error",
            "error": "api_runtime_error",
            "message": f"{type(e).__name__}: {e}",
        }


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

    node_results: list[MeaningNodeResult] = []

    for node in selected_nodes:
        prompt = _build_prompt(node)
        raw = _call_openai(prompt)

        if isinstance(raw, dict) and "error" in raw:
            node_results.append(
                MeaningNodeResult(
                    node_id=node.node_id,
                    source_text=node.source_text,
                    status="error",
                    error=raw["error"],
                    message=raw.get("message"),
                    raw_response=raw.get("raw_response"),
                    lenses=[],
                )
            )
            continue

        if not raw:
            node_results.append(
                MeaningNodeResult(
                    node_id=node.node_id,
                    source_text=node.source_text,
                    status="empty",
                    message="No meaning output returned",
                    lenses=[],
                )
            )
            continue

        lenses: list[MeaningLens] = []
        for item in raw:
            if not isinstance(item, dict):
                node_results.append(
                    MeaningNodeResult(
                        node_id=node.node_id,
                        source_text=node.source_text,
                        status="error",
                        error="lens_item_shape_mismatch",
                        message=f"Unexpected lens item shape: {type(item).__name__}",
                        raw_response=json.dumps(raw),
                        lenses=[],
                    )
                )
                break

            lens_name = item.get("lens")
            if lens_name not in VALID_LENSES:
                node_results.append(
                    MeaningNodeResult(
                        node_id=node.node_id,
                        source_text=node.source_text,
                        status="error",
                        error="lens_name_invalid",
                        message=f"Unexpected lens name: {lens_name!r}",
                        raw_response=json.dumps(raw),
                        lenses=[],
                    )
                )
                break

            lenses.append(
                MeaningLens(
                    lens=lens_name,
                    detected=bool(item.get("detected", False)),
                    detail=item.get("detail"),
                )
            )
        else:
            node_results.append(
                MeaningNodeResult(
                    node_id=node.node_id,
                    source_text=node.source_text,
                    status="executed",
                    lenses=lenses,
                )
            )

    return MeaningResult(status="executed", node_results=node_results)
