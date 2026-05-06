"""Tests for the Tetherpoint governance constraint layer."""

from app.governance.handler import evaluate_governance_record, process_governance
from app.input.handler import process_input
from app.rule_units.handler import process_rule_units
from app.schemas.models import (
    AnalyzeOptions,
    AnalyzeRequest,
    ContentType,
    GovernanceRecord,
)
from app.pipeline.runner import run_pipeline
from app.selection.handler import process_selection
from app.structure.handler import process_structure


def test_governance_clean_record_matches():
    result = evaluate_governance_record(
        GovernanceRecord(
            fieldName="marriage_date",
            extractedValue="2024-03-01",
            sourceAnchor="line 4",
            sourceSystem="uploaded_document",
            documentType="marriage_certificate",
        )
    )

    assert result.overallStatus == "match"
    assert result.activeIssues == []


def test_governance_missing_source_anchor_needs_review():
    result = evaluate_governance_record(
        GovernanceRecord(
            fieldName="legal_last_name",
            extractedValue="AssumedName",
            sourceAnchor="",
            sourceSystem="uploaded_document",
            documentType="benefits_record",
        )
    )

    assert result.overallStatus == "needs_review"
    assert result.activeIssues[0].status == "missing_required_source"
    assert "sourceAnchor" in result.activeIssues[0].missingFields


def test_governance_empty_extracted_value_needs_review():
    result = evaluate_governance_record(
        GovernanceRecord(
            fieldName="effective_date",
            extractedValue="",
            sourceAnchor="line 9",
            sourceSystem="uploaded_document",
            documentType="court_order",
        )
    )

    assert result.overallStatus == "needs_review"
    assert result.activeIssues[0].status == "missing_required_source"
    assert "extractedValue" in result.activeIssues[0].missingFields


def test_governance_same_field_conflict_is_contradiction():
    result = evaluate_governance_record(
        GovernanceRecord(
            fieldName="marriage_date",
            extractedValue="2024-03-01",
            sourceAnchor="marriage certificate line 4",
            sourceSystem="uploaded_document",
            documentType="marriage_certificate",
        ),
        comparison_record=GovernanceRecord(
            fieldName="marriage_date",
            extractedValue="2022-05-14",
            sourceAnchor="benefits record field 12",
            sourceSystem="agency_record",
            documentType="benefits_record",
        ),
    )

    assert result.overallStatus == "needs_review"
    assert any(issue.status == "contradiction_detected" for issue in result.activeIssues)


def test_governance_blocks_downstream_action_without_support():
    result = evaluate_governance_record(
        GovernanceRecord(
            fieldName="legal_last_name",
            extractedValue="AssumedName",
            sourceAnchor="",
            sourceSystem="uploaded_document",
            documentType="benefits_record",
        ),
        requested_action="propagate_identity_field",
    )

    assert result.overallStatus == "needs_review"
    assert any(issue.status == "unsupported_downstream_action" for issue in result.activeIssues)


def test_governance_processes_rule_units_as_supported_records():
    inp = process_input("The agency shall send notice within 30 days.", ContentType.text)
    struct = process_structure(inp)
    selection = process_selection(struct)
    rule_units = process_rule_units(struct, selection)

    result = process_governance(inp, rule_units)

    assert result.status == "match"
    assert result.record_count == rule_units.unit_count
    assert result.issue_count == 0
    assert result.results


def test_pipeline_response_includes_governance_layer():
    req = AnalyzeRequest(
        content="The agency shall send notice within 30 days.",
        content_type=ContentType.text,
        options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
    )

    result = run_pipeline(req)

    assert result.governance.status == "match"
    assert result.output.governance_status == result.governance.status
    assert result.output.governance_issue_count == result.governance.issue_count


def test_pipeline_reports_handoff_for_governance_review_signal():
    req = AnalyzeRequest(
        content="The agency shall deny benefits without notice.",
        content_type=ContentType.text,
        options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
    )

    result = run_pipeline(req)

    assert result.governance.status == "needs_review"
    assert any(
        handoff.handoff_type == "contextual_fact_required"
        and handoff.severity == "review_required"
        for handoff in result.human_review_handoffs
    )
