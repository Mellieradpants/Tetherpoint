"""Structure adapter for CanonicalDocumentPacket blocks.

This adapter prepares document pieces for Structure without assigning semantic
roles, producing meaning, creating verification routes, or rewriting source text.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.schemas.document_packet import (
    BlockType,
    CanonicalDocumentPacket,
    SourceAnchor,
)


StructuralNodeType = Literal[
    "heading",
    "paragraph",
    "list_item",
    "table",
    "table_row",
    "footnote",
    "header",
    "footer",
    "unknown",
]


_BLOCK_TYPE_TO_STRUCTURAL_TYPE: dict[BlockType, StructuralNodeType] = {
    BlockType.heading: "heading",
    BlockType.paragraph: "paragraph",
    BlockType.list_item: "list_item",
    BlockType.table: "table",
    BlockType.table_row: "table_row",
    BlockType.footnote: "footnote",
    BlockType.header: "header",
    BlockType.footer: "footer",
    BlockType.unknown: "unknown",
}


class StructureReadyBlock(BaseModel):
    document_id: str
    page_number: int
    block_id: str
    block_type: BlockType
    structural_type: StructuralNodeType
    order: int
    source_text: str
    normalized_text: str
    source_anchor: SourceAnchor


class StructureReadyDocument(BaseModel):
    document_id: str
    blocks: list[StructureReadyBlock]


def structure_ready_from_document_packet(packet: CanonicalDocumentPacket) -> StructureReadyDocument:
    """Convert packet blocks into ordered structure-ready records."""
    blocks: list[StructureReadyBlock] = []

    for page in sorted(packet.pages, key=lambda item: item.page_number):
        for block in sorted(page.blocks, key=lambda item: item.order):
            blocks.append(
                StructureReadyBlock(
                    document_id=packet.document_id,
                    page_number=block.page_number,
                    block_id=block.block_id,
                    block_type=block.block_type,
                    structural_type=_BLOCK_TYPE_TO_STRUCTURAL_TYPE[block.block_type],
                    order=block.order,
                    source_text=block.text,
                    normalized_text=block.normalized_text or block.text,
                    source_anchor=block.source_anchor,
                )
            )

    return StructureReadyDocument(document_id=packet.document_id, blocks=blocks)
