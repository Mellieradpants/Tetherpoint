"""Shared source-backed support objects for pipeline convergence.

This module defines the neutral support object shape that document-first and
runtime Rule Unit paths can converge toward. It is intentionally not wired into
Meaning, Verification, Governance, or the public analyze response yet.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.document_packet import SourceAnchor


SupportKind = Literal["rule_unit_candidate", "rule_unit"]
SupportStatus = Literal["ready", "needs_review", "blocked"]
SupportReviewStatus = Literal["ready", "needs_review", "blocked"]


class SourceBackedSupportObject(BaseModel):
    support_id: str
    support_kind: SupportKind
    document_id: str
    source_text: str
    source_anchors: list[SourceAnchor] = Field(default_factory=list)
    structural_node_ids: list[str] = Field(default_factory=list)
    source_node_ids: list[str] = Field(default_factory=list)
    signal_types: list[str] = Field(default_factory=list)
    anchor_texts: list[str] = Field(default_factory=list)
    assembly_status: SupportStatus
    review_status: SupportReviewStatus
    meaning_eligible: bool = False
    verification_eligible: bool = False
    missing_support: list[str] = Field(default_factory=list)
    support_notes: list[str] = Field(default_factory=list)


class SourceBackedSupportResult(BaseModel):
    document_id: str
    support_objects: list[SourceBackedSupportObject] = Field(default_factory=list)
    support_count: int = 0
    ready_count: int = 0
    needs_review_count: int = 0
    blocked_count: int = 0
