"""Tests for Selection v2 over Semantic Structure signals."""

from app.schemas.document_packet import SourceAnchor, SourceType
from app.selection_v2.handler import process_selection_v2
from app.semantic_structure.handler import SemanticStructureResult, SemanticStructureSignal


FORBIDDEN_FIELDS = {
    "plain_meaning",
    "verification_route",
    "verification_routes",
    "governance",
    "rule_unit",
    "rule_unit_id",
}


def _anchor() -> SourceAnchor:
    return SourceAnchor(
        anchor_id="anchor-1",
        source_type=SourceType.pdf,
        document_id="doc-select-001",
        page_number=1,
        block_id="block-1",
    )


def _signal(**overrides) -> SemanticStructureSignal:
    values = {
        "signal_id": "signal-0001",
        "document_id": "doc-select-001",
        "structural_node_id": "node-1",
        "signal_type": "obligation",
        "anchor_text": "shall",
        "source_anchor": _anchor(),
        "detection_basis": "explicit_text",
        "confidence": 1.0,
    }
    values.update(overrides)
    return SemanticStructureSignal(**values)


def _result(*signals: SemanticStructureSignal) -> SemanticStructureResult:
    return SemanticStructureResult(
        document_id="doc-select-001",
        signals=list(signals),
        signal_count=len(signals),
    )


def test_valid_obligation_signal_with_anchor_is_selected():
    result = process_selection_v2(_result(_signal()))

    assert result.selected_count == 1
    assert result.excluded_count == 0
    assert result.selected_signals[0].eligibility_reason == "source-backed explicit semantic signal"


def test_unknown_signal_type_is_excluded():
    result = process_selection_v2(_result(_signal(signal_type="unknown")))

    assert result.selected_count == 0
    assert result.excluded_count == 1
    assert result.excluded_signals[0].exclusion_reason == "unknown signal_type"


def test_empty_anchor_text_is_excluded():
    result = process_selection_v2(_result(_signal(anchor_text="  ")))

    assert result.selected_count == 0
    assert result.excluded_count == 1
    assert result.excluded_signals[0].exclusion_reason == "empty anchor_text"


def test_missing_source_anchor_is_excluded():
    result = process_selection_v2(_result(_signal(source_anchor=None)))

    assert result.selected_count == 0
    assert result.excluded_count == 1
    assert result.excluded_signals[0].exclusion_reason == "missing source_anchor"


def test_selected_signal_preserves_source_fields():
    signal = _signal(signal_id="signal-preserve", structural_node_id="node-preserve")
    result = process_selection_v2(_result(signal))
    selected = result.selected_signals[0]

    assert selected.signal_id == "signal-preserve"
    assert selected.structural_node_id == "node-preserve"
    assert selected.signal_type == "obligation"
    assert selected.anchor_text == "shall"
    assert selected.source_anchor == signal.source_anchor


def test_selection_v2_does_not_mutate_semantic_structure_result():
    semantic_result = _result(_signal())
    before = semantic_result.model_dump()

    process_selection_v2(semantic_result)

    assert semantic_result.model_dump() == before


def test_selection_v2_output_has_no_downstream_fields():
    result = process_selection_v2(_result(_signal()))
    payload = result.model_dump()
    payload_text = str(payload)

    for field in FORBIDDEN_FIELDS:
        assert field not in payload
        assert field not in payload_text
