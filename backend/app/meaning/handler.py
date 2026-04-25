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
    MeaningScopeDetail,
    OriginResult,
    StructureNode,
    VerificationNodeResult,
    VerificationResult,
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


def _model_dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value


def _verification_for_node(
    verification_result: VerificationResult | None,
    node_id: str,
) -> VerificationNodeResult | None:
    if verification_result is None:
        return None
    for result in verification_result.node_results:
        if result.node_id == node_id:
            return result
    return None


def _missing_information(
    node: StructureNode,
    origin_result: OriginResult | None,
    verification_node: VerificationNodeResult | None,
) -> list[str]:
    """Return source-grounding gaps that may limit Meaning output.

    These are prompts for the Meaning layer, not automatic insufficiency labels.
    Origin and Verification gaps are grounding gaps only; they should not by
    themselves suppress a source-text-supported plain explanation.
    """
    missing: list[str] = []

    if not (node.source_text or "").strip():
        missing.append("selected_node_text")
    if not any([node.actor, node.who]):
        missing.append("explicit_actor_or_affected_party")
    if not any([node.action, node.what]):
        missing.append("explicit_action_or_requirement")
    if origin_result is None:
        missing.append("origin_context")
    if verification_node is None:
        missing.append("verification_result")

    return missing


def _build_prompt(
    node: StructureNode,
    origin_result: OriginResult | None = None,
    verification_node: VerificationNodeResult | None = None,
) -> str:
    context = {
        "node": {
            "node_id": node.node_id,
            "section_id": node.section_id,
            "parent_id": node.parent_id,
            "role": node.role,
            "depth": node.depth,
            "source_anchor": node.source_anchor,
            "source_text": node.source_text,
            "normalized_text": node.normalized_text,
            "actor": node.actor,
            "action": node.action,
            "condition": node.condition,
            "temporal": node.temporal,
            "jurisdiction": node.jurisdiction,
            "mechanism": node.mechanism,
            "risk": node.risk,
            "tags": node.tags,
            "blocked_flags": node.blocked_flags,
            "who": node.who,
            "what": node.what,
            "when": node.when,
            "where": node.where,
            "why": node.why,
            "how": node.how,
        },
        "origin": _model_dump(origin_result) if origin_result is not None else None,
        "verification": _model_dump(verification_node) if verification_node is not None else None,
        "candidate_missing_information": _missing_information(node, origin_result, verification_node),
    }

    return (
        "You are the constrained Meaning layer for a source-anchored public explanation pipeline. "
        "Analyze exactly one selected text unit using only the provided deterministic context. "
        "Do not create structure. Do not invent verification. Do not infer motive, intent, "
        "legal advice, political framing, or unsupported outcome. Fail rather than guess.\n\n"
        "Your job is to explain what the selected text means in everyday public language. "
        "Use the selected text, parsed who/what/when/where/how fields, origin signals, "
        "and verification routing only as read-only grounding.\n\n"
        "Context JSON:\n"
        f"{json.dumps(context, ensure_ascii=False, sort_keys=True)}\n\n"
        "Evaluate these Meaning scopes:\n"
        "1. modality_shift - obligation or permission language such as shall, must, may, prohibited, required.\n"
        "2. scope_change - explicit narrowing or expanding of affected people, documents, places, systems, or cases.\n"
        "3. actor_power_shift - explicit assignment, removal, or redistribution of authority among actors.\n"
        "4. action_domain_shift - movement of an action into a domain such as registration, review, records, enforcement, or verification.\n"
        "5. threshold_standard_shift - explicit proof, eligibility, evidence, standard, or review threshold.\n"
        "6. obligation_removal - explicit removal, weakening, or exception from a requirement.\n\n"
        "Plain Meaning style rules:\n"
        "- Write for an eighth-grade reader.\n"
        "- Use one short sentence unless two short sentences are needed.\n"
        "- Explain who does what, when, where, or how.\n"
        "- Say what happens in real life.\n"
        "- Use common words first.\n"
        "- Prefer: approve instead of adopt; use instead of utilize; remove instead of redact; send in instead of submit; show instead of demonstrate; can instead of may; must instead of shall; not allowed to instead of prohibited; person instead of individual.\n"
        "- Do not copy the source sentence with only small word changes.\n"
        "- Do not add extra claims beyond the selected text.\n"
        "- Do not use internal system words in plain_meaning.\n"
        "- Banned in plain_meaning: node, operational, operationally, operational effect, indicates, the text indicates, engage, facilitate, utilize, affected actor, process can proceed.\n\n"
        "Output requirements:\n"
        "- Return ONLY valid JSON.\n"
        "- Do not include markdown fences or text outside JSON.\n"
        "- Return one top-level JSON object with exactly these keys: detected_scopes, plain_meaning, scope_details, missing_information, lenses.\n"
        "- detected_scopes must be an array of scope names from the allowed list, only when supported by the selected text.\n"
        "- plain_meaning must be one or two short public-language sentences, or null only if the selected text is too incomplete to explain.\n"
        "- scope_details must be an array of objects with scope, detail, and evidence. Include only detected scopes.\n"
        "- missing_information must be an array of short strings. Include items only when the selected text lacks details needed for the explanation.\n"
        "- lenses must be an array of objects with lens, detected, and detail for all six scopes, preserving compatibility.\n"
        "- Do not mark missing origin or verification context as insufficient if the selected text itself supports a plain explanation.\n"
        "- If no scopes are detected but the selected text is still clear, detected_scopes and scope_details may be empty and plain_meaning should explain the explicit meaning.\n\n"
        "Example output:\n"
        "{"
        "\"detected_scopes\":[\"modality_shift\"],"
        "\"plain_meaning\":\"The agency has 30 days to update the public list after it approves the rule.\","
        "\"scope_details\":["
        "{\"scope\":\"modality_shift\",\"detail\":\"The text creates a required action.\",\"evidence\":\"shall update\"}"
        "],"
        "\"missing_information\":[],"
        "\"lenses\":["
        "{\"lens\":\"modality_shift\",\"detected\":true,\"detail\":\"The text creates a required action.\"},"
        "{\"lens\":\"scope_change\",\"detected\":false,\"detail\":null},"
        "{\"lens\":\"actor_power_shift\",\"detected\":false,\"detail\":null},"
        "{\"lens\":\"action_domain_shift\",\"detected\":false,\"detail\":null},"
        "{\"lens\":\"threshold_standard_shift\",\"detected\":false,\"detail\":null},"
        "{\"lens\":\"obligation_removal\",\"detected\":false,\"detail\":null}"
        "]}"
    )


def _parse_json_payload(content: str) -> Any | dict[str, str]:
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
    for candidate in candidates:
        for attempt in (candidate, repair_json(candidate)):
            try:
                return json.loads(attempt)
            except json.JSONDecodeError as e:
                last_error = e

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


def _as_string_list(value: Any, allowed: set[str] | None = None) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        item = item.strip()
        if not item:
            continue
        if allowed is not None and item not in allowed:
            continue
        if item not in result:
            result.append(item)
    return result


def _normalize_meaning_payload(content: str) -> dict[str, Any] | dict[str, str]:
    """Parse model output into the Meaning Buddy object contract."""
    payload = _parse_json_payload(content)
    if isinstance(payload, dict) and "error" in payload:
        return payload

    if isinstance(payload, list):
        detected_scopes = [
            item.get("lens")
            for item in payload
            if isinstance(item, dict)
            and item.get("lens") in VALID_LENSES
            and bool(item.get("detected", False))
        ]
        return {
            "detected_scopes": detected_scopes,
            "plain_meaning": None,
            "scope_details": [
                {
                    "scope": item.get("lens"),
                    "detail": item.get("detail"),
                    "evidence": None,
                }
                for item in payload
                if isinstance(item, dict)
                and item.get("lens") in VALID_LENSES
                and bool(item.get("detected", False))
            ],
            "missing_information": ["plain_meaning"],
            "lenses": payload,
        }

    if isinstance(payload, dict):
        return payload

    return {
        "status": "error",
        "error": "response_shape_mismatch",
        "message": f"Unexpected response shape: {type(payload).__name__}",
        "raw_response": content,
    }


def _call_openai(prompt: str) -> dict[str, Any] | dict[str, str]:
    """Call OpenAI-compatible API. Returns parsed meaning output or a structured error."""
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
        return _normalize_meaning_payload(content)
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


def _coerce_lenses(raw_lenses: Any) -> list[MeaningLens] | dict[str, str]:
    if not isinstance(raw_lenses, list):
        return {
            "error": "lenses_shape_mismatch",
            "message": f"Expected lenses list, received {type(raw_lenses).__name__}",
        }

    lenses: list[MeaningLens] = []
    for item in raw_lenses:
        if not isinstance(item, dict):
            return {
                "error": "lens_item_shape_mismatch",
                "message": f"Unexpected lens item shape: {type(item).__name__}",
            }

        lens_name = item.get("lens")
        if lens_name not in VALID_LENSES:
            return {
                "error": "lens_name_invalid",
                "message": f"Unexpected lens name: {lens_name!r}",
            }

        detail = item.get("detail")
        lenses.append(
            MeaningLens(
                lens=lens_name,
                detected=bool(item.get("detected", False)),
                detail=detail if isinstance(detail, str) else None,
            )
        )

    return lenses


def _coerce_scope_details(value: Any) -> list[MeaningScopeDetail]:
    if not isinstance(value, list):
        return []

    details: list[MeaningScopeDetail] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        scope = item.get("scope")
        if scope not in VALID_LENSES:
            continue
        detail = item.get("detail")
        evidence = item.get("evidence")
        details.append(
            MeaningScopeDetail(
                scope=scope,
                detail=detail if isinstance(detail, str) else None,
                evidence=evidence if isinstance(evidence, str) else None,
            )
        )
    return details


def process_meaning(
    selected_nodes: list[StructureNode],
    run: bool = True,
    origin_result: OriginResult | None = None,
    verification_result: VerificationResult | None = None,
) -> MeaningResult:
    """Process meaning for selected nodes. AI layer."""
    if not run:
        return MeaningResult(
            status="skipped",
            message="Meaning layer skipped by options",
        )

    node_results: list[MeaningNodeResult] = []

    for node in selected_nodes:
        verification_node = _verification_for_node(verification_result, node.node_id)
        prompt = _build_prompt(
            node,
            origin_result=origin_result,
            verification_node=verification_node,
        )
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

        lenses = _coerce_lenses(raw.get("lenses"))
        if isinstance(lenses, dict):
            node_results.append(
                MeaningNodeResult(
                    node_id=node.node_id,
                    source_text=node.source_text,
                    status="error",
                    error=lenses["error"],
                    message=lenses.get("message"),
                    raw_response=json.dumps(raw),
                    lenses=[],
                )
            )
            continue

        detected_scopes = _as_string_list(raw.get("detected_scopes"), VALID_LENSES)
        if not detected_scopes:
            detected_scopes = [lens.lens for lens in lenses if lens.detected]

        plain_meaning = raw.get("plain_meaning")
        if not isinstance(plain_meaning, str) or not plain_meaning.strip():
            plain_meaning = None

        scope_details = _coerce_scope_details(raw.get("scope_details"))
        missing_information = _as_string_list(raw.get("missing_information"))

        if plain_meaning is None and not missing_information:
            node_results.append(
                MeaningNodeResult(
                    node_id=node.node_id,
                    source_text=node.source_text,
                    status="error",
                    error="plain_meaning_missing",
                    message="Meaning response did not include plain_meaning or missing_information",
                    raw_response=json.dumps(raw),
                    lenses=lenses,
                    detected_scopes=detected_scopes,
                    scope_details=scope_details,
                )
            )
            continue

        node_results.append(
            MeaningNodeResult(
                node_id=node.node_id,
                source_text=node.source_text,
                status="executed",
                lenses=lenses,
                detected_scopes=detected_scopes,
                plain_meaning=plain_meaning,
                scope_details=scope_details,
                missing_information=missing_information,
            )
        )

    return MeaningResult(status="executed", node_results=node_results)
