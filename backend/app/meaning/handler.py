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
    MeaningNodeResult,
    MeaningResult,
    OriginResult,
    RuleUnit,
    VerificationResult,
)

logger = logging.getLogger("tetherpoint.meaning")


def _model_dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value


def _build_document_summary_prompt(
    rule_units: list[RuleUnit],
    origin_result: OriginResult | None = None,
) -> str:
    # Default Meaning must stay fast: one document-level synthesis call.
    # Rule units provide structure and traceability; they are not each sent to AI by default.
    summary_context = []

    for unit in rule_units:
        if not unit.meaning_eligible:
            continue
        summary_context.append({
            "rule_unit_id": unit.rule_unit_id,
            "section_id": unit.section_id,
            "primary_text": unit.primary_text,
            "conditions": [_model_dump(item) for item in unit.conditions],
            "exceptions": [_model_dump(item) for item in unit.exceptions],
            "evidence_requirements": [_model_dump(item) for item in unit.evidence_requirements],
            "consequences": [_model_dump(item) for item in unit.consequences],
            "definitions": [_model_dump(item) for item in unit.definitions],
            "timing": [_model_dump(item) for item in unit.timing],
            "jurisdiction": [_model_dump(item) for item in unit.jurisdiction],
            "mechanisms": [_model_dump(item) for item in unit.mechanisms],
            "source_text_combined": unit.source_text_combined,
            "source_node_ids": unit.source_node_ids,
        })

    context = {
        "rule_units": summary_context,
        "origin": _model_dump(origin_result) if origin_result is not None else None,
    }

    return (
        "You are the document-level Meaning layer for a source-anchored legislative parsing pipeline. "
        "Synthesize the provided rule units into one concise public explanation. "
        "Do not classify scopes. Do not use shift labels. Do not list every rule unit. "
        "Do not repeat the same requirement over and over. Group repeated ideas into one explanation.\n\n"
        "Architecture rule: rule units are coherent interpretation units. Atomic nodes are traceability units. "
        "Use source_node_ids only as internal trace references; do not mention them in the public explanation.\n\n"
        "Your job: explain what this document or section is mainly doing in plain language. "
        "Mention major referenced laws or acts if they are central to the text. "
        "Do not provide legal advice. Do not add claims beyond the provided rule units.\n\n"
        "Context JSON:\n"
        f"{json.dumps(context, ensure_ascii=False, sort_keys=True)}\n\n"
        "Output requirements:\n"
        "- Return ONLY valid JSON.\n"
        "- Return one object with exactly these keys: overall_plain_meaning, summary_missing_information.\n"
        "- overall_plain_meaning must be one or two short paragraphs.\n"
        "- summary_missing_information must be an array of short strings, empty if nothing important is missing.\n\n"
        "Example output:\n"
        "{\"overall_plain_meaning\":\"This section is mainly about voter registration and proof of citizenship. It explains what kinds of documents can count as proof, when an applicant must show them, and which election officials receive them.\",\"summary_missing_information\":[]}"
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


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        item = item.strip()
        if item and item not in result:
            result.append(item)
    return result


def _normalize_meaning_payload(content: str) -> dict[str, Any] | dict[str, str]:
    payload = _parse_json_payload(content)
    if isinstance(payload, dict) and "error" in payload:
        return payload

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


def _build_trace_result(unit: RuleUnit) -> MeaningNodeResult:
    # Rule-unit Meaning is intentionally trace-only in the default path.
    # A future debug/deep mode can add per-rule AI calls behind an explicit option.
    return MeaningNodeResult(
        node_id=unit.rule_unit_id,
        source_text=unit.source_text_combined,
        status="executed",
        lenses=[],
        detected_scopes=[],
        plain_meaning=None,
        scope_details=[],
        missing_information=[] if unit.meaning_eligible else unit.assembly_issues,
    )


def _build_document_summary(
    rule_units: list[RuleUnit],
    origin_result: OriginResult | None,
) -> tuple[str | None, list[str]]:
    usable = [unit for unit in rule_units if unit.meaning_eligible]
    if not usable:
        return None, ["meaning_eligible_rule_units"]

    prompt = _build_document_summary_prompt(rule_units, origin_result=origin_result)
    raw = _call_openai(prompt)

    if isinstance(raw, dict) and "error" in raw:
        return None, [raw.get("message") or raw.get("error") or "summary_generation_failed"]

    summary = raw.get("overall_plain_meaning") if isinstance(raw, dict) else None
    missing = _as_string_list(raw.get("summary_missing_information")) if isinstance(raw, dict) else []

    if not isinstance(summary, str) or not summary.strip():
        return None, missing or ["overall_plain_meaning"]

    return summary.strip(), missing


def process_meaning(
    rule_units: list[RuleUnit],
    run: bool = True,
    origin_result: OriginResult | None = None,
    verification_result: VerificationResult | None = None,
) -> MeaningResult:
    """Process document-level Meaning with one AI call.

    Default Meaning is intentionally document-level to avoid one API call per
    rule unit. Rule units stay available as traceable structure underneath.
    """
    if not run:
        return MeaningResult(
            status="skipped",
            message="Meaning layer skipped by options",
        )

    node_results = [_build_trace_result(unit) for unit in rule_units]
    overall_plain_meaning, summary_missing_information = _build_document_summary(
        rule_units,
        origin_result=origin_result,
    )

    return MeaningResult(
        status="executed",
        node_results=node_results,
        overall_plain_meaning=overall_plain_meaning,
        summary_missing_information=summary_missing_information,
    )
