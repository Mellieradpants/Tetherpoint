"""Tests for converting CanonicalDocumentPacket blocks to document-first Structure."""

from app.schemas.document_packet import (
    BlockType,
    CanonicalBlock,
    CanonicalDocumentPacket,
    CanonicalPage,
    SourceAnchor,
    SourceType,
)
from app.structure.document_packet_adapter import (
    document_structure_from_document_packet,
    structure_ready_from_document_packet,
)


FORBIDDEN_FIELDS = {
    "plain_meaning",
    "semantic_label",
    "verification",
    "verification_routes",
    "rule_unit_id",
    "source_node_ids",
    "obligation",
    "condition",
    "exception",
    "role",
    "PRIMARY_RULE",
    "CONDITION",
    "EXCEPTION",
    "DEFINITION",
    "EVIDENCE",
    "CONSEQUENCE",
    "BOILERPLATE",
}


def _anchor(document_id: str, page_number: int, block_id: str) -> SourceAnchor:
    return SourceAnchor(
        anchor_id=f"pdf-page-{page_number}-block-{block_id}",
        source_type=SourceType.pdf,
        document_id=document_id,
        page_number=page_number,
        block_id=block_id,
        char_start=0,
        char_end=10,
    )


def _packet() -> CanonicalDocumentPacket:
    document_id = "doc-structure-001"
    return CanonicalDocumentPacket(
        document_id=document_id,
        source_type=SourceType.pdf,
        pages=[
            CanonicalPage(
                page_number=2,
                blocks=[
                    CanonicalBlock(
                        block_id="heading-1",
                        page_number=2,
                        order=1,
                        text="Section 1",
                        normalized_text="Section 1",
                        block_type=BlockType.heading,
                        source_anchor=_anchor(document_id, 2, "heading-1"),
                    ),
                    CanonicalBlock(
                        block_id="paragraph-1",
                        page_number=2,
                        order=2,
                        text="The applicant shall provide proof.",
                        normalized_text="The applicant shall provide proof.",
                        block_type=BlockType.paragraph,
                        source_anchor=_anchor(document_id, 2, "paragraph-1"),
                    ),
                ],
            )
        ],
    )


def _block_nodes():
    result = document_structure_from_document_packet(_packet())
    return [node for node in result.nodes if node.block_id]


def test_packet_with_one_page_heading_and_paragraph_converts_to_document_structure_nodes():
    result = document_structure_from_document_packet(_packet())

    assert result.document_id == "doc-structure-001"
    assert [node.structural_type for node in result.nodes] == [
        "document",
        "page",
        "heading",
        "paragraph",
    ]
    assert len(_block_nodes()) == 2


def test_compatibility_wrapper_returns_document_structure_result():
    result = structure_ready_from_document_packet(_packet())

    assert result.document_id == "doc-structure-001"
    assert len(result.nodes) == 4


def test_document_structure_preserves_document_piece_fields_and_anchor():
    first, second = _block_nodes()

    assert first.document_id == "doc-structure-001"
    assert first.structural_node_id == "document:doc-structure-001:page:2:block:heading-1"
    assert first.parent_id == "document:doc-structure-001:page:2"
    assert first.page_number == 2
    assert first.block_id == "heading-1"
    assert first.block_type == BlockType.heading
    assert first.structural_type == "heading"
    assert first.order == 1
    assert first.depth == 2
    assert first.source_text == "Section 1"
    assert first.normalized_text == "Section 1"
    assert first.source_anchor is not None
    assert first.source_anchor.anchor_id == "pdf-page-2-block-heading-1"
    assert first.source_anchor.block_id == "heading-1"

    assert second.page_number == 2
    assert second.block_id == "paragraph-1"
    assert second.block_type == BlockType.paragraph
    assert second.structural_type == "paragraph"
    assert second.order == 2
    assert second.depth == 2
    assert second.source_text == "The applicant shall provide proof."
    assert second.normalized_text == "The applicant shall provide proof."
    assert second.source_anchor is not None
    assert second.source_anchor.anchor_id == "pdf-page-2-block-paragraph-1"


def test_heading_block_maps_to_structural_heading_only():
    heading = _block_nodes()[0]
    payload = heading.model_dump()
    payload_text = str(payload)

    assert heading.structural_type == "heading"
    assert "role" not in payload
    assert "PRIMARY_RULE" not in payload_text


def test_paragraph_with_shall_does_not_become_primary_rule_or_obligation():
    paragraph = _block_nodes()[1]
    payload = paragraph.model_dump()
    payload_text = str(payload)

    assert paragraph.structural_type == "paragraph"
    assert paragraph.source_text == "The applicant shall provide proof."
    assert "role" not in payload
    assert "obligation" not in payload
    assert "PRIMARY_RULE" not in payload_text


def test_document_structure_output_has_no_semantic_role_meaning_verification_or_rule_unit_fields():
    result = document_structure_from_document_packet(_packet())
    payload = result.model_dump()
    payload_text = str(payload)

    for field in FORBIDDEN_FIELDS:
        assert field not in payload
        assert field not in payload_text
