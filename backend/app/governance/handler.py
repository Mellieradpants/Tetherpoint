"""Governance constraint layer.

This layer evaluates source-anchored records for required support and safe
handoff. It does not infer missing values, resolve conflicts, overwrite data,
or decide what is true.
"""

from __future__ import annotations

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


def _has_value(value: object) -> bool:
    return value is not None and str(value).strip() != ""


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


def evaluate_governance_record(
    record: GovernanceRecord,
    comparison_record: GovernanceRecord | None = None,
    requested_action: str | None = None,
) -> GovernanceRecordResult:
    """Evaluate one normalized governance record."""
    checks = [
        _check_required_anchor_fields(record),
        _check_field_conflict(record, comparison_record),
        _check_downstream_action_support(record, requested_action),
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
    results = [
        evaluate_governance_record(_record_from_rule_unit(rule_unit, input_result))
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
