"""End-to-end internal test for the document-first v2 chain."""

from app.input.pdf_adapter import canonical_packet_from_extracted_pdf
from app.rule_units_v2.handler import process_rule_units_v2_candidates
from app.selection_v2.handler import process_selection_v2
from app.semantic_structure.handler import process_semantic_structure
from app.structure.document_packet_adapter import document_structure_from_document_packet


FORBIDDEN_FIELDS = {
    "plain_meaning",
    "overall_plain_meaning",
    "verification_route",
    "verification_routes",
    "governance",
    "final_output",
}


def _extracted_pdf():
    return {
        "document_id": "chain-doc-001",
        "source_name": "Internal chain packet",
        "source_uri": "memory://chain.pdf",
        "source_hash": "sha256:chain",
        "pages": [
            {
                "page_number": 1,
                "blocks": [
                    {
                        "block_id": "heading-1",
                        "text": "Application Requirements",
                        "block_type": "heading",
                    },
                    {
                        "block_id": "paragraph-1",
                        "text": "The applicant shall provide proof within 30 days.",
                        "block_type": "paragraph",
                        "char_start": 20,
                        "char_end": 72,
                    },
                ],
            }
        ],
    }


def test_document_first_chain_preserves_source_context_without_runtime_outputs():
    packet = canonical_packet_from_extracted_pdf(_extracted_pdf())
    structure = document_structure_from_document_packet(packet)
    structure_before = structure.model_dump()

    semantic = process_semantic_structure(structure)
    semantic_before = semantic.model_dump()
    selection = process_selection_v2(semantic)
    selection_before = selection.model_dump()
    candidates = process_rule_units_v2_candidates(structure, semantic, selection)

    block_nodes = [node for node in structure.nodes if node.block_id]
    paragraph_node = next(node for node in block_nodes if node.block_id == "paragraph-1")

    assert packet.document_id == "chain-doc-001"
    assert paragraph_node.source_text == "The applicant shall provide proof within 30 days."
    assert paragraph_node.source_anchor is not None
    assert paragraph_node.source_anchor.anchor_id == "pdf-page-1-block-paragraph-1"

    signal_types = {signal.signal_type for signal in semantic.signals}
    assert {"obligation", "timing", "evidence_requirement"}.issubset(signal_types)
    assert all(signal.structural_node_id == paragraph_node.structural_node_id for signal in semantic.signals)
    assert all(signal.source_anchor == paragraph_node.source_anchor for signal in semantic.signals)

    assert selection.selected_count == semantic.signal_count
    assert selection.excluded_count == 0
    assert all(signal.source_anchor == paragraph_node.source_anchor for signal in selection.selected_signals)

    assert candidates.candidate_count == 1
    candidate = candidates.candidates[0]
    assert candidate.assembly_status == "ready"
    assert candidate.structural_node_id == paragraph_node.structural_node_id
    assert candidate.source_text == paragraph_node.source_text
    assert candidate.source_anchor == paragraph_node.source_anchor
    assert set(candidate.signal_types) >= {"obligation", "timing", "evidence_requirement"}
    assert set(candidate.anchor_texts) >= {"shall", "within 30 days", "proof"}
    assert candidate.selected_signal_ids == [signal.signal_id for signal in selection.selected_signals]

    assert structure.model_dump() == structure_before
    assert semantic.model_dump() == semantic_before
    assert selection.model_dump() == selection_before

    payload_text = str(candidates.model_dump())
    for field in FORBIDDEN_FIELDS:
        assert field not in payload_text
