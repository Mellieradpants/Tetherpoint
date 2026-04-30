"""Governance constraint layer.

This layer evaluates source-anchored records for required support and safe
handoff. It does not infer missing values, resolve conflicts, overwrite data,
or decide what is true.
"""

from __future__ import annotations

import re

from app.schemas.models import (
    GovernanceCheckResult,
    GovernanceRecord,
    GovernanceRecordResult,
    GovernanceResult,
    GovernanceStatus,
    InputResult,
    RuleUnit,
    RuleUnitResult,
)

REQUIRED_ANCHOR_FIELDS = [
    "fieldName",
    "extractedValue",
    "sourceAnchor",
    "sourceSystem",
    "documentType",
]

PRINCIPLE = (
    "The governance layer does not decide what is true; it determines whether "
    "a record is sufficiently supported and safe to act on."
)

ADVERSE_ACTION_RE = re.compile(
    r"\b(deny|denial|denied|reject|rejection|rejected|revoke|revocation|"
    r"terminate|termination|terminated|suspend|suspension|suspended|"
    r"disqualify|disqualification|penalty|penalize|fine|enforcement|"
    r"loss of|remove|withhold|ineligible)\b",
    re.I,
)

MISSING_SAFEGUARD_RE = re.compile(
    r"\b(without\s+(?:written\s+)?(?:notice|explanation|reason|reasons|"
    r"opportunity|hearing|review|appeal|appeal rights|correction|"
    r"opportunity to correct|opportunity to respond|response)|"
    r"no\s+(?:notice|explanation|opportunity|hearing|review|appeal|"
    r"appeal rights|correction)|final\s+and\s+not\s+reviewable)\b",
    re.I,
)

SAFEGUARD_RE = re.compile(
    r"\b(written\s+notice|notice|explanation|opportunity\s+to\s+correct|"
    r"opportunity\s+to\s+respond|hearing|appeal|appeal rights|review|"
    r"correction period|right to respond|given\s+\d+\s+(?:calendar\s+)?days\s+to\s+correct|"
    r"correct\s+the\s+missing\s+information\s+before)\b",
    re.I,
)

RECOVERY_ACTION_RE = re.compile(
    r"\b(recovery|recover|repayment|repay|repayment notice|collections?|"
    r"collect|debt|overpayment|recoup|recoupment|garnish|garnishment)\b",
    re.I,
)

RECOVERY_PRECONDITION_RE = re.compile(
    r"\b(before\s+recovery|before\s+.*recovery|before\s+.*collections?|"
    r"before\s+any\s+denial\s+or\s+recovery\s+action\s+begins|"
    r"must\s+verify|verify\s+the\s+source\s+record|confirm\s+notice\s+delivery|"
    r"opportunity\s+to\s+correct|given\s+\d+\s+(?:calendar\s+)?days\s+to\s+correct|"
    r"clerical\s+or\s+transmission\s+errors)\b",
    re.I,
)

UNRESOLVED_SUPPORT_RE = re.compile(
    r"\b(did\s+not\s+include|not\s+included|missing|missing\s+timestamp|"
    r"source\s+document\s+used\s+to\s+determine|unverified|not\s+reviewed|"
    r"may\s+have\s+been\s+submitted|confirmation\s+number\s+was\s+not\s+included|"
    r"interpreted\s+the\s+missing\s+timestamp\s+as\s+absence|"
    r"unless\s+there\s+is\s+clear\s+evidence\s+of\s+agency\s+error|"
    r"failed\s+to\s+submit|determine\s+whether\s+recovery\s+can\s+proceed)\b",
    re.I,
)


def _has_value(value: object) -> bool:
    return value is not None and str(value).strip() != ""


def _combined_text(record: GovernanceRecord, full_context: str | None = None) -> str:
    parts = [str(record.extractedValue or "")]
    if full_context:
        parts.append(full_context)
    return "\n".join(parts)


def _check_required_anchor_fields(record: GovernanceRecord) -> GovernanceCheckResult:
    missing_fields = [
        field for field in REQUIRED_ANCHOR_FIELDS if not _has_value(getattr(record, field))
    ]

    if not missing_fields:
        return GovernanceCheckResult(
            checkName="required_field_check",
            status="match",
            issue=None,
            missingFields=[],
        )

    return GovernanceCheckResult(
        checkName="required_field_check",
        status="missing_required_source",
        issue="Record is missing one or more required source anchor fields.",
        missingFields=missing_fields,
    )


def _check_field_conflict(
    record: GovernanceRecord,
    comparison_record: GovernanceRecord | None,
) -> GovernanceCheckResult:
    if comparison_record is None:
        return GovernanceCheckResult(
            checkName="field_conflict_check",
            status="match",
            issue=None,
        )

    same_field = record.fieldName == comparison_record.fieldName
    both_have_values = _has_value(record.extractedValue) and _has_value(
        comparison_record.extractedValue
    )
    values_differ = str(record.extractedValue).strip() != str(
        comparison_record.extractedValue
    ).strip()

    if same_field and both_have_values and values_differ:
        return GovernanceCheckResult(
            checkName="field_conflict_check",
            status="contradiction_detected",
            issue="Two source-anchored records contain conflicting values for the same field.",
            comparedField=record.fieldName,
            firstValue=record.extractedValue,
            secondValue=comparison_record.extractedValue,
        )

    return GovernanceCheckResult(
        checkName="field_conflict_check",
        status="match",
        issue=None,
    )


def _check_downstream_action_support(
    record: GovernanceRecord,
    requested_action: str | None,
) -> GovernanceCheckResult:
    if not requested_action:
        return GovernanceCheckResult(
            checkName="downstream_action_gate",
            status="match",
            issue=None,
        )

    anchor_check = _check_required_anchor_fields(record)
    if anchor_check.status != "match":
        return GovernanceCheckResult(
            checkName="downstream_action_gate",
            status="unsupported_downstream_action",
            issue="Requested downstream action is blocked because required source support is missing.",
            requestedAction=requested_action,
            blockingStatus=anchor_check.status,
            missingFields=anchor_check.missingFields,
        )

    return GovernanceCheckResult(
        checkName="downstream_action_gate",
        status="match",
        issue=None,
        requestedAction=requested_action,
    )


def _check_procedural_safeguards(record: GovernanceRecord) -> GovernanceCheckResult:
    text = str(record.extractedValue or "")

    if not ADVERSE_ACTION_RE.search(text):
        return GovernanceCheckResult(
            checkName="procedural_safeguard_review",
            status="match",
            issue=None,
        )

    if MISSING_SAFEGUARD_RE.search(text):
        return GovernanceCheckResult(
            checkName="procedural_safeguard_review",
            status="needs_review",
            issue=(
                "Adverse action is source-backed, but the source text states or implies that a procedural safeguard "
                "is missing. Review before relying on this result."
            ),
            missingFields=[
                "governance_scope: denial_or_loss_of_benefit",
                "governance_scope: missing_procedural_safeguard",
            ],
        )

    if not SAFEGUARD_RE.search(text):
        return GovernanceCheckResult(
            checkName="procedural_safeguard_review",
            status="needs_review",
            issue=(
                "Adverse action is present, but the same rule unit does not state notice, correction, response, review, "
                "or appeal safeguards. Review before relying on this result."
            ),
            missingFields=[
                "governance_scope: denial_or_loss_of_benefit",
                "governance_scope: procedural_safeguard_not_stated",
            ],
        )

    return GovernanceCheckResult(
        checkName="procedural_safeguard_review",
        status="match",
        issue=None,
    )


def _check_recovery_preconditions(record: GovernanceRecord, full_context: str | None = None) -> GovernanceCheckResult:
    record_text = str(record.extractedValue or "")
    context_text = _combined_text(record, full_context)

    record_has_recovery_action = bool(RECOVERY_ACTION_RE.search(record_text))
    record_has_unresolved_support = bool(UNRESOLVED_SUPPORT_RE.search(record_text))
    record_has_recovery_precondition = bool(RECOVERY_PRECONDITION_RE.search(record_text))

    # Full document context can support a local recovery or unresolved-support signal,
    # but it should not cause every clean rule unit in the same document to fail.
    if not (record_has_recovery_action or record_has_unresolved_support or record_has_recovery_precondition):
        return GovernanceCheckResult(
            checkName="recovery_precondition_review",
            status="match",
            issue=None,
        )

    # Safeguard-only rule units are controls, not violations.
    if record_has_recovery_precondition and not record_has_unresolved_support:
        return GovernanceCheckResult(
            checkName="recovery_precondition_review",
            status="match",
            issue=None,
        )

    has_required_preconditions = bool(RECOVERY_PRECONDITION_RE.search(context_text))
    has_unresolved_support = bool(UNRESOLVED_SUPPORT_RE.search(context_text))

    if record_has_recovery_action and has_required_preconditions and has_unresolved_support:
        return GovernanceCheckResult(
            checkName="recovery_precondition_review",
            status="needs_review",
            issue=(
                "Recovery or collections action appears before required verification, notice confirmation, or correction "
                "opportunity is complete. Review before relying on this result."
            ),
            missingFields=[
                "governance_scope: recovery_or_collections_action",
                "governance_scope: missing_or_unverified_source_record",
                "governance_scope: notice_and_correction_preconditions",
                "governance_scope: unreviewed_conflicting_evidence",
            ],
        )

    if record_has_recovery_action and has_unresolved_support:
        return GovernanceCheckResult(
            checkName="recovery_precondition_review",
            status="needs_review",
            issue=(
                "Recovery or collections action is connected to missing, unverified, or unresolved support signals. "
                "Review before relying on this result."
            ),
            missingFields=[
                "governance_scope: recovery_or_collections_action",
                "governance_scope: missing_or_unverified_source_record",
            ],
        )

    return GovernanceCheckResult(
        checkName="recovery_precondition_review",
        status="match",
        issue=None,
    )


def evaluate_governance_record(
    record: GovernanceRecord,
    comparison_record: GovernanceRecord | None = None,
    requested_action: str | None = None,
    full_context: str | None = None,
) -> GovernanceRecordResult:
    """Evaluate one normalized governance record."""
    checks = [
        _check_required_anchor_fields(record),
        _check_field_conflict(record, comparison_record),
        _check_downstream_action_support(record, requested_action),
        _check_procedural_safeguards(record),
        _check_recovery_preconditions(record, full_context),
    ]
    active_issues = [check for check in checks if check.status != "match"]

    return GovernanceRecordResult(
        inputField=record.fieldName or None,
        extractedValue=record.extractedValue or None,
        sourceAnchor=record.sourceAnchor or None,
        sourceSystem=record.sourceSystem or None,
        documentType=record.documentType or None,
        overallStatus="needs_review" if active_issues else "match",
        checks=checks,
        activeIssues=active_issues,
        principle=PRINCIPLE,
    )


def _record_from_rule_unit(rule_unit: RuleUnit, input_result: InputResult) -> GovernanceRecord:
    """Normalize a rule unit into the governance record contract."""
    return GovernanceRecord(
        fieldName=rule_unit.rule_unit_id,
        extractedValue=rule_unit.source_text_combined,
        sourceAnchor=",".join(rule_unit.source_node_ids),
        sourceSystem="tetherpoint_rule_units",
        documentType=input_result.content_type,
    )


def process_governance(
    input_result: InputResult,
    rule_units: RuleUnitResult,
) -> GovernanceResult:
    """Run governance checks over assembled rule units.

    Comparison records and requested actions are supported by the record checker,
    but pipeline-level comparison input is intentionally not wired here yet.
    """
    full_context = "\n".join(
        rule_unit.source_text_combined for rule_unit in rule_units.rule_units
    )
    results = [
        evaluate_governance_record(
            _record_from_rule_unit(rule_unit, input_result),
            full_context=full_context,
        )
        for rule_unit in rule_units.rule_units
    ]
    active_issues = [
        issue for result in results for issue in result.activeIssues
    ]
    issue_count = len(active_issues)

    return GovernanceResult(
        status="needs_review" if issue_count else "match",
        record_count=len(results),
        issue_count=issue_count,
        results=results,
        activeIssues=active_issues,
        principle=PRINCIPLE,
    )
