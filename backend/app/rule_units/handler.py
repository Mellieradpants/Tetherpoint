"""Rule Unit Builder: groups atomic Structure nodes into interpretation units.

Atomic nodes remain the source trace layer. Rule units are the smallest units
eligible for Meaning. This layer is deterministic and does not use AI.
"""

from __future__ import annotations

from collections import defaultdict
import re

from app.schemas.models import (
    OriginResult,
    OriginSignal,
    ReferencedSource,
    RuleUnit,
    RuleUnitNodeRef,
    RuleUnitReferencedSource,
    RuleUnitResult,
    SelectionResult,
    StructureNode,
    StructureResult,
)

_ROLE_BUCKETS = {
    "CONDITION": "conditions",
    "EXCEPTION": "exceptions",
    "EVIDENCE": "evidence_requirements",
    "CONSEQUENCE": "consequences",
    "DEFINITION": "definitions",
}

_STANDALONE_EXCEPTION_RE = re.compile(
    r"\b(does\s+not\s+apply|do\s+not\s+apply|shall\s+not\s+apply|is\s+not\s+required|are\s+not\s+required|except\s+that|unless|notwithstanding)\b",
    re.I,
)

_RULE_SIGNAL_RE = re.compile(
    r"\b(must|shall|may|require|requires|required|requirement|does\s+not\s+apply|do\s+not\s+apply|shall\s+not\s+apply|is\s+subject\s+to|repealed)\b",
    re.I,
)

_REFERENCE_ACT_RE = re.compile(r"\b([A-Z][A-Za-z0-9\s,-]+ Act of \d{4}|REAL ID Act of 2005)\b", re.I)
_REFERENCE_SIGNAL_NAMES = {"referenced_act", "usc_citation"}


def _node_ref(node: StructureNode) -> RuleUnitNodeRef:
    return RuleUnitNodeRef(
        node_id=node.node_id,
        text=node.source_text,
        role=node.role,
    )


def _clean_joined_text(text: str) -> str:
    # Parser fragments sometimes introduce a sentence break before a list item.
    # Preserve explicit source wording for common legal-list continuations.
    text = re.sub(r"\b(includes?|include)\.\s+", lambda m: f"{m.group(1)} ", text, flags=re.I)
    text = re.sub(r"\b(area)\.\s+(critical\b)", r"\1 includes \2", text, flags=re.I)
    return text


def _combined_text(nodes: list[StructureNode]) -> str:
    return _clean_joined_text("\n".join(node.source_text.strip() for node in nodes if node.source_text.strip()))


def _unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = " ".join(value.split()).strip(" .;,")
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(cleaned)
    return result


def _extract_external_references(text: str) -> list[str]:
    return _unique_preserve_order([match.group(1) for match in _REFERENCE_ACT_RE.finditer(text)])


def _has_unsafe_node(nodes: list[StructureNode]) -> bool:
    return any(node.validation_status == "invalid" for node in nodes)


def _is_standalone_exception_node(node: StructureNode) -> bool:
    text = node.source_text or node.normalized_text or ""
    return (
        node.role in {"EXCEPTION", "CONSEQUENCE", "CONDITION"}
        and bool(_STANDALONE_EXCEPTION_RE.search(text))
        and bool(_RULE_SIGNAL_RE.search(text))
    )


def _promote_standalone_exception(nodes: list[StructureNode]) -> StructureNode | None:
    """Find an exception-style provision that can safely anchor a rule unit.

    Legislative exception provisions can be complete rules even when they do not
    contain a normal PRIMARY_RULE role. Example: "The reporting requirement ...
    does not apply ..., unless ...".
    """
    candidates = [node for node in nodes if _is_standalone_exception_node(node)]
    if len(candidates) != 1:
        return None
    return candidates[0]


def _contains_reference(text: str, reference: str) -> bool:
    if not reference:
        return False
    return reference.lower() in text.lower()


def _anchors_for_reference(nodes: list[StructureNode], reference: str) -> list[str]:
    anchors: list[str] = []
    for node in nodes:
        node_text = node.source_text or node.normalized_text or ""
        if _contains_reference(node_text, reference):
            anchors.append(node.source_anchor)
    return _unique_preserve_order(anchors)


def _packet_from_referenced_source(
    source: ReferencedSource,
    source_text: str,
    source_nodes: list[StructureNode],
) -> RuleUnitReferencedSource | None:
    if not (_contains_reference(source_text, source.matched_text) or _contains_reference(source_text, source.name)):
        return None

    anchors = _anchors_for_reference(source_nodes, source.matched_text) or _anchors_for_reference(source_nodes, source.name)
    return RuleUnitReferencedSource(
        name=source.name,
        referenceType=source.reference_type,
        matchedText=source.matched_text,
        officialSourceUrl=source.official_source_url,
        retrievalStatus="not_attempted",
        anchors=anchors,
        limits=["Referenced source text has not been retrieved; manual source text is required for Extended Meaning."],
    )


def _packet_from_signal(
    signal: OriginSignal,
    source_text: str,
    source_nodes: list[StructureNode],
) -> RuleUnitReferencedSource | None:
    if signal.signal not in _REFERENCE_SIGNAL_NAMES or not _contains_reference(source_text, signal.value):
        return None

    return RuleUnitReferencedSource(
        name=signal.value,
        referenceType=signal.signal.upper(),
        matchedText=signal.value,
        officialSourceUrl=None,
        retrievalStatus="not_attempted",
        anchors=_anchors_for_reference(source_nodes, signal.value),
        limits=["Referenced source text has not been retrieved; manual source text is required for Extended Meaning."],
    )


def _reference_packets(
    source_text: str,
    source_nodes: list[StructureNode],
    origin_result: OriginResult | None,
) -> list[RuleUnitReferencedSource]:
    if origin_result is None or origin_result.status == "skipped":
        return []

    packets: list[RuleUnitReferencedSource] = []
    seen: set[tuple[str, str]] = set()

    for source in origin_result.referenced_sources:
        packet = _packet_from_referenced_source(source, source_text, source_nodes)
        if packet is None:
            continue
        key = (packet.name.lower(), packet.matchedText.lower())
        if key in seen:
            continue
        seen.add(key)
        packets.append(packet)

    for signal in origin_result.origin_identity_signals:
        packet = _packet_from_signal(signal, source_text, source_nodes)
        if packet is None:
            continue
        key = (packet.name.lower(), packet.matchedText.lower())
        if key in seen:
            continue
        seen.add(key)
        packets.append(packet)

    return packets


def _build_rule_unit(
    unit_index: int,
    section_id: str,
    primary: StructureNode,
    children: list[StructureNode],
    fragments: list[StructureNode],
    origin_result: OriginResult | None,
) -> RuleUnit:
    source_nodes = [primary] + children
    source_text_combined = _combined_text(source_nodes)
    referenced_sources = _reference_packets(source_text_combined, source_nodes, origin_result)
    assembly_issues: list[str] = []

    if _has_unsafe_node(source_nodes):
        assembly_issues.append("invalid_source_node")

    role_refs: dict[str, list[RuleUnitNodeRef]] = {
        "conditions": [],
        "exceptions": [],
        "evidence_requirements": [],
        "consequences": [],
        "definitions": [],
    }
    timing: list[RuleUnitNodeRef] = []
    jurisdiction: list[RuleUnitNodeRef] = []
    mechanisms: list[RuleUnitNodeRef] = []

    for child in children:
        bucket = _ROLE_BUCKETS.get(child.role)
        if bucket:
            role_refs[bucket].append(_node_ref(child))
        if child.temporal:
            timing.append(_node_ref(child))
        if child.jurisdiction:
            jurisdiction.append(_node_ref(child))
        if child.mechanism:
            mechanisms.append(_node_ref(child))

    if primary.temporal:
        timing.append(_node_ref(primary))
    if primary.jurisdiction:
        jurisdiction.append(_node_ref(primary))
    if primary.mechanism:
        mechanisms.append(_node_ref(primary))

    assembly_status = "complete" if not assembly_issues else "needs_review"
    review_status = "ready" if assembly_status == "complete" else "needs_review"

    return RuleUnit(
        rule_unit_id=f"rule-{unit_index:04d}",
        section_id=section_id,
        primary_node_id=primary.node_id,
        primary_text=primary.source_text,
        conditions=role_refs["conditions"],
        exceptions=role_refs["exceptions"],
        evidence_requirements=role_refs["evidence_requirements"],
        consequences=role_refs["consequences"],
        definitions=role_refs["definitions"],
        timing=timing,
        jurisdiction=jurisdiction,
        mechanisms=mechanisms,
        external_references=_extract_external_references(source_text_combined),
        requires_reference_resolution=bool(referenced_sources),
        referenced_sources=referenced_sources,
        source_node_ids=[node.node_id for node in source_nodes],
        fragment_node_ids=[node.node_id for node in fragments],
        source_text_combined=source_text_combined,
        assembly_status=assembly_status,
        assembly_issues=assembly_issues,
        meaning_eligible=assembly_status == "complete",
        verification_eligible=assembly_status == "complete",
        review_status=review_status,
    )


def _build_review_unit(
    unit_index: int,
    section_id: str,
    nodes: list[StructureNode],
    issue: str,
    origin_result: OriginResult | None,
) -> RuleUnit:
    fragments = [node for node in nodes if "fragment:incomplete" in node.tags]
    source_text_combined = _combined_text(nodes)
    referenced_sources = _reference_packets(source_text_combined, nodes, origin_result)
    return RuleUnit(
        rule_unit_id=f"review-{unit_index:04d}",
        section_id=section_id,
        primary_node_id=None,
        primary_text=None,
        conditions=[],
        exceptions=[],
        evidence_requirements=[],
        consequences=[],
        definitions=[],
        timing=[],
        jurisdiction=[],
        mechanisms=[],
        external_references=_extract_external_references(source_text_combined),
        requires_reference_resolution=bool(referenced_sources),
        referenced_sources=referenced_sources,
        source_node_ids=[node.node_id for node in nodes],
        fragment_node_ids=[node.node_id for node in fragments],
        source_text_combined=source_text_combined,
        assembly_status="needs_review",
        assembly_issues=[issue],
        meaning_eligible=False,
        verification_eligible=False,
        review_status="needs_review",
    )


def process_rule_units(
    structure: StructureResult,
    selection: SelectionResult,
    origin_result: OriginResult | None = None,
) -> RuleUnitResult:
    """Group selected atomic nodes into rule units.

    Selection means a node can participate in assembly. It does not mean the
    node is itself a Meaning target.
    """
    selected_ids = {node.node_id for node in selection.selected_nodes}
    sections: dict[str, list[StructureNode]] = defaultdict(list)
    for node in structure.nodes:
        sections[node.section_id].append(node)

    rule_units: list[RuleUnit] = []
    assembly_log: list[str] = []
    unit_index = 1

    for section_id in sorted(sections):
        section_nodes = sections[section_id]
        selected_section_nodes = [node for node in section_nodes if node.node_id in selected_ids]
        fragments = [node for node in section_nodes if "fragment:incomplete" in node.tags]
        primaries = [node for node in selected_section_nodes if node.role == "PRIMARY_RULE"]

        if not selected_section_nodes:
            assembly_log.append(f"{section_id}: no selected nodes available for rule unit assembly")
            continue

        if not primaries:
            promoted = _promote_standalone_exception(selected_section_nodes)
            if promoted is not None:
                children = [node for node in selected_section_nodes if node.node_id != promoted.node_id]
                unit = _build_rule_unit(unit_index, section_id, promoted, children, fragments, origin_result)
                rule_units.append(unit)
                assembly_log.append(
                    f"{section_id}: {unit.rule_unit_id} assembled from standalone exception {promoted.node_id} "
                    f"with {len(children)} supporting node(s) and {len(fragments)} fragment(s)"
                )
                unit_index += 1
                continue

            rule_units.append(_build_review_unit(
                unit_index,
                section_id,
                selected_section_nodes + fragments,
                "missing_primary_rule",
                origin_result,
            ))
            assembly_log.append(f"{section_id}: NEEDS_REVIEW - missing PRIMARY_RULE")
            unit_index += 1
            continue

        for primary in primaries:
            children = [
                node
                for node in selected_section_nodes
                if node.node_id != primary.node_id and node.parent_id == primary.node_id
            ]

            # If the section has one primary, same-section non-primary selected nodes
            # without a parent can safely attach as supporting material. Multiple
            # primaries require explicit parent linkage to avoid merging separate rules.
            if len(primaries) == 1:
                known_child_ids = {node.node_id for node in children}
                children.extend(
                    node
                    for node in selected_section_nodes
                    if node.node_id != primary.node_id
                    and node.node_id not in known_child_ids
                    and node.parent_id is None
                    and node.role in _ROLE_BUCKETS
                )

            unit = _build_rule_unit(unit_index, section_id, primary, children, fragments, origin_result)
            rule_units.append(unit)
            assembly_log.append(
                f"{section_id}: {unit.rule_unit_id} assembled from primary {primary.node_id} "
                f"with {len(children)} supporting node(s) and {len(fragments)} fragment(s)"
            )
            unit_index += 1

        orphan_nodes = [
            node
            for node in selected_section_nodes
            if node.role != "PRIMARY_RULE"
            and node.parent_id
            and node.parent_id not in {primary.node_id for primary in primaries}
        ]
        if orphan_nodes:
            assembly_log.append(
                f"{section_id}: orphan selected node(s): "
                + ", ".join(node.node_id for node in orphan_nodes)
            )

    return RuleUnitResult(
        rule_units=rule_units,
        unit_count=len(rule_units),
        ready_count=sum(1 for unit in rule_units if unit.review_status == "ready"),
        needs_review_count=sum(1 for unit in rule_units if unit.review_status != "ready"),
        assembly_log=assembly_log,
    )
