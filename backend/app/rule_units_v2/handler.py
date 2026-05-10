"""Rule Units v2 candidate grouping for selected Semantic Structure signals.

This layer groups selected signals by source-backed structure node. It does not
produce meaning, verification routes, governance decisions, or final runtime
Rule Units.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.document_packet import SourceAnchor
from app.selection_v2.handler import SelectionV2Result, SelectedSemanticSignal
from app.semantic_structure.handler import SemanticStructureResult, SignalType
from app.structure.document_packet_adapter import DocumentStructureResult, DocumentStructureNode


AssemblyStatus = Literal["ready", "needs_review", "blocked"]


class RuleUnitV2Candidate(BaseModel):
    candidate_id: str
    document_id: str
    structural_node_id: str
    source_anchor: SourceAnchor | None
    source_text: str
    selected_signal_ids: list[str] = Field(default_factory=list)
    signal_types: list[SignalType] = Field(default_factory=list)
    anchor_texts: list[str] = Field(default_factory=list)
    assembly_status: AssemblyStatus
    assembly_notes: list[str] = Field(default_factory=list)


class RuleUnitV2CandidateResult(BaseModel):
    document_id: str
    candidates: list[RuleUnitV2Candidate] = Field(default_factory=list)
    candidate_count: int = 0
    assembly_log: list[str] = Field(default_factory=list)


def _structure_nodes_by_id(structure: DocumentStructureResult) -> dict[str, DocumentStructureNode]:
    return {node.structural_node_id: node for node in structure.nodes}


def _signals_by_structure_node(selection: SelectionV2Result) -> dict[str, list[SelectedSemanticSignal]]:
    grouped: dict[str, list[SelectedSemanticSignal]] = {}
    for signal in selection.selected_signals:
        grouped.setdefault(signal.structural_node_id, []).append(signal)
    return grouped


def _unique_values(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _candidate_status(
    structure_node: DocumentStructureNode | None,
    signals: list[SelectedSemanticSignal],
) -> tuple[AssemblyStatus, list[str]]:
    notes: list[str] = []
    if structure_node is None:
        notes.append("matching DocumentStructureNode was not found")
    if any(signal.source_anchor is None for signal in signals):
        notes.append("selected signal is missing source_anchor")
    if notes:
        return "needs_review", notes
    return "ready", ["grouped selected signals by structural_node_id"]


def process_rule_units_v2_candidates(
    structure: DocumentStructureResult,
    semantic_structure: SemanticStructureResult,
    selection: SelectionV2Result,
) -> RuleUnitV2CandidateResult:
    """Group selected semantic signals into source-backed candidates."""
    _ = semantic_structure
    nodes_by_id = _structure_nodes_by_id(structure)
    grouped_signals = _signals_by_structure_node(selection)
    candidates: list[RuleUnitV2Candidate] = []
    assembly_log: list[str] = []

    for index, structural_node_id in enumerate(sorted(grouped_signals), start=1):
        signals = grouped_signals[structural_node_id]
        structure_node = nodes_by_id.get(structural_node_id)
        status, notes = _candidate_status(structure_node, signals)
        source_anchor = structure_node.source_anchor if structure_node is not None else signals[0].source_anchor
        source_text = structure_node.source_text if structure_node is not None else ""
        candidate = RuleUnitV2Candidate(
            candidate_id=f"candidate-{index:04d}",
            document_id=selection.document_id,
            structural_node_id=structural_node_id,
            source_anchor=source_anchor,
            source_text=source_text,
            selected_signal_ids=[signal.signal_id for signal in signals],
            signal_types=[signal.signal_type for signal in signals],
            anchor_texts=_unique_values([signal.anchor_text for signal in signals]),
            assembly_status=status,
            assembly_notes=notes,
        )
        candidates.append(candidate)
        assembly_log.append(
            f"{candidate.candidate_id}: {status} - {structural_node_id} - {len(signals)} selected signal(s)"
        )

    return RuleUnitV2CandidateResult(
        document_id=selection.document_id,
        candidates=candidates,
        candidate_count=len(candidates),
        assembly_log=assembly_log,
    )
