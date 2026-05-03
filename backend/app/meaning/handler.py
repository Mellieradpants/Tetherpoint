"""Meaning layer.

Meaning is document-level by default. It consumes Rule Units, builds a compact
brief deterministically, and returns a stable fallback summary without external
calls. Optional future AI Meaning should make one document-level call over this
brief, never one call per rule unit and never over raw atomic nodes.
"""

from __future__ import annotations

import re

from app.schemas.models import (
    GovernanceGateResult,
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
_NON_BLENDING_SUMMARIES = {
    "Do not claim mail voting is eliminated unless the supplied text says so.": "It does not say that mail voting is eliminated.",
    "Do not treat identity proof as citizenship proof unless the supplied text says so.": "It does not make general identity proof the same thing as citizenship proof.",
    "Do not treat REAL ID travel enforcement as voter registration eligibility unless the supplied text says so.": "It does not make REAL ID travel-enforcement rules a voter-registration eligibility rule by themselves.",
    "Do not answer name-discrepancy or marriage-certificate acceptance unless the supplied text says so.": "It does not answer name-discrepancy or marriage-certificate acceptance questions unless those details appear in the source text.",
    "Do not treat voter registration as ballot casting unless the supplied text says so.": "It addresses voter-registration processing, not ballot casting, unless the supplied text says otherwise.",
}


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


def _reference_role_sentence(governance_gate_result: GovernanceGateResult) -> str | None:
    if not governance_gate_result.reference_roles:
        return None

    role_phrases: list[str] = []
    for reference in governance_gate_result.reference_roles:
        if reference.role == "registration_framework":
            role_phrases.append(f"{reference.source} as the registration framework")
        elif reference.role == "document_standard":
            role_phrases.append(f"{reference.source} as a document-standard reference")
        else:
            role_phrases.append(f"{reference.source} as {reference.role.replace('_', ' ')}")

    return "The text references outside law, including " + _join_names(role_phrases) + "."


def _summary_from_gate(
    brief: MeaningBrief,
    governance_gate_result: GovernanceGateResult,
) -> tuple[str | None, list[str]]:
    if not brief.rule_unit_ids:
        return None, ["meaning_eligible_rule_units"]

    sentences: list[str] = []
    missing: list[str] = []
    process_scopes = set(governance_gate_result.process_scopes)
    evidence_categories = set(governance_gate_result.evidence_categories)

    if "voter_registration" in process_scopes:
        sentences.append("This text concerns federal voter-registration application processing.")
    elif governance_gate_result.process_scopes:
        sentences.append(
            "This text concerns "
            + _join_names([scope.replace("_", " ") for scope in governance_gate_result.process_scopes])
            + "."
        )

    if "citizenship_proof" in evidence_categories and "identity_or_citizenship_document" in evidence_categories:
        sentences.append(
            "It appears to create or modify a citizenship-proof requirement, not a general identity requirement."
        )
    elif "citizenship_proof" in evidence_categories:
        sentences.append("It appears to create or modify a citizenship-proof requirement.")
    elif "identity_or_citizenship_document" in evidence_categories:
        sentences.append("It concerns identity or citizenship documents.")

    reference_sentence = _reference_role_sentence(governance_gate_result)
    if reference_sentence:
        sentences.append(reference_sentence)
    elif brief.external_reference_needed and brief.referenced_acts:
        sentences.append("The text references outside law: " + _join_names(brief.referenced_acts) + ".")

    if governance_gate_result.limits:
        sentences.append(
            "Plain Meaning cannot fully resolve the effect until the referenced source sections are retrieved or supplied."
        )
        missing.extend(governance_gate_result.limits)

    if governance_gate_result.practical_questions:
        sentences.append(
            "Open questions include: "
            + _join_names(governance_gate_result.practical_questions[:3])
            + "."
        )
        if len(governance_gate_result.practical_questions) > 3:
            missing.extend(governance_gate_result.practical_questions[3:])

    for rule in governance_gate_result.non_blending_rules:
        summary = _NON_BLENDING_SUMMARIES.get(rule)
        if summary:
            sentences.append(summary)

    if sentences:
        return " ".join(sentences).strip(), _unique_preserve_order(missing)

    return _summary_from_brief(brief)


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
            + "To understand these acts, open Referenced Sources in the Origin tab, copy the official bill text, and paste that text into the Tetherpoint input."
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
    governance_gate_result: GovernanceGateResult | None = None,
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
    if governance_gate_result is not None:
        overall_plain_meaning, summary_missing_information = _summary_from_gate(
            brief,
            governance_gate_result,
        )
    else:
        overall_plain_meaning, summary_missing_information = _summary_from_brief(brief)

    return MeaningResult(
        status="fallback",
        node_results=node_results,
        overall_plain_meaning=overall_plain_meaning,
        summary_basis="deterministic_brief",
        summary_brief=brief,
        summary_missing_information=summary_missing_information,
    )
