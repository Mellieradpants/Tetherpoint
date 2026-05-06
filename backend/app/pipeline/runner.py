"""Pipeline runner: orchestrates layers in locked order."""

from __future__ import annotations

from app.governance.gate import process_governance_gate
from app.governance.handler import process_governance
from app.input.handler import process_input
from app.meaning.handler import process_meaning
from app.origin.handler import process_origin
from app.output.handler import assemble_output
from app.rule_units.handler import process_rule_units
from app.schemas.models import (
    AnalyzeRequest,
    GovernanceCheckResult,
    GovernanceGateResult,
    GovernanceResult,
    HumanReviewHandoff,
    OriginResult,
    PipelineError,
    PipelineResponse,
    RuleUnit,
    RuleUnitResult,
    SourceMetadataContract,
)
from app.selection.handler import process_selection
from app.structure.handler import process_structure
from app.verification.handler import process_verification


def _append_unique(values: list[str], value: str | None) -> None:
    if value and value not in values:
        values.append(value)


def _extend_unique(values: list[str], additions: list[str]) -> None:
    for value in additions:
        _append_unique(values, value)


def _source_key(name: str | None, url: str | None, matched_text: str | None) -> tuple[str, str, str]:
    return ((name or "").strip().lower(), (url or "").strip(), (matched_text or "").strip())


def _origin_resolution_state(status: str | None) -> str:
    if status == "official_reference_detected":
        return "found"
    if status == "reference_detected_no_known_link":
        return "manual_required"
    return "not_attempted"


def _retrieval_resolution_state(status: str | None) -> str:
    if status == "retrieved":
        return "found"
    if status == "manual_required":
        return "manual_required"
    if status == "failed":
        return "failed"
    return "not_attempted"


def _build_source_metadata(
    origin_result: OriginResult,
    rule_unit_result: RuleUnitResult,
) -> list[SourceMetadataContract]:
    source_metadata: dict[str, SourceMetadataContract] = {}
    source_ids_by_key: dict[tuple[str, str, str], str] = {}

    for source in origin_result.referenced_sources:
        contract = SourceMetadataContract(
            source_id=source.reference_id,
            source_name=source.name,
            source_role="reference_record",
            source_system=source.source_system,
            source_url=source.official_source_url,
            matched_text=source.matched_text,
            resolution_state=_origin_resolution_state(source.status),
            review_state="needs_review"
            if source.status == "reference_detected_no_known_link"
            else "ready",
        )
        if source.status == "reference_detected_no_known_link":
            contract.dependencies_open.append("official_source_link")
            contract.limits.append(source.why_it_matters or "Official source link is not mapped.")
        source_metadata[contract.source_id] = contract
        source_ids_by_key[_source_key(source.name, source.official_source_url, source.matched_text)] = contract.source_id

    for unit in rule_unit_result.rule_units:
        for index, source in enumerate(unit.referenced_sources):
            key = _source_key(source.name, source.officialSourceUrl, source.matchedText)
            source_id = source_ids_by_key.get(key) or f"{unit.rule_unit_id}-reference-{index + 1}"
            if source_id not in source_metadata:
                source_metadata[source_id] = SourceMetadataContract(
                    source_id=source_id,
                    source_name=source.name,
                    source_role="reference_record",
                    source_url=source.officialSourceUrl,
                    matched_text=source.matchedText,
                )
                source_ids_by_key[key] = source_id

            contract = source_metadata[source_id]
            contract.resolution_state = _retrieval_resolution_state(source.retrievalStatus)
            contract.source_text = source.sourceText
            _append_unique(contract.related_rule_unit_ids, unit.rule_unit_id)
            _extend_unique(contract.related_node_ids, unit.source_node_ids)
            _extend_unique(contract.anchors_available, source.anchors)
            _extend_unique(contract.limits, source.limits)

            if source.retrievalStatus != "retrieved":
                contract.review_state = "needs_review"
                _append_unique(contract.dependencies_open, "reference_resolution_dependency")
                if not source.sourceText:
                    _append_unique(contract.anchors_missing, "referenced_source_text")

    return list(source_metadata.values())


def _unit_has_unresolved_reference(unit: RuleUnit) -> bool:
    return bool(
        unit.requires_reference_resolution
        and any(source.retrievalStatus != "retrieved" for source in unit.referenced_sources)
    )


def _build_reference_handoff(unit: RuleUnit) -> HumanReviewHandoff:
    unresolved_sources = [
        source for source in unit.referenced_sources if source.retrievalStatus != "retrieved"
    ]
    source_names: list[str] = []
    anchors_present: list[str] = []
    limits: list[str] = []
    for source in unresolved_sources:
        _append_unique(source_names, source.name)
        _extend_unique(anchors_present, source.anchors)
        _extend_unique(limits, source.limits)

    return HumanReviewHandoff(
        handoff_id=f"{unit.rule_unit_id}-reference-resolution",
        handoff_type="threshold_not_met",
        severity="review_required",
        affected_output_ids=[unit.rule_unit_id],
        source_objects=source_names,
        dependencies=["reference_resolution_dependency"],
        anchors_present=anchors_present,
        anchors_missing=["referenced_source_text"],
        reason=limits[0] if limits else "Referenced source dependency is unresolved.",
        human_question="Resolve referenced source text for: " + ", ".join(source_names),
        can_proceed=False,
    )


def _handoff_type_for_governance_issue(issue: GovernanceCheckResult) -> str | None:
    status = issue.status
    blocking_status = issue.blockingStatus
    if status == "contradiction_detected" or blocking_status == "contradiction_detected":
        return "conflict_requiring_judgment"
    if status == "unsupported_downstream_action" or blocking_status == "unsupported_downstream_action":
        return "scope_exceeded"
    if status == "missing_required_source" or blocking_status == "missing_required_source":
        return "threshold_not_met"
    if status == "needs_review" and issue.issue:
        return "contextual_fact_required"
    return None


def _build_governance_issue_handoff(
    issue: GovernanceCheckResult,
    index: int,
) -> HumanReviewHandoff | None:
    if issue.checkName == "governance_record_presence_check":
        return None

    handoff_type = _handoff_type_for_governance_issue(issue)
    if handoff_type is None:
        return None

    severity = "blocked" if handoff_type in {"conflict_requiring_judgment", "scope_exceeded"} else "review_required"
    return HumanReviewHandoff(
        handoff_id=f"governance-{issue.checkName}-{index + 1}",
        handoff_type=handoff_type,
        severity=severity,
        dependencies=issue.missingFields,
        anchors_missing=issue.missingFields,
        reason=issue.issue or "Governance issue requires human review.",
        human_question=issue.issue or "Review the governance issue before relying on this result.",
        can_proceed=False,
    )


def _build_governance_gate_handoff(
    governance_gate_result: GovernanceGateResult,
) -> HumanReviewHandoff | None:
    if governance_gate_result.status != "needs_review":
        return None
    if not governance_gate_result.practical_questions and not governance_gate_result.limits:
        return None

    source_objects = [role.source for role in governance_gate_result.reference_roles]
    human_question = (
        governance_gate_result.practical_questions[0]
        if governance_gate_result.practical_questions
        else "Review the governance gate limits before relying on this result."
    )
    return HumanReviewHandoff(
        handoff_id="governance-gate-reference-boundary",
        handoff_type="contextual_fact_required"
        if governance_gate_result.practical_questions
        else "threshold_not_met",
        severity="review_required",
        source_objects=source_objects,
        dependencies=governance_gate_result.limits,
        reason=governance_gate_result.limits[0]
        if governance_gate_result.limits
        else "Governance gate requires review.",
        human_question=human_question,
        can_proceed=False,
    )


def _build_human_review_handoffs(
    rule_unit_result: RuleUnitResult,
    governance_gate_result: GovernanceGateResult,
    governance_result: GovernanceResult,
) -> list[HumanReviewHandoff]:
    handoffs: list[HumanReviewHandoff] = []

    for unit in rule_unit_result.rule_units:
        if _unit_has_unresolved_reference(unit):
            handoffs.append(_build_reference_handoff(unit))

    gate_handoff = _build_governance_gate_handoff(governance_gate_result)
    if gate_handoff is not None:
        handoffs.append(gate_handoff)

    for index, issue in enumerate(governance_result.activeIssues):
        handoff = _build_governance_issue_handoff(issue, index)
        if handoff is not None:
            handoffs.append(handoff)

    return handoffs


def run_pipeline(request: AnalyzeRequest) -> PipelineResponse:
    """Execute the pipeline:
    Input -> Structure -> Origin -> Selection -> Rule Units -> Governance Gate -> Verification -> Meaning -> Governance -> Output

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

    # 6. Governance Gate
    governance_gate_result = process_governance_gate(
        rule_unit_result.rule_units,
        origin_result,
    )

    # 7. Verification routing
    verification_result = process_verification(
        rule_unit_result.rule_units,
        run=request.options.run_verification,
    )

    # 8. Meaning
    meaning_result = process_meaning(
        rule_unit_result.rule_units,
        run=request.options.run_meaning,
        origin_result=origin_result,
        verification_result=verification_result,
        governance_gate_result=governance_gate_result,
    )
    if meaning_result.status == "skipped" and request.options.run_meaning:
        errors.append(PipelineError(
            layer="meaning",
            error=meaning_result.message or "Meaning layer could not execute",
            fatal=False,
        ))

    # 9. Governance
    governance_result = process_governance(
        input_result,
        rule_unit_result,
    )

    # 10. Output
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
        governance_gate=governance_gate_result,
        meaning=meaning_result,
        origin=origin_result,
        verification=verification_result,
        governance=governance_result,
        output=output_result,
        errors=errors,
        source_metadata=_build_source_metadata(origin_result, rule_unit_result),
        human_review_handoffs=_build_human_review_handoffs(
            rule_unit_result,
            governance_gate_result,
            governance_result,
        ),
    )
