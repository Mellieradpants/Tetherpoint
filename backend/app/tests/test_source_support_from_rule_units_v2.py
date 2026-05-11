"""Tests for shared source-backed support objects from Rule Units v2 candidates."""

from app.rule_units_v2.handler import RuleUnitV2Candidate, RuleUnitV2CandidateResult
from app.schemas.document_packet import SourceAnchor
from app.source_support.from_rule_units_v2 import source_support_from_rule_unit_v2_candidates


def _candidate() -> RuleUnitV2Candidate:
    return RuleUnitV2Candidate(
        candidate_id="candidate-0001",
        document_id="doc-001",
        structural_node_id="node-001",
        source_anchor=SourceAnchor(
            anchor_id="anchor-001",
            source_type="pdf",
            document_id="doc-001",
            page_number=2,
            block_id="block-001",
        ),
        source_text="The applicant shall provide proof within 30 days.",
        selected_signal_ids=["signal-001", "signal-002", "signal-003"],
        signal_types=["obligation", "timing", "evidence_requirement"],
        anchor_texts=["shall", "within 30 days", "proof"],
        assembly_status="ready",
        assembly_notes=["grouped selected signals by structural_node_id"],
    )


def test_v2_candidate_maps_to_shared_source_support_object_without_downstream_eligibility():
    result = source_support_from_rule_unit_v2_candidates(
        RuleUnitV2CandidateResult(
            document_id="doc-001",
            candidates=[_candidate()],
            candidate_count=1,
        )
    )

    assert result.document_id == "doc-001"
    assert result.support_count == 1
    assert result.ready_count == 1

    support = result.support_objects[0]
    assert support.support_id == "candidate-0001"
    assert support.support_kind == "rule_unit_candidate"
    assert support.document_id == "doc-001"
    assert support.source_text == "The applicant shall provide proof within 30 days."
    assert support.source_anchors[0].anchor_id == "anchor-001"
    assert support.structural_node_ids == ["node-001"]
    assert support.signal_types == ["obligation", "timing", "evidence_requirement"]
    assert support.anchor_texts == ["shall", "within 30 days", "proof"]
    assert support.assembly_status == "ready"
    assert support.review_status == "ready"
    assert support.meaning_eligible is False
    assert support.verification_eligible is False


def test_missing_source_anchor_forces_review_state():
    candidate = _candidate()
    candidate.source_anchor = None

    result = source_support_from_rule_unit_v2_candidates(
        RuleUnitV2CandidateResult(
            document_id="doc-001",
            candidates=[candidate],
            candidate_count=1,
        )
    )

    support = result.support_objects[0]
    assert support.review_status == "needs_review"
    assert support.assembly_status == "needs_review"
    assert support.missing_support == ["source_anchor"]
    assert result.ready_count == 0
    assert result.needs_review_count == 1
