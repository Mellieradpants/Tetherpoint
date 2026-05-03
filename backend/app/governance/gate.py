"""Pre-Meaning Governance Gate.

This layer classifies operational lanes and non-blending constraints before
Meaning runs. It does not decide truth, write meaning, or resolve references.
"""

from __future__ import annotations

import re

from app.schemas.models import (
    GovernanceGateResult,
    GovernanceReferenceRole,
    OriginResult,
    RuleUnit,
)

_VOTER_REGISTRATION_RE = re.compile(
    r"\b(voter\s+registration|register\s+to\s+vote|federal\s+election\s+application|elections?\s+for\s+federal\s+office)\b",
    re.I,
)
_MAIL_VOTER_REGISTRATION_RE = re.compile(r"\b(mail\s+voter\s+registration|mail\s+form)\b", re.I)
_CITIZENSHIP_PROOF_RE = re.compile(
    r"\b(citizenship|documentary\s+proof|United\s+States\s+citizen)\b",
    re.I,
)
_IDENTITY_DOCUMENT_RE = re.compile(
    r"\b(identification|ID\b|REAL\s+ID|passport|birth\s+certificate)\b",
    re.I,
)
_APPLICANT_RE = re.compile(r"\bapplicant\b", re.I)
_STATE_ELECTION_OFFICIAL_RE = re.compile(r"\b(State|election\s+official|registrar)\b", re.I)

_NON_BLENDING_RULES = [
    "Do not treat voter registration as ballot casting unless the supplied text says so.",
    "Do not treat identity proof as citizenship proof unless the supplied text says so.",
    "Do not treat REAL ID travel enforcement as voter registration eligibility unless the supplied text says so.",
    "Do not claim mail voting is eliminated unless the supplied text says so.",
    "Do not answer name-discrepancy or marriage-certificate acceptance unless the supplied text says so.",
]

_REFERENCE_QUESTIONS = [
    "Which sections of the referenced source are being used?",
    "What documents qualify?",
    "What must each document show?",
    "What happens if names or documents do not match?",
    "When must proof be provided?",
]

_REFERENCE_LIMIT = "Referenced source text has not been retrieved or selected by Governance Gate."


def _append_unique(values: list[str], value: str) -> None:
    if value not in values:
        values.append(value)


def _combined_rule_text(rule_units: list[RuleUnit]) -> str:
    return "\n".join(unit.source_text_combined for unit in rule_units if unit.source_text_combined)


def _has_voting_reference_document_signals(text: str, origin_result: OriginResult) -> bool:
    return bool(
        _VOTER_REGISTRATION_RE.search(text)
        or _MAIL_VOTER_REGISTRATION_RE.search(text)
        or _CITIZENSHIP_PROOF_RE.search(text)
        or _IDENTITY_DOCUMENT_RE.search(text)
        or origin_result.referenced_sources
    )


def _reference_roles(origin_result: OriginResult) -> list[GovernanceReferenceRole]:
    roles: list[GovernanceReferenceRole] = []
    seen: set[str] = set()

    for source in origin_result.referenced_sources:
        if source.name in seen:
            continue
        seen.add(source.name)

        if source.name == "National Voter Registration Act of 1993":
            roles.append(GovernanceReferenceRole(
                source="National Voter Registration Act of 1993",
                role="registration_framework",
                reason="Referenced as the voter-registration framework affected by the current rule.",
            ))
        elif source.name == "REAL ID Act of 2005":
            roles.append(GovernanceReferenceRole(
                source="REAL ID Act of 2005",
                role="document_standard",
                reason="Referenced as a document-standard source, not as the voter-registration framework.",
            ))

    return roles


def process_governance_gate(rule_units: list[RuleUnit], origin_result: OriginResult) -> GovernanceGateResult:
    """Classify pre-Meaning operational lanes and constraints."""
    text = _combined_rule_text(rule_units)
    scope_lanes: list[str] = []
    actor_scopes: list[str] = []
    process_scopes: list[str] = []
    evidence_categories: list[str] = []
    practical_questions: list[str] = []
    limits: list[str] = []
    non_blending_rules: list[str] = []

    if _VOTER_REGISTRATION_RE.search(text):
        _append_unique(process_scopes, "voter_registration")

    if _MAIL_VOTER_REGISTRATION_RE.search(text):
        _append_unique(process_scopes, "mail_voter_registration_form")

    if _CITIZENSHIP_PROOF_RE.search(text):
        _append_unique(evidence_categories, "citizenship_proof")

    if _IDENTITY_DOCUMENT_RE.search(text):
        _append_unique(evidence_categories, "identity_or_citizenship_document")

    if _APPLICANT_RE.search(text):
        _append_unique(actor_scopes, "applicant")

    if _STATE_ELECTION_OFFICIAL_RE.search(text):
        _append_unique(actor_scopes, "state_election_official")

    reference_roles = _reference_roles(origin_result)
    if origin_result.referenced_sources:
        _append_unique(scope_lanes, "reference_boundary")
        for question in _REFERENCE_QUESTIONS:
            _append_unique(practical_questions, question)
        _append_unique(limits, _REFERENCE_LIMIT)

    if _has_voting_reference_document_signals(text, origin_result):
        for rule in _NON_BLENDING_RULES:
            _append_unique(non_blending_rules, rule)

    return GovernanceGateResult(
        status="needs_review" if origin_result.referenced_sources else "match",
        scope_lanes=scope_lanes,
        actor_scopes=actor_scopes,
        process_scopes=process_scopes,
        evidence_categories=evidence_categories,
        reference_roles=reference_roles,
        non_blending_rules=non_blending_rules,
        practical_questions=practical_questions,
        limits=limits,
    )
