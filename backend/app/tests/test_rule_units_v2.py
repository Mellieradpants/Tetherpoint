"""Tests for Rule Units v2 candidate grouping."""

from app.rule_units_v2.handler import process_rule_units_v2_candidates
from app.schemas.document_packet import BlockType, SourceAnchor, SourceType
from app.selection_v2.handler import SelectedSemanticSignal, SelectionV2Result
from app.semantic_structure.handler import SemanticStructureResult, SemanticStructureSignal
from app.structure.document_packet_adapter import DocumentStructureNode, DocumentStructureResult


FORBIDDEN_FIELDS = {
    "plain_meaning",
    "verification_route",
    "verification_routes",
    "governance",
    "final_output",
    "overall_plain_meaning",
}


def _anchor(block_id: str = "block-1") -> SourceAnchor:
    return SourceAnchor(
        anchor_id=f"anchor-{block_id}",
        source_type=SourceType.pdf,
        document_id="doc-rule-v2",
        page_number=1,
        block_id=block_id,
    )


def _structure_node(node_id: str, text: str, *, block_id: str = "block-1") -> DocumentStructureNode:
    return DocumentStructureNode(
        document_id="doc-rule-v2",
        structural_node_id=node_id,
        parent_id="page-1",
        page_number=1,
        block_id=block_id,
        block_type=BlockType.paragraph,
        structural_type="paragraph",
        order=1,
        depth=2,
        source_text=text,
        normalized_text=text,
        source_anchor=_anchor(block_id),
    )


def _selected_signal(signal_id: str, node_id: str, signal_type: str, anchor_text: str) -> SelectedSemanticSignal:
    return SelectedSemanticSignal(
        signal_id=signal_id,
        document_id="doc-rule-v2",
        structural_node_id=node_id,
        signal_type=signal_type,
        anchor_text=anchor_text,
        source_anchor=_anchor(node_id),
        eligibility_reason="source-backed explicit semantic signal",
    )


def _semantic_signal(signal_id: str, node_id: str, signal_type: str, anchor_text: str) -> SemanticStructureSignal:
    return SemanticStructureSignal(
        signal_id=signal_id,
        document_id="doc-rule-v2",
        structural_node_id=node_id,
        signal_type=signal_type,
        anchor_text=anchor_text,
        source_anchor=_anchor(node_id),
        detection_basis="explicit_text",
    )


def _inputs(selected_signals, structure_nodes):
    structure = DocumentStructureResult(document_id="doc-rule-v2", nodes=structure_nodes)
    semantic = SemanticStructureResult(
        document_id="doc-rule-v2",
        signals=[
            _semantic_signal(signal.signal_id, signal.structural_node_id, signal.signal_type, signal.anchor_text)
            for signal in selected_signals
        ],
        signal_count=len(selected_signals),
    )
    selection = SelectionV2Result(
        document_id="doc-rule-v2",
        selected_signals=selected_signals,
        selected_count=len(selected_signals),
        excluded_count=0,
    )
    return structure, semantic, selection


def test_two_selected_signals_from_same_structure_node_group_into_one_candidate():
    signals = [
        _selected_signal("signal-1", "node-1", "obligation", "shall"),
        _selected_signal("signal-2", "node-1", "evidence_requirement", "proof"),
    ]
    structure, semantic, selection = _inputs(signals, [_structure_node("node-1", "The agency shall require proof.")])

    result = process_rule_units_v2_candidates(structure, semantic, selection)

    assert result.candidate_count == 1
    assert result.candidates[0].selected_signal_ids == ["signal-1", "signal-2"]


def test_selected_signals_from_different_structure_nodes_produce_separate_candidates():
    signals = [
        _selected_signal("signal-1", "node-1", "obligation", "shall"),
        _selected_signal("signal-2", "node-2", "condition", "if"),
    ]
    structure, semantic, selection = _inputs(
        signals,
        [
            _structure_node("node-1", "The agency shall send notice.", block_id="block-1"),
            _structure_node("node-2", "If the record is missing, review begins.", block_id="block-2"),
        ],
    )

    result = process_rule_units_v2_candidates(structure, semantic, selection)

    assert result.candidate_count == 2
    assert [candidate.structural_node_id for candidate in result.candidates] == ["node-1", "node-2"]


def test_candidate_preserves_source_backed_fields():
    signals = [
        _selected_signal("signal-1", "node-1", "obligation", "shall"),
        _selected_signal("signal-2", "node-1", "evidence_requirement", "proof"),
    ]
    structure_node = _structure_node("node-1", "The agency shall require proof.")
    structure, semantic, selection = _inputs(signals, [structure_node])

    result = process_rule_units_v2_candidates(structure, semantic, selection)
    candidate = result.candidates[0]

    assert candidate.structural_node_id == "node-1"
    assert candidate.selected_signal_ids == ["signal-1", "signal-2"]
    assert candidate.signal_types == ["obligation", "evidence_requirement"]
    assert candidate.anchor_texts == ["shall", "proof"]
    assert candidate.source_anchor == structure_node.source_anchor
    assert candidate.source_text == "The agency shall require proof."
    assert candidate.assembly_status == "ready"


def test_missing_matching_structure_node_creates_needs_review_candidate():
    signals = [_selected_signal("signal-1", "missing-node", "obligation", "shall")]
    structure, semantic, selection = _inputs(signals, [])

    result = process_rule_units_v2_candidates(structure, semantic, selection)
    candidate = result.candidates[0]

    assert candidate.structural_node_id == "missing-node"
    assert candidate.assembly_status == "needs_review"
    assert "matching DocumentStructureNode was not found" in candidate.assembly_notes
    assert candidate.source_text == ""


def test_candidate_output_has_no_downstream_fields():
    signals = [_selected_signal("signal-1", "node-1", "obligation", "shall")]
    structure, semantic, selection = _inputs(signals, [_structure_node("node-1", "The agency shall send notice.")])

    result = process_rule_units_v2_candidates(structure, semantic, selection)
    payload = result.model_dump()
    payload_text = str(payload)

    for field in FORBIDDEN_FIELDS:
        assert field not in payload
        assert field not in payload_text


def test_rule_units_v2_does_not_mutate_inputs():
    signals = [_selected_signal("signal-1", "node-1", "obligation", "shall")]
    structure, semantic, selection = _inputs(signals, [_structure_node("node-1", "The agency shall send notice.")])
    before = (structure.model_dump(), semantic.model_dump(), selection.model_dump())

    process_rule_units_v2_candidates(structure, semantic, selection)

    assert (structure.model_dump(), semantic.model_dump(), selection.model_dump()) == before
