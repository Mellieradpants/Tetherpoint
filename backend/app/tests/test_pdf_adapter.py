"""Tests for the PDF intake adapter stub."""

from app.input.pdf_adapter import canonical_packet_from_extracted_pdf
from app.schemas.document_packet import SourceType


SEMANTIC_FIELDS = {
    "plain_meaning",
    "semantic_label",
    "obligation",
    "condition",
    "exception",
    "verification",
    "verification_routes",
    "assertion_type",
}


def _sample_extracted_pdf():
    return {
        "document_id": "pdf-doc-001",
        "source_name": "Example PDF",
        "source_uri": "s3://example/source.pdf",
        "source_hash": "sha256:example",
        "extraction_warnings": ["document has no embedded outline"],
        "pages": [
            {
                "page_number": 3,
                "extraction_warnings": ["page rotation normalized"],
                "blocks": [
                    {
                        "block_id": "block-a",
                        "text": "The applicant shall provide documentary proof.",
                        "block_type": "paragraph",
                        "bbox": [12.0, 24.0, 300.0, 80.0],
                        "char_start": 10,
                        "char_end": 58,
                        "extraction_warnings": ["low text confidence"],
                    }
                ],
            }
        ],
    }


def test_pdf_adapter_converts_one_page_one_block_to_packet():
    packet = canonical_packet_from_extracted_pdf(_sample_extracted_pdf())

    assert packet.document_id == "pdf-doc-001"
    assert packet.source_type == SourceType.pdf
    assert packet.source_name == "Example PDF"
    assert packet.source_uri == "s3://example/source.pdf"
    assert packet.source_hash == "sha256:example"
    assert len(packet.pages) == 1
    assert len(packet.pages[0].blocks) == 1


def test_pdf_adapter_preserves_page_block_text_order_and_anchor():
    packet = canonical_packet_from_extracted_pdf(_sample_extracted_pdf())
    page = packet.pages[0]
    block = page.blocks[0]
    anchor = block.source_anchor

    assert page.page_number == 3
    assert block.block_id == "block-a"
    assert block.text == "The applicant shall provide documentary proof."
    assert block.raw_text == block.text
    assert block.normalized_text == block.text
    assert block.order == 1
    assert anchor.anchor_id == "pdf-page-3-block-block-a"
    assert anchor.source_type == SourceType.pdf
    assert anchor.document_id == "pdf-doc-001"
    assert anchor.page_number == 3
    assert anchor.block_id == "block-a"
    assert anchor.char_start == 10
    assert anchor.char_end == 58
    assert anchor.bbox == [12.0, 24.0, 300.0, 80.0]
    assert anchor.source_path == "s3://example/source.pdf"


def test_pdf_adapter_preserves_extraction_warnings():
    packet = canonical_packet_from_extracted_pdf(_sample_extracted_pdf())

    assert packet.extraction_warnings == ["document has no embedded outline"]
    assert packet.pages[0].extraction_warnings == ["page rotation normalized"]
    assert packet.pages[0].blocks[0].extraction_warnings == ["low text confidence"]


def test_pdf_adapter_does_not_emit_semantic_or_verification_fields():
    packet = canonical_packet_from_extracted_pdf(_sample_extracted_pdf())
    payload = packet.model_dump()
    payload_text = str(payload)

    for field in SEMANTIC_FIELDS:
        assert field not in payload
        assert field not in payload_text
