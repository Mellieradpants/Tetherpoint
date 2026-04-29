"""Output layer: presentation only. No transformation of upstream meaning."""

from __future__ import annotations

from app.schemas.models import (
    InputResult,
    MeaningResult,
    OriginResult,
    OutputResult,
    RuleUnitResult,
    SelectionResult,
    StructureResult,
    VerificationResult,
)


def assemble_output(
    input_result: InputResult,
    structure: StructureResult,
    selection: SelectionResult,
    rule_units: RuleUnitResult,
    meaning: MeaningResult,
    origin: OriginResult,
    verification: VerificationResult,
) -> OutputResult:
    """Assemble final output summary from all layers."""
    return OutputResult(
        summary={
            "content_type": input_result.content_type,
            "parse_status": input_result.parse_status,
            "input_size": input_result.size,
        },
        total_nodes=structure.node_count,
        selected_count=len(selection.selected_nodes),
        excluded_count=len(selection.excluded_nodes),
        rule_unit_count=rule_units.unit_count,
        ready_rule_unit_count=rule_units.ready_count,
        needs_review_rule_unit_count=rule_units.needs_review_count,
        meaning_status=meaning.status,
        origin_status=origin.status,
        verification_status=verification.status,
    )
