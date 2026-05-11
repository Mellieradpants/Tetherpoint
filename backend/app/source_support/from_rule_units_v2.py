"""Map document-first Rule Unit v2 candidates into shared support objects."""

from __future__ import annotations

from app.rule_units_v2.handler import RuleUnitV2CandidateResult
from app.source_support.models import SourceBackedSupportObject, SourceBackedSupportResult


def source_support_from_rule_unit_v2_candidates(
    candidates: RuleUnitV2CandidateResult,
) -> SourceBackedSupportResult:
    support_objects: list[SourceBackedSupportObject] = []

    for candidate in candidates.candidates:
        source_anchors = [candidate.source_anchor] if candidate.source_anchor is not None else []
        missing_support: list[str] = []
        if candidate.source_anchor is None:
            missing_support.append("source_anchor")
        if not candidate.source_text:
            missing_support.append("source_text")

        review_status = "ready" if candidate.assembly_status == "ready" and not missing_support else "needs_review"
        assembly_status = "ready" if review_status == "ready" else "needs_review"

        support_objects.append(
            SourceBackedSupportObject(
                support_id=candidate.candidate_id,
                support_kind="rule_unit_candidate",
                document_id=candidate.document_id,
                source_text=candidate.source_text,
                source_anchors=source_anchors,
                structural_node_ids=[candidate.structural_node_id],
                source_node_ids=[],
                signal_types=[str(signal_type) for signal_type in candidate.signal_types],
                anchor_texts=candidate.anchor_texts,
                assembly_status=assembly_status,
                review_status=review_status,
                meaning_eligible=False,
                verification_eligible=False,
                missing_support=missing_support,
                support_notes=candidate.assembly_notes,
            )
        )

    return SourceBackedSupportResult(
        document_id=candidates.document_id,
        support_objects=support_objects,
        support_count=len(support_objects),
        ready_count=sum(1 for item in support_objects if item.review_status == "ready"),
        needs_review_count=sum(1 for item in support_objects if item.review_status == "needs_review"),
        blocked_count=sum(1 for item in support_objects if item.review_status == "blocked"),
    )
