"""Canonical document packet models for document-first intake.

These models describe source capture and document pieces only. They do not
assign semantic labels, create meaning, or change the current pipeline path.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class SourceType(str, Enum):
    text = "text"
    xml = "xml"
    html = "html"
    json = "json"
    pdf = "pdf"
    unknown = "unknown"


class BlockType(str, Enum):
    heading = "heading"
    paragraph = "paragraph"
    list_item = "list_item"
    table = "table"
    table_row = "table_row"
    footnote = "footnote"
    header = "header"
    footer = "footer"
    unknown = "unknown"


class SourceAnchor(BaseModel):
    anchor_id: str
    source_type: SourceType
    document_id: str
    page_number: Optional[int] = None
    block_id: Optional[str] = None
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    bbox: Optional[list[float]] = None
    source_path: Optional[str] = None


class CanonicalBlock(BaseModel):
    block_id: str
    page_number: int
    order: int
    text: str
    source_anchor: SourceAnchor
    raw_text: Optional[str] = None
    normalized_text: Optional[str] = None
    block_type: BlockType = BlockType.unknown
    extraction_warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CanonicalPage(BaseModel):
    page_number: int
    blocks: list[CanonicalBlock] = Field(default_factory=list)
    source_anchor: Optional[SourceAnchor] = None
    raw_text: Optional[str] = None
    extraction_warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CanonicalDocumentPacket(BaseModel):
    document_id: str
    source_type: SourceType
    pages: list[CanonicalPage] = Field(default_factory=list)
    title: Optional[str] = None
    source_name: Optional[str] = None
    source_uri: Optional[str] = None
    source_hash: Optional[str] = None
    extraction_profile: dict[str, Any] = Field(default_factory=dict)
    extraction_warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
