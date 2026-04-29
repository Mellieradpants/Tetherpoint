"""Meaning layer: the ONLY AI interpretation layer.

Meaning operates on Rule Units, not raw atomic Structure nodes. Atomic nodes
remain traceability units underneath the Rule Unit.
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
    RuleUnit,
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


def _verification_for_unit(
    verification_result: VerificationResult | None,
    rule_unit_id: str,
) -> VerificationNodeResult | None:
    if verification_result is None:
        return None
    for result in verification_result.node_results:
        if result.node_id == rule_unit_id:
            return result
    return None


def _missing_information(
    unit: RuleUnit,
    origin_result: OriginResult | None,
    verification_node: VerificationNodeResult | None,
) -> list[str]:
    missing: list[str] = []

    if not unit.source_text_combined.strip():
        missing.append("rule_unit_text")
    if not unit.primary_node_id:
        missing.append("primary_rule")
    if unit.review_status != "ready":
        missing.append("ready_rule_unit")
    if origin_result is None:
        missing.append("origin_context")
    if verification_node is None:
        missing.append("verification_result")

    return missing


def _build_prompt(
    unit: RuleUnit,
    origin_result: OriginResult | None = None,
    verification_node: VerificationNodeResult | None = None,
) -> str:
    context = {
        "rule_unit": _model_dump(unit),
        "origin": _model_dump(origin_result) if origin_result is not None else None,
        "verification": _model_dump(verification_node) if verification_node is not None else None,
        "candidate_missing_information": _missing_information(unit, origin_result, verification_node),
    }

    return (
        "You are the constrained Meaning layer for a source-anchored public explanation pipeline. "
        "Analyze exactly one Rule Unit using only the provided deterministic context. "
        "Do not create structure. Do not invent verification. Do not infer motive, intent, "
        "legal advice, political framing, or unsupported outcome. Fail rather than guess.\n\n"
        "Important architecture rule: atomic nodes are traceability units, not interpretation targets. "
        "Explain the Rule Unit as a coherent unit. Use source_node_ids only for traceability. "
        "Do not explain fragment_node_ids independently.\n\n"
        "If assembly_status is not complete or review_status is not ready, return plain_meaning as null "
        "and include a missing_information item explaining why Meaning is blocked or limited.\n\n"
        "Your job is to explain what the Rule Unit means in everyday public language. "
        "Use the primary text, conditions, exceptions, evidence requirements, timing, jurisdiction, "
        "mechanisms, origin signals, and verification routing only as read-only grounding.\n\n"
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
        "- Do not copy the source sentence with only small word changes.\n"
        "- Do not add extra claims beyond the Rule Unit.\n"
        "- Do not use internal system words in plain_meaning.\n"
        "- Banned in plain_meaning: node, rule unit, operational, operationally, operational effect, indicates, the text indicates, engage, facilitate, utilize, affected actor, process can proceed.\n\n"
        "Output requirements:\n"
        "- Return ONLY valid JSON.\n"
        "- Do not include markdown fences or text outside JSON.\n"
        "- Return one top-level JSON object with exactly these keys: detected_scopes, plain_meaning, scope_details, missing_information, lenses.\n"
        "- detected_scopes must be an array of scope names from the allowed list, only when supported by the Rule Unit.\n"
        "- plain_meaning must be one or two short public-language sentences, or null only if the Rule Unit is not safe to explain.\n"
        "- scope_details must be an array of objects with scope, detail, and evidence. Include only detected scopes.\n"
        "- missing_information must be an array of short strings.\n"
        "- lenses must be an array of objects with lens, detected, and detail for all six scopes.\n"
        "- Do not mark missing origin or verification context as insufficient if the Rule Unit itself supports a plain explanation.\n\n"
        "Example output:\n"
        "{"
        "\"detected_scopes\":[\"modality_shift\"],"
        "\"plain_meaning\":\"The agency has 30 days to update the public list after it approves the rule.\","
        "\"scope_details\":["
        "{\"scope\":\"modality_shift\",\"detail\":\"The rule creates a required action.\",\"evidence\":\"shall update\"}"
        "],"
        "\"missing_information\":[],"
        "\"lenses\":["
        "{\"lens\":\"modality_shift\",\"detected\":true,\"detail\":\"The rule creates a required action.\"},"
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


def _build_error_result(unit: RuleUnit, error: str, message: str | None = None) -> MeaningNodeResult:
    return MeaningNodeResult(
        node_id=unit.rule_unit_id,
        source_text=unit.source_text_combined,
        status="error",
        error=error,
        message=message,
        lenses=[],
        missing_information=unit.assembly_issues,
    )


def process_meaning(
    rule_units: list[RuleUnit],
    run: bool = True,
    origin_result: OriginResult | None = None,
    verification_result: VerificationResult | None = None,
) -> MeaningResult:
    """Process Meaning for rule units. AI layer."""
    if not run:
        return MeaningResult(
            status="skipped",
            message="Meaning layer skipped by options",
        )

    node_results: list[MeaningNodeResult] = []

    for unit in rule_units:
        if not unit.meaning_eligible:
            node_results.append(_build_error_result(
                unit,
                "rule_unit_not_meaning_eligible",
                "Rule unit was not safe to explain independently.",
            ))
            continue

        verification_node = _verification_for_unit(verification_result, unit.rule_unit_id)
        prompt = _build_prompt(
            unit,
            origin_result=origin_result,
            verification_node=verification_node,
        )
        raw = _call_openai(prompt)

        if isinstance(raw, dict) and "error" in raw:
            node_results.append(
                MeaningNodeResult(
                    node_id=unit.rule_unit_id,
                    source_text=unit.source_text_combined,
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
                    node_id=unit.rule_unit_id,
                    source_text=unit.source_text_combined,
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
                    node_id=unit.rule_unit_id,
                    source_text=unit.source_text_combined,
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
                    node_id=unit.rule_unit_id,
                    source_text=unit.source_text_combined,
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
                node_id=unit.rule_unit_id,
                source_text=unit.source_text_combined,
                status="executed",
                lenses=lenses,
                detected_scopes=detected_scopes,
                plain_meaning=plain_meaning,
                scope_details=scope_details,
                missing_information=missing_information,
            )
        )

    return MeaningResult(status="executed", node_results=node_results)
