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
    VerificationNodeResult,
    VerificationResult,
)

logger = logging.getLogger("tetherpoint.meaning")


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
        "Architecture rule: atomic nodes are traceability units, not interpretation targets. "
        "Explain the Rule Unit as one coherent unit. Use source_node_ids only for traceability. "
        "Do not explain fragment_node_ids independently.\n\n"
        "If assembly_status is not complete or review_status is not ready, return plain_meaning as null "
        "and include a missing_information item explaining why Meaning is blocked or limited.\n\n"
        "Your only job is plain meaning. Do not classify scopes. Do not use shift labels. "
        "Do not output taxonomy labels. Explain what the legislative language says in everyday public language.\n\n"
        "Context JSON:\n"
        f"{json.dumps(context, ensure_ascii=False, sort_keys=True)}\n\n"
        "Plain Meaning style rules:\n"
        "- Write for an eighth-grade reader.\n"
        "- Use one or two short sentences.\n"
        "- Explain who does what, when, where, or how.\n"
        "- Say what happens in real life.\n"
        "- Use common words first.\n"
        "- Do not copy the source sentence with only small word changes.\n"
        "- Do not add claims beyond the Rule Unit.\n"
        "- Do not use internal system words in plain_meaning.\n"
        "- Banned in plain_meaning: node, rule unit, operational, operationally, operational effect, indicates, the text indicates, engage, facilitate, utilize, affected actor, process can proceed.\n\n"
        "Output requirements:\n"
        "- Return ONLY valid JSON.\n"
        "- Do not include markdown fences or text outside JSON.\n"
        "- Return one top-level JSON object with exactly these keys: plain_meaning, missing_information.\n"
        "- plain_meaning must be one or two short public-language sentences, or null only if the Rule Unit is not safe to explain.\n"
        "- missing_information must be an array of short strings. Use an empty array when nothing important is missing.\n\n"
        "Example output:\n"
        "{\"plain_meaning\":\"The agency has 30 days to update the public list after it approves the rule.\",\"missing_information\":[]}"
    )


def _build_document_summary_prompt(
    rule_units: list[RuleUnit],
    node_results: list[MeaningNodeResult],
    origin_result: OriginResult | None = None,
) -> str:
    summary_context = []
    result_by_id = {result.node_id: result for result in node_results}

    for unit in rule_units:
        result = result_by_id.get(unit.rule_unit_id)
        if not result or not result.plain_meaning:
            continue
        summary_context.append({
            "rule_unit_id": unit.rule_unit_id,
            "section_id": unit.section_id,
            "primary_text": unit.primary_text,
            "plain_meaning": result.plain_meaning,
            "conditions": [_model_dump(item) for item in unit.conditions],
            "exceptions": [_model_dump(item) for item in unit.exceptions],
            "evidence_requirements": [_model_dump(item) for item in unit.evidence_requirements],
            "timing": [_model_dump(item) for item in unit.timing],
            "jurisdiction": [_model_dump(item) for item in unit.jurisdiction],
        })

    context = {
        "rule_unit_meanings": summary_context,
        "origin": _model_dump(origin_result) if origin_result is not None else None,
    }

    return (
        "You are the document-level Meaning summarizer for a source-anchored legislative parsing pipeline. "
        "Synthesize the provided rule-unit plain meanings into one concise public explanation. "
        "Do not classify scopes. Do not use shift labels. Do not list every rule unit. "
        "Do not repeat the same requirement over and over. Group repeated ideas into one explanation.\n\n"
        "Your job: explain what this document or section is mainly doing in plain language. "
        "Mention major referenced laws or acts if they are central to the text. "
        "Do not provide legal advice. Do not add claims beyond the provided rule-unit meanings.\n\n"
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


def _build_error_result(unit: RuleUnit, error: str, message: str | None = None) -> MeaningNodeResult:
    return MeaningNodeResult(
        node_id=unit.rule_unit_id,
        source_text=unit.source_text_combined,
        status="error",
        error=error,
        message=message,
        lenses=[],
        detected_scopes=[],
        scope_details=[],
        missing_information=unit.assembly_issues,
    )


def _build_document_summary(
    rule_units: list[RuleUnit],
    node_results: list[MeaningNodeResult],
    origin_result: OriginResult | None,
) -> tuple[str | None, list[str]]:
    usable = [result for result in node_results if result.status == "executed" and result.plain_meaning]
    if not usable:
        return None, ["plain_meaning"]

    prompt = _build_document_summary_prompt(rule_units, node_results, origin_result=origin_result)
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
                    detected_scopes=[],
                    scope_details=[],
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
                    detected_scopes=[],
                    scope_details=[],
                )
            )
            continue

        plain_meaning = raw.get("plain_meaning")
        if not isinstance(plain_meaning, str) or not plain_meaning.strip():
            plain_meaning = None

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
                    lenses=[],
                    detected_scopes=[],
                    scope_details=[],
                )
            )
            continue

        node_results.append(
            MeaningNodeResult(
                node_id=unit.rule_unit_id,
                source_text=unit.source_text_combined,
                status="executed",
                lenses=[],
                detected_scopes=[],
                plain_meaning=plain_meaning,
                scope_details=[],
                missing_information=missing_information,
            )
        )

    overall_plain_meaning, summary_missing_information = _build_document_summary(
        rule_units,
        node_results,
        origin_result=origin_result,
    )

    return MeaningResult(
        status="executed",
        node_results=node_results,
        overall_plain_meaning=overall_plain_meaning,
        summary_missing_information=summary_missing_information,
    )
