"""Pipeline runner: orchestrates layers in locked order."""

from __future__ import annotations

from app.governance.handler import process_governance
from app.input.handler import process_input
from app.meaning.handler import process_meaning
from app.origin.handler import process_origin
from app.output.handler import assemble_output
from app.rule_units.handler import process_rule_units
from app.schemas.models import AnalyzeRequest, PipelineError, PipelineResponse
from app.selection.handler import process_selection
from app.structure.handler import process_structure
from app.verification.handler import process_verification


def run_pipeline(request: AnalyzeRequest) -> PipelineResponse:
    """Execute the pipeline:
    Input -> Structure -> Origin -> Selection -> Rule Units -> Verification -> Meaning -> Governance -> Output

    Atomic Structure nodes remain traceability units. Rule Units are the
    interpretation units passed into Meaning. Governance evaluates anchored
    rule-unit records before final output assembly.
    """
    errors: list[PipelineError] = []

    # 1. Input
    input_result = process_input(request.content, request.content_type)
    if input_result.parse_status == "error":
        errors.append(PipelineError(
            layer="input",
            error="; ".join(input_result.parse_errors) or "Parse failed",
            fatal=True,
        ))

    # 2. Structure
    structure_result = process_structure(input_result)
    if structure_result.node_count == 0 and input_result.parse_status == "ok":
        errors.append(PipelineError(
            layer="structure",
            error="No nodes extracted from valid input",
            fatal=False,
        ))
    invalid_nodes = [node.node_id for node in structure_result.nodes if node.validation_status == "invalid"]
    if invalid_nodes:
        errors.append(PipelineError(
            layer="structure",
            error=(
                "Hierarchy validation failed for nodes: "
                + ", ".join(invalid_nodes[:10])
                + ("..." if len(invalid_nodes) > 10 else "")
            ),
            fatal=False,
        ))

    # 3. Origin
    origin_result = process_origin(
        input_result,
        structure_result=structure_result,
        run=request.options.run_origin,
    )

    # 4. Selection
    selection_result = process_selection(structure_result)

    # 5. Rule Unit Builder
    rule_unit_result = process_rule_units(
        structure_result,
        selection_result,
        origin_result=origin_result,
    )
    if rule_unit_result.unit_count == 0 and selection_result.selected_nodes:
        errors.append(PipelineError(
            layer="rule_units",
            error="Selected nodes did not assemble into rule units",
            fatal=False,
        ))

    # 6. Verification routing
    verification_result = process_verification(
        rule_unit_result.rule_units,
        run=request.options.run_verification,
    )

    # 7. Meaning
    meaning_result = process_meaning(
        rule_unit_result.rule_units,
        run=request.options.run_meaning,
        origin_result=origin_result,
        verification_result=verification_result,
    )
    if meaning_result.status == "skipped" and request.options.run_meaning:
        errors.append(PipelineError(
            layer="meaning",
            error=meaning_result.message or "Meaning layer could not execute",
            fatal=False,
        ))

    # 8. Governance
    governance_result = process_governance(
        input_result,
        rule_unit_result,
    )

    # 9. Output
    output_result = assemble_output(
        input_result,
        structure_result,
        selection_result,
        rule_unit_result,
        meaning_result,
        origin_result,
        verification_result,
        governance_result,
    )

    return PipelineResponse(
        input=input_result,
        structure=structure_result,
        selection=selection_result,
        rule_units=rule_unit_result,
        meaning=meaning_result,
        origin=origin_result,
        verification=verification_result,
        governance=governance_result,
        output=output_result,
        errors=errors,
    )
