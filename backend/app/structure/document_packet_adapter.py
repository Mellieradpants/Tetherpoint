"""Document-first Structure adapter for CanonicalDocumentPacket blocks.

This adapter prepares document pieces for Structure without assigning semantic
roles, producing meaning, creating verification routes, or rewriting source text.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.document_packet import (
    BlockType,
    CanonicalDocumentPacket,
    SourceAnchor,
)


StructuralNodeType = Literal[
    "document",
    "page",
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


class DocumentStructureNode(BaseModel):
    document_id: str
    structural_node_id: str
    parent_id: Optional[str] = None
    page_number: Optional[int] = None
    block_id: Optional[str] = None
    block_type: Optional[BlockType] = None
    structural_type: StructuralNodeType
    order: int
    depth: int
    source_text: str
    normalized_text: str
    source_anchor: Optional[SourceAnchor] = None


class DocumentStructureResult(BaseModel):
    document_id: str
    nodes: list[DocumentStructureNode]


# Backward-compatible internal aliases from the first adapter pass.
StructureReadyBlock = DocumentStructureNode
StructureReadyDocument = DocumentStructureResult


def _document_node(packet: CanonicalDocumentPacket) -> DocumentStructureNode:
    return DocumentStructureNode(
        document_id=packet.document_id,
        structural_node_id=f"document:{packet.document_id}",
        parent_id=None,
        page_number=None,
        block_id=None,
        block_type=None,
        structural_type="document",
        order=0,
        depth=0,
        source_text="",
        normalized_text="",
        source_anchor=None,
    )


def _page_node(packet: CanonicalDocumentPacket, page_number: int, order: int) -> DocumentStructureNode:
    return DocumentStructureNode(
        document_id=packet.document_id,
        structural_node_id=f"document:{packet.document_id}:page:{page_number}",
        parent_id=f"document:{packet.document_id}",
        page_number=page_number,
        block_id=None,
        block_type=None,
        structural_type="page",
        order=order,
        depth=1,
        source_text="",
        normalized_text="",
        source_anchor=None,
    )


def _block_node(
    packet: CanonicalDocumentPacket,
    page_number: int,
    block,
) -> DocumentStructureNode:
    page_node_id = f"document:{packet.document_id}:page:{page_number}"
    return DocumentStructureNode(
        document_id=packet.document_id,
        structural_node_id=f"{page_node_id}:block:{block.block_id}",
        parent_id=page_node_id,
        page_number=block.page_number,
        block_id=block.block_id,
        block_type=block.block_type,
        structural_type=_BLOCK_TYPE_TO_STRUCTURAL_TYPE[block.block_type],
        order=block.order,
        depth=2,
        source_text=block.text,
        normalized_text=block.normalized_text or block.text,
        source_anchor=block.source_anchor,
    )


def document_structure_from_document_packet(packet: CanonicalDocumentPacket) -> DocumentStructureResult:
    """Convert packet blocks into document-first Structure nodes."""
    nodes: list[DocumentStructureNode] = [_document_node(packet)]

    for page_order, page in enumerate(sorted(packet.pages, key=lambda item: item.page_number), start=1):
        nodes.append(_page_node(packet, page.page_number, page_order))
        for block in sorted(page.blocks, key=lambda item: item.order):
            nodes.append(_block_node(packet, page.page_number, block))

    return DocumentStructureResult(document_id=packet.document_id, nodes=nodes)


def structure_ready_from_document_packet(packet: CanonicalDocumentPacket) -> DocumentStructureResult:
    """Compatibility wrapper for the internal document-first Structure adapter."""
    return document_structure_from_document_packet(packet)
