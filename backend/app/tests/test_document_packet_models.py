"""Tests for canonical document packet schema models."""

import pytest
from pydantic import ValidationError

from app.schemas.document_packet import (
    CanonicalBlock,
    CanonicalDocumentPacket,
    CanonicalPage,
    SourceAnchor,
    SourceType,
)


def test_canonical_document_packet_validates_document_pieces():
    anchor = SourceAnchor(
        anchor_id="page-1-block-1",
        source_type=SourceType.pdf,
        document_id="doc-001",
        page_number=1,
        block_id="block-001",
        char_start=0,
        char_end=48,
        bbox=[10.0, 20.0, 300.0, 60.0],
    )
    block = CanonicalBlock(
        block_id="block-001",
        page_number=1,
        order=1,
        text="An applicant shall provide documentary proof.",
        source_anchor=anchor,
        raw_text="An applicant shall provide documentary proof.",
        normalized_text="An applicant shall provide documentary proof.",
    )
    page = CanonicalPage(page_number=1, blocks=[block])

    packet = CanonicalDocumentPacket(
        document_id="doc-001",
        source_type=SourceType.pdf,
        title="Example packet",
        pages=[page],
        extraction_profile={"adapter": "manual-test-packet"},
    )

    assert packet.document_id == "doc-001"
    assert packet.source_type == SourceType.pdf
    assert packet.pages[0].blocks[0].source_anchor.anchor_id == "page-1-block-1"
    assert packet.pages[0].blocks[0].text == "An applicant shall provide documentary proof."


def test_canonical_document_packet_rejects_invalid_source_type():
    with pytest.raises(ValidationError):
        CanonicalDocumentPacket(document_id="doc-001", source_type="spreadsheet")


def test_source_anchor_preserves_source_location_without_meaning_fields():
    anchor = SourceAnchor(
        anchor_id="char-0-12",
        source_type="text",
        document_id="doc-002",
        char_start=0,
        char_end=12,
    )

    payload = anchor.model_dump()

    assert payload["source_type"] == SourceType.text
    assert payload["char_start"] == 0
    assert "plain_meaning" not in payload
    assert "semantic_label" not in payload
