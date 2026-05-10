"""Selection v2 for Semantic Structure signals.

This layer evaluates signal eligibility only. It does not assign semantic
labels, group Rule Units, create Meaning, create verification routes, or mutate
source text and anchors.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.document_packet import SourceAnchor
from app.semantic_structure.handler import SemanticStructureResult, SemanticStructureSignal, SignalType


class SelectedSemanticSignal(BaseModel):
    signal_id: str
    document_id: str
    structural_node_id: str
    signal_type: SignalType
    anchor_text: str
    source_anchor: SourceAnchor
    eligibility_reason: str


class ExcludedSemanticSignal(BaseModel):
    signal_id: str
    document_id: str
    structural_node_id: str
    signal_type: SignalType
    anchor_text: str
    source_anchor: SourceAnchor | None
    exclusion_reason: str


class SelectionV2Result(BaseModel):
    document_id: str
    selected_signals: list[SelectedSemanticSignal] = Field(default_factory=list)
    excluded_signals: list[ExcludedSemanticSignal] = Field(default_factory=list)
    selection_log: list[str] = Field(default_factory=list)
    selected_count: int = 0
    excluded_count: int = 0


def _exclusion_reason(signal: SemanticStructureSignal) -> str | None:
    reasons: list[str] = []
    if signal.signal_type == "unknown":
        reasons.append("unknown signal_type")
    if not signal.anchor_text.strip():
        reasons.append("empty anchor_text")
    if signal.source_anchor is None:
        reasons.append("missing source_anchor")
    if not signal.structural_node_id.strip():
        reasons.append("missing structural_node_id")
    return "; ".join(reasons) if reasons else None


def process_selection_v2(semantic_structure: SemanticStructureResult) -> SelectionV2Result:
    """Select Semantic Structure signals eligible for downstream grouping."""
    selected: list[SelectedSemanticSignal] = []
    excluded: list[ExcludedSemanticSignal] = []
    log: list[str] = []

    for signal in semantic_structure.signals:
        exclusion_reason = _exclusion_reason(signal)
        if exclusion_reason:
            excluded.append(
                ExcludedSemanticSignal(
                    signal_id=signal.signal_id,
                    document_id=signal.document_id,
                    structural_node_id=signal.structural_node_id,
                    signal_type=signal.signal_type,
                    anchor_text=signal.anchor_text,
                    source_anchor=signal.source_anchor,
                    exclusion_reason=exclusion_reason,
                )
            )
            log.append(f"{signal.signal_id}: EXCLUDED - {exclusion_reason}")
            continue

        selected.append(
            SelectedSemanticSignal(
                signal_id=signal.signal_id,
                document_id=signal.document_id,
                structural_node_id=signal.structural_node_id,
                signal_type=signal.signal_type,
                anchor_text=signal.anchor_text,
                source_anchor=signal.source_anchor,
                eligibility_reason="source-backed explicit semantic signal",
            )
        )
        log.append(f"{signal.signal_id}: SELECTED - source-backed explicit semantic signal")

    return SelectionV2Result(
        document_id=semantic_structure.document_id,
        selected_signals=selected,
        excluded_signals=excluded,
        selection_log=log,
        selected_count=len(selected),
        excluded_count=len(excluded),
    )
