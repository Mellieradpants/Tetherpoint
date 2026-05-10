"""Semantic Structure detector for explicit document-text signals.

This layer reads document-first Structure output and emits separate signal
records. It does not mutate Structure nodes, decide eligibility, group Rule
Units, verify truth, or produce plain meaning.
"""

from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.document_packet import SourceAnchor
from app.structure.document_packet_adapter import DocumentStructureResult, DocumentStructureNode


SignalType = Literal[
    "obligation",
    "permission",
    "prohibition",
    "condition",
    "exception",
    "definition",
    "threshold",
    "timing",
    "evidence_requirement",
    "enforcement",
    "reference_dependency",
    "actor_action",
    "unknown",
]

DetectionBasis = Literal["explicit_text", "structural_pattern"]


class SemanticStructureSignal(BaseModel):
    signal_id: str
    document_id: str
    structural_node_id: str
    signal_type: SignalType
    anchor_text: str
    source_anchor: Optional[SourceAnchor]
    detection_basis: DetectionBasis
    actor: Optional[str] = None
    action: Optional[str] = None
    condition: Optional[str] = None
    temporal: Optional[str] = None
    target: Optional[str] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class SemanticStructureResult(BaseModel):
    document_id: str
    signals: list[SemanticStructureSignal] = Field(default_factory=list)
    signal_count: int = 0


_SIGNAL_PATTERNS: list[tuple[SignalType, re.Pattern[str]]] = [
    ("prohibition", re.compile(r"\b(?:may\s+not|shall\s+not|must\s+not|prohibited)\b", re.I)),
    ("obligation", re.compile(r"\b(?:shall|must)\b", re.I)),
    ("permission", re.compile(r"\bmay\b", re.I)),
    ("condition", re.compile(r"\b(?:if|when|provided\s+that|upon)\b", re.I)),
    ("exception", re.compile(r"\b(?:unless|except|notwithstanding)\b", re.I)),
    ("definition", re.compile(r"\b(?:means|includes|defined\s+as|refers\s+to)\b", re.I)),
    ("timing", re.compile(r"\b(?:within\s+\d+\s+days|no\s+later\s+than|by\s+[A-Z][A-Za-z]+\s+\d{1,2}(?:,\s*\d{4})?)\b", re.I)),
    ("evidence_requirement", re.compile(r"\b(?:proof|documentation|evidence|records)\b", re.I)),
    ("enforcement", re.compile(r"\b(?:enforce|enforcement|penalty|fine|sanction)\b", re.I)),
]


def _anchor_text(text: str, match: re.Match[str]) -> str:
    return text[match.start():match.end()]


def _signals_for_node(node: DocumentStructureNode, signal_index: int) -> list[SemanticStructureSignal]:
    text = node.source_text
    signals: list[SemanticStructureSignal] = []
    skip_permission_span: tuple[int, int] | None = None

    for signal_type, pattern in _SIGNAL_PATTERNS:
        match = pattern.search(text)
        if match is None:
            continue
        if signal_type == "prohibition":
            skip_permission_span = match.span()
        if signal_type == "permission" and skip_permission_span is not None:
            if skip_permission_span[0] <= match.start() < skip_permission_span[1]:
                continue

        signal_index += 1
        signals.append(
            SemanticStructureSignal(
                signal_id=f"signal-{signal_index:04d}",
                document_id=node.document_id,
                structural_node_id=node.structural_node_id,
                signal_type=signal_type,
                anchor_text=_anchor_text(text, match),
                source_anchor=node.source_anchor,
                detection_basis="explicit_text",
                confidence=1.0,
            )
        )

    return signals


def process_semantic_structure(structure: DocumentStructureResult) -> SemanticStructureResult:
    """Detect explicit semantic signals from block-level document nodes."""
    signals: list[SemanticStructureSignal] = []

    for node in structure.nodes:
        if not node.block_id:
            continue
        signals.extend(_signals_for_node(node, len(signals)))

    return SemanticStructureResult(
        document_id=structure.document_id,
        signals=signals,
        signal_count=len(signals),
    )
