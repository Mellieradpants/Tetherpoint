"""Meaning layer.

Default Meaning uses a deterministic document-level summary so the pipeline
returns reliably. Rule units remain available underneath for traceability.
"""

from __future__ import annotations

import re

from app.schemas.models import (
    MeaningNodeResult,
    MeaningResult,
    OriginResult,
    RuleUnit,
    VerificationResult,
)


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = _clean_text(value)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def _extract_referenced_acts(rule_units: list[RuleUnit], origin_result: OriginResult | None) -> list[str]:
    values: list[str] = []

    if origin_result is not None:
        for signal in origin_result.origin_identity_signals:
            if signal.signal == "REFERENCED_ACT":
                values.append(signal.value)

    combined_text = " ".join(unit.source_text_combined for unit in rule_units)
    for match in re.finditer(r"([A-Z][A-Za-z0-9\s,-]+ Act of \d{4})", combined_text):
        values.append(match.group(1))
    for match in re.finditer(r"(REAL ID Act of 2005)", combined_text, flags=re.I):
        values.append(match.group(1))

    return _unique_preserve_order(values)


def _contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in terms)


def _build_deterministic_summary(
    rule_units: list[RuleUnit],
    origin_result: OriginResult | None,
) -> tuple[str | None, list[str]]:
    usable = [unit for unit in rule_units if unit.meaning_eligible]
    if not usable:
        return None, ["meaning_eligible_rule_units"]

    combined_text = " ".join(_clean_text(unit.source_text_combined) for unit in usable)
    referenced_acts = _extract_referenced_acts(rule_units, origin_result)

    topics: list[str] = []
    if _contains_any(combined_text, ["voter registration", "register to vote", "elections for federal office"]):
        topics.append("voter registration for federal elections")
    if _contains_any(combined_text, ["citizenship", "united states citizen", "u.s. citizen"]):
        topics.append("proof of United States citizenship")
    if _contains_any(combined_text, ["identification", "photo id", "real id", "documentary proof"]):
        topics.append("which identity or citizenship documents may count")
    if _contains_any(combined_text, ["polling place", "day of election", "election official"]):
        topics.append("how proof is handled at registration or at the polling place")

    if topics:
        main_sentence = "This text is mainly about " + ", ".join(topics[:-1])
        if len(topics) > 1:
            main_sentence += f", and {topics[-1]}."
        else:
            main_sentence += "."
    else:
        main_sentence = "This text explains legal requirements and related procedures in the source document."

    details: list[str] = []
    if _contains_any(combined_text, ["must", "require", "shall"]):
        details.append("It describes requirements that must be met before a person can complete the covered process.")
    if _contains_any(combined_text, ["birth certificate", "consular report", "american indian card", "identification"]):
        details.append("It also describes types of records or identification that may be used as proof.")
    if referenced_acts:
        details.append("It references " + ", ".join(referenced_acts) + ", which may provide important background for the rule.")

    summary = " ".join([main_sentence, *details]).strip()
    return summary, []


def _build_trace_result(unit: RuleUnit) -> MeaningNodeResult:
    # Rule-unit Meaning is trace-only in the default path.
    # A future deep mode can add per-rule AI calls behind an explicit option.
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


def process_meaning(
    rule_units: list[RuleUnit],
    run: bool = True,
    origin_result: OriginResult | None = None,
    verification_result: VerificationResult | None = None,
) -> MeaningResult:
    """Process document-level Meaning without external calls.

    Default Meaning is deterministic for reliability. Rule units stay available
    as traceable structure underneath the document-level summary.
    """
    if not run:
        return MeaningResult(
            status="skipped",
            message="Meaning layer skipped by options",
        )

    node_results = [_build_trace_result(unit) for unit in rule_units]
    overall_plain_meaning, summary_missing_information = _build_deterministic_summary(
        rule_units,
        origin_result=origin_result,
    )

    return MeaningResult(
        status="executed",
        node_results=node_results,
        overall_plain_meaning=overall_plain_meaning,
        summary_missing_information=summary_missing_information,
    )
