"""PDF intake adapter stub for already-extracted PDF content.

This module normalizes structured PDF extraction output into a
CanonicalDocumentPacket. It does not parse binary PDFs, run OCR, classify
semantic meaning, or rewrite source text.
"""

from __future__ import annotations

from typing import Any

from app.schemas.document_packet import (
    CanonicalBlock,
    CanonicalDocumentPacket,
    CanonicalPage,
    SourceAnchor,
    SourceType,
)


PDF_EXTRACTION_ADAPTER = "pdf_extracted_content_stub"


def _as_list(value: object) -> list:
    return value if isinstance(value, list) else []


def _warnings_from(value: dict[str, Any]) -> list[str]:
    warnings = value.get("extraction_warnings", value.get("warnings", []))
    return [str(warning) for warning in _as_list(warnings)]


def _anchor_id(page_number: int, block_id: str) -> str:
    return f"pdf-page-{page_number}-block-{block_id}"


def canonical_packet_from_extracted_pdf(extracted: dict[str, Any]) -> CanonicalDocumentPacket:
    """Build a CanonicalDocumentPacket from structured extracted PDF content.

    Expected input is already-extracted page and block data. This adapter owns
    source capture normalization only; Structure and later layers own document
    pieces, eligibility, grouping, governance, verification, and meaning.
    """
    document_id = str(extracted["document_id"])
    pages: list[CanonicalPage] = []

    for page in _as_list(extracted.get("pages")):
        page_number = int(page["page_number"])
        blocks: list[CanonicalBlock] = []

        for order, block in enumerate(_as_list(page.get("blocks")), start=1):
            block_id = str(block["block_id"])
            text = str(block.get("text", ""))
            anchor = SourceAnchor(
                anchor_id=_anchor_id(page_number, block_id),
                source_type=SourceType.pdf,
                document_id=document_id,
                page_number=page_number,
                block_id=block_id,
                char_start=block.get("char_start"),
                char_end=block.get("char_end"),
                bbox=block.get("bbox"),
                source_path=extracted.get("source_uri"),
            )
            blocks.append(
                CanonicalBlock(
                    block_id=block_id,
                    page_number=page_number,
                    order=order,
                    text=text,
                    raw_text=text,
                    normalized_text=text,
                    block_type=str(block.get("block_type", "text")),
                    source_anchor=anchor,
                    extraction_warnings=_warnings_from(block),
                )
            )

        pages.append(
            CanonicalPage(
                page_number=page_number,
                blocks=blocks,
                extraction_warnings=_warnings_from(page),
            )
        )

    return CanonicalDocumentPacket(
        document_id=document_id,
        source_type=SourceType.pdf,
        pages=pages,
        source_name=extracted.get("source_name"),
        source_uri=extracted.get("source_uri"),
        source_hash=extracted.get("source_hash"),
        extraction_profile={"adapter": PDF_EXTRACTION_ADAPTER},
        extraction_warnings=_warnings_from(extracted),
    )
