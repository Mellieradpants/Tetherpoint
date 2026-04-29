"""Meaning layer.

Meaning is document-level by default. It consumes Rule Units, builds a compact
brief deterministically, and returns a stable fallback summary without external
calls. Optional future AI Meaning should make one document-level call over this
brief, never one call per rule unit and never over raw atomic nodes.
"""

from __future__ import annotations

import re

from app.schemas.models import (
    MeaningBrief,
    MeaningNodeResult,
    MeaningResult,
    OriginResult,
    RuleUnit,
    VerificationResult,
)

MAX_BRIEF_RULE_UNITS = 16
MAX_ITEM_LENGTH = 220

_ACTION_RE = re.compile(
    r"\b(shall|must|may|is required to|are required to|require|requires|"
    r"provide|submit|verify|retain|include|accept|issue|enforce|establish|prohibit)\b",
    re.I,
)
_CONDITION_RE = re.compile(r"\b(if|when|unless|except|before|after|provided that|at the time of)\b", re.I)
_ACT_RE = re.compile(r"\b(National Voter Registration Act of 1993|REAL ID Act of 2005)\b", re.I)
_KEY_TERM_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("voter registration", re.compile(r"\b(register to vote|voter registration|elections? for federal office)\b", re.I)),
    ("documentary proof of United States citizenship", re.compile(r"\b(citizenship|United States citizen|U\.S\. citizen|documentary proof)\b", re.I)),
    ("identity or citizenship documents", re.compile(r"\b(passport|birth certificate|identification|REAL ID|naturalization|military identification)\b", re.I)),
]


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _shorten(value: str, limit: int = MAX_ITEM_LENGTH) -> str:
    cleaned = _clean_text(value)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def _unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = _shorten(value)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def _join_names(values: list[str]) -> str:
    if len(values) <= 1:
        return "".join(values)
    return ", ".join(values[:-1]) + f" and {values[-1]}"


def _split_clauses(text: str) -> list[str]:
    clauses = re.split(r"(?<=[.;:])\s+|\s+and\s+", text)
    return [clause.strip(" ;:.") for clause in clauses if clause.strip(" ;:.")]


def _extract_referenced_acts(rule_units: list[RuleUnit], origin_result: OriginResult | None) -> list[str]:
    values: list[str] = []

    # Prefer Origin's structured referenced-source cards because they contain
    # clean canonical names. Fall back to rule-unit signals and narrow text
    # matching only when Origin has no mapped referenced sources.
    if origin_result is not None and origin_result.referenced_sources:
        values.extend(source.name for source in origin_result.referenced_sources)
        return _unique_preserve_order(values)

    for unit in rule_units:
        values.extend(unit.external_references)

    combined_text = " ".join(unit.source_text_combined for unit in rule_units)
    values.extend(match.group(1) for match in _ACT_RE.finditer(combined_text))
    return _unique_preserve_order(values)


def _build_meaning_brief(rule_units: list[RuleUnit], origin_result: OriginResult | None) -> MeaningBrief:
    usable = [unit for unit in rule_units if unit.meaning_eligible]
    bounded = usable[:MAX_BRIEF_RULE_UNITS]

    key_terms: list[str] = []
    obligations: list[str] = []
    conditions: list[str] = []
    exceptions: list[str] = []

    for unit in bounded:
        text = _clean_text(unit.source_text_combined)
        for label, pattern in _KEY_TERM_PATTERNS:
            if pattern.search(text):
                key_terms.append(label)

        for clause in _split_clauses(text):
            if _ACTION_RE.search(clause):
                obligations.append(clause)
            if _CONDITION_RE.search(clause):
                conditions.append(clause)
            if re.search(r"\b(except|unless)\b", clause, re.I):
                exceptions.append(clause)

    referenced_acts = _extract_referenced_acts(rule_units, origin_result)

    return MeaningBrief(
        rule_unit_ids=[unit.rule_unit_id for unit in bounded],
        source_node_ids=[node_id for unit in bounded for node_id in unit.source_node_ids],
        key_terms=_unique_preserve_order(key_terms),
        obligations=_unique_preserve_order(obligations)[:8],
        conditions=_unique_preserve_order(conditions)[:6],
        exceptions=_unique_preserve_order(exceptions)[:4],
        referenced_acts=referenced_acts,
        external_reference_needed=bool(referenced_acts),
        truncated=len(usable) > len(bounded),
    )


def _summary_from_brief(brief: MeaningBrief) -> tuple[str | None, list[str]]:
    if not brief.rule_unit_ids:
        return None, ["meaning_eligible_rule_units"]

    topics = brief.key_terms
    if topics:
        if len(topics) == 1:
            main_sentence = f"This text is mainly about {topics[0]}."
        else:
            main_sentence = "This text is mainly about " + ", ".join(topics[:-1]) + f", and {topics[-1]}."
    elif brief.obligations:
        main_sentence = f"This text sets out legal requirements: {brief.obligations[0]}."
    else:
        main_sentence = "This text explains legal requirements and related procedures in the source document."

    details: list[str] = []
    if brief.obligations:
        details.append("It describes requirements that must be met before the covered process can be completed.")
    if brief.conditions or brief.exceptions:
        details.append("It also identifies conditions, limits, or exceptions that affect how those requirements apply.")
    if brief.external_reference_needed and brief.referenced_acts:
        details.append(
            "This document depends on outside law: "
            + _join_names(brief.referenced_acts)
            + ". The plain meaning above explains the current source text only. "
            + "To understand these acts, see the Origin referenced source and copy/paste that text into the Tetherpoint input."
        )

    return " ".join([main_sentence, *details]).strip(), []


def _build_trace_result(unit: RuleUnit) -> MeaningNodeResult:
    if not unit.meaning_eligible:
        return MeaningNodeResult(
            node_id=unit.rule_unit_id,
            source_text=unit.source_text_combined,
            status="skipped",
            plain_meaning=None,
            missing_information=unit.assembly_issues or ["rule_unit_needs_review"],
        )

    brief = _build_meaning_brief([unit], origin_result=None)
    plain_meaning, missing = _summary_from_brief(brief)
    return MeaningNodeResult(
        node_id=unit.rule_unit_id,
        source_text=unit.source_text_combined,
        status="fallback",
        plain_meaning=plain_meaning,
        missing_information=missing,
    )


def process_meaning(
    rule_units: list[RuleUnit],
    run: bool = True,
    origin_result: OriginResult | None = None,
    verification_result: VerificationResult | None = None,
) -> MeaningResult:
    """Process document-level Meaning without external calls."""
    _ = verification_result

    if not run:
        return MeaningResult(
            status="skipped",
            message="Meaning layer skipped by options",
        )

    node_results = [_build_trace_result(unit) for unit in rule_units]
    brief = _build_meaning_brief(rule_units, origin_result=origin_result)
    overall_plain_meaning, summary_missing_information = _summary_from_brief(brief)

    return MeaningResult(
        status="fallback",
        node_results=node_results,
        overall_plain_meaning=overall_plain_meaning,
        summary_basis="deterministic_brief",
        summary_brief=brief,
        summary_missing_information=summary_missing_information,
    )
