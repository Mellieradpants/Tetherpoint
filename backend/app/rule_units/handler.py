"""Rule Unit Builder: groups atomic Structure nodes into interpretation units.

Atomic nodes remain the source trace layer. Rule units are the smallest units
eligible for Meaning. This layer is deterministic and does not use AI.
"""

from __future__ import annotations

from collections import defaultdict

from app.schemas.models import RuleUnit, RuleUnitNodeRef, RuleUnitResult, SelectionResult, StructureNode, StructureResult

_ROLE_BUCKETS = {
    "CONDITION": "conditions",
    "EXCEPTION": "exceptions",
    "EVIDENCE": "evidence_requirements",
    "CONSEQUENCE": "consequences",
    "DEFINITION": "definitions",
}


def _node_ref(node: StructureNode) -> RuleUnitNodeRef:
    return RuleUnitNodeRef(
        node_id=node.node_id,
        text=node.source_text,
        role=node.role,
    )


def _combined_text(nodes: list[StructureNode]) -> str:
    return "\n".join(node.source_text.strip() for node in nodes if node.source_text.strip())


def _has_unsafe_node(nodes: list[StructureNode]) -> bool:
    return any(node.validation_status == "invalid" for node in nodes)


def _build_rule_unit(
    unit_index: int,
    section_id: str,
    primary: StructureNode,
    children: list[StructureNode],
    fragments: list[StructureNode],
) -> RuleUnit:
    source_nodes = [primary] + children
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
        source_node_ids=[node.node_id for node in source_nodes],
        fragment_node_ids=[node.node_id for node in fragments],
        source_text_combined=_combined_text(source_nodes),
        assembly_status=assembly_status,
        assembly_issues=assembly_issues,
        meaning_eligible=assembly_status == "complete",
        verification_eligible=assembly_status == "complete",
        review_status=review_status,
    )


def _build_review_unit(unit_index: int, section_id: str, nodes: list[StructureNode], issue: str) -> RuleUnit:
    fragments = [node for node in nodes if "fragment:incomplete" in node.tags]
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
        source_node_ids=[node.node_id for node in nodes],
        fragment_node_ids=[node.node_id for node in fragments],
        source_text_combined=_combined_text(nodes),
        assembly_status="needs_review",
        assembly_issues=[issue],
        meaning_eligible=False,
        verification_eligible=False,
        review_status="needs_review",
    )


def process_rule_units(structure: StructureResult, selection: SelectionResult) -> RuleUnitResult:
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
            rule_units.append(_build_review_unit(unit_index, section_id, selected_section_nodes + fragments, "missing_primary_rule"))
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

            unit = _build_rule_unit(unit_index, section_id, primary, children, fragments)
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
