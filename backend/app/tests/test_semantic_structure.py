"""Tests for the internal Semantic Structure detector."""

from app.schemas.document_packet import BlockType, SourceAnchor, SourceType
from app.semantic_structure.handler import process_semantic_structure
from app.structure.document_packet_adapter import DocumentStructureNode, DocumentStructureResult


FORBIDDEN_FIELDS = {
    "plain_meaning",
    "verification_route",
    "verification_routes",
    "rule_unit_id",
    "selected",
    "governance",
}


def _anchor(block_id: str) -> SourceAnchor:
    return SourceAnchor(
        anchor_id=f"anchor-{block_id}",
        source_type=SourceType.pdf,
        document_id="doc-semantic-001",
        page_number=1,
        block_id=block_id,
    )


def _node(
    structural_node_id: str,
    source_text: str,
    *,
    block_id: str = "block-1",
    structural_type: str = "paragraph",
    block_type: BlockType = BlockType.paragraph,
) -> DocumentStructureNode:
    return DocumentStructureNode(
        document_id="doc-semantic-001",
        structural_node_id=structural_node_id,
        parent_id="page-1",
        page_number=1,
        block_id=block_id,
        block_type=block_type,
        structural_type=structural_type,
        order=1,
        depth=2,
        source_text=source_text,
        normalized_text=source_text,
        source_anchor=_anchor(block_id),
    )


def _result(*nodes: DocumentStructureNode) -> DocumentStructureResult:
    return DocumentStructureResult(document_id="doc-semantic-001", nodes=list(nodes))


def test_paragraph_with_shall_produces_obligation_signal():
    result = process_semantic_structure(_result(_node("n1", "The agency shall send notice.")))

    assert result.signal_count == 1
    assert result.signals[0].signal_type == "obligation"
    assert result.signals[0].anchor_text == "shall"


def test_may_not_produces_prohibition_not_permission():
    result = process_semantic_structure(_result(_node("n1", "The agency may not deny the application.")))
    signal_types = [signal.signal_type for signal in result.signals]

    assert signal_types == ["prohibition"]


def test_paragraph_with_if_produces_condition_signal():
    result = process_semantic_structure(_result(_node("n1", "If the record is missing, notice is required.")))

    assert result.signal_count == 1
    assert result.signals[0].signal_type == "condition"
    assert result.signals[0].anchor_text == "If"


def test_paragraph_with_proof_produces_evidence_requirement_signal():
    result = process_semantic_structure(_result(_node("n1", "The applicant must provide proof.")))
    signal_types = [signal.signal_type for signal in result.signals]

    assert "evidence_requirement" in signal_types


def test_heading_produces_no_signal_without_explicit_signal_language():
    heading = _node(
        "heading-1",
        "Application Review",
        block_id="heading-1",
        structural_type="heading",
        block_type=BlockType.heading,
    )

    result = process_semantic_structure(_result(heading))

    assert result.signal_count == 0
    assert result.signals == []


def test_multiple_signals_in_one_paragraph_produce_multiple_records():
    result = process_semantic_structure(
        _result(_node("n1", "If the agency must review proof within 30 days, it may enforce a penalty."))
    )
    signal_types = {signal.signal_type for signal in result.signals}

    assert {"condition", "obligation", "permission", "timing", "evidence_requirement", "enforcement"}.issubset(signal_types)
    assert len(result.signals) >= 6


def test_signals_preserve_structural_node_id_and_source_anchor():
    node = _node("node-preserve", "The agency shall send notice.", block_id="preserve")
    result = process_semantic_structure(_result(node))
    signal = result.signals[0]

    assert signal.structural_node_id == "node-preserve"
    assert signal.source_anchor == node.source_anchor
    assert signal.source_anchor.anchor_id == "anchor-preserve"


def test_document_structure_node_is_not_mutated():
    node = _node("node-stable", "The agency shall send notice.", block_id="stable")
    before = node.model_dump()

    process_semantic_structure(_result(node))

    assert node.model_dump() == before


def test_semantic_structure_result_has_no_downstream_fields():
    result = process_semantic_structure(_result(_node("n1", "The agency shall send notice.")))
    payload = result.model_dump()
    payload_text = str(payload)

    for field in FORBIDDEN_FIELDS:
        assert field not in payload
        assert field not in payload_text
