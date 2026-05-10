# SourceContext Architecture Alignment

This document records the architecture alignment for a future SourceContext / DocumentMap contract. It is intentionally documentation-only. It does not add SourceContext implementation, change pipeline order, add PDF parsing, add OCR, add external libraries, or change public API response fields.

## Direction

SourceContext / DocumentMap should be a shared traveling contract, not a normal pipeline stage. It should start at Intake and carry source and document state through the pipeline while each layer writes only its allowed section.

Origin should become a report or view generated from SourceContext. Origin should not be the only place where source intelligence lives, because source and document context is needed before Origin and across later layers.

The current source-card logic already exists in fragments:

- `InputResult`
- `StructureNode`
- `OriginSignal`
- `ReferencedSource`
- `RuleUnitReferencedSource`
- `SourceMetadataContract`
- `HumanReviewHandoff`

`SourceMetadataContract` is currently the closest object to a public source-card projection. However, it is built after the main pipeline and is not yet a shared spine that travels through the pipeline.

SourceContext should be internal-only first. Existing public response fields should remain stable. The existing `source_metadata` field should remain as a compatibility projection generated from the internal SourceContext until the contract is mature enough to expose directly.

PDF and broader document parsing should wait until SourceContext exists. The PDF parser should be treated as an adapter, not the architecture itself.

No pipeline reorder should happen yet. The Governance Gate / Verification order should remain unresolved until SourceContext integration clarifies what the gate needs to read.

## Proposed Sections

### `source_document`

Stores the source envelope and identity for the submitted material, including content type, size, supplied source name or URI when available, and stable document identifiers when introduced.

### `extraction_profile`

Stores parse and extraction state, including extractor or adapter identity, extraction mode, normalization steps, parse warnings, and extraction limits.

### `document_map`

Stores the stable map of usable source text: text units, anchors, spans, ordering, and future page/block/line/table-cell coordinates. This is the contract that lets later layers refer to document locations without re-parsing or inventing source structure.

### `source_snapshots`

Stores immutable source snapshots, including raw source text and normalized source text. Earlier snapshots should not be silently rewritten by later layers.

### `structure_links`

Maps Structure nodes to document-map text units, source anchors, spans, and normalized text segments.

### `provenance_signals`

Stores source identity, metadata, and distribution signals that Origin can present as a report or view.

### `external_references`

Stores referenced source cards, matched source text, official source paths when known, resolution state, dependencies, limits, and traceability to the text that triggered each reference.

### `rule_unit_links`

Maps rule units to structure nodes, source text units, fragment nodes, selected source spans, and scoped reference dependencies.

### `gate_constraints`

Stores Governance Gate lanes, source-dependency limits, non-blending rules, practical questions, and pre-Meaning constraints.

### `verification_routes`

Stores verification routing only: detected assertion category, available verification paths, expected record systems, and related source node or rule-unit links.

### `review_handoffs`

Stores human review packets generated from unresolved source dependencies, missing anchors, conflicts, source limits, or governance findings.

## Ownership Rules

| Layer | Writes |
| --- | --- |
| Intake | Initializes `source_document`, raw snapshot, and parse/extraction state. |
| Structure | Writes `document_map`, `structure_links`, normalized snapshot, and extraction warnings. |
| Origin | Writes `provenance_signals`, external reference cards, and the Origin report/view. |
| Selection | Writes selection result only. |
| Rule Units | Writes `rule_unit_links` and scoped reference dependency packets. |
| Governance Gate | Writes `gate_constraints` and limits. |
| Verification | Writes `verification_routes` only. |
| Meaning | Writes meaning result only and must not write SourceContext. |
| Final Governance | Writes support and safety findings. |
| Output | Presents projections only. |

## Layer Ownership / Anti-Drift Rule

Source capture and interpretation must stay separated as document intake grows.

| Layer | Boundary |
| --- | --- |
| PDF Intake | Owns source capture and adapter output. It may produce usable text and source locations, but it must not assign semantic labels. |
| Structure | Owns document pieces, anchors, spans, ordering, and structural node links. It must not write plain meaning. |
| Semantic Structure | Owns explicit meaning-signals inside pieces, such as actor/action/condition fields, while preserving source text and anchors. |
| Selection | Owns eligibility. It must not rewrite source text. |
| Rule Units | Own grouping and must preserve node IDs and anchors. |
| Governance | Owns pass, block, review, and limit states. |
| Meaning | Explains only governed outputs and must not create anchors. |

Anti-drift rule: a later layer may add a derived card or field only when it records traceability back to the earlier source object. Later layers must not silently rewrite earlier source snapshots, anchors, document pieces, node IDs, or source text.

## Verified Internal Chain

The document-first v2 chain now exists internally and is covered by backend tests. The backend suite has passed with `cd backend && python -m pytest app/tests/ -v` and `119 passed`.

Layer map:

1. PDF-derived extraction -> `CanonicalDocumentPacket`
2. `CanonicalDocumentPacket` -> `DocumentStructureResult`
3. `DocumentStructureResult` -> `SemanticStructureResult`
4. `SemanticStructureResult` -> `SelectionV2Result`
5. `SelectionV2Result` + Structure -> `RuleUnitV2CandidateResult`

This chain preserves source text, anchors, page and block structure, semantic signals, selected signals, and rule-unit candidates as separate layers.

It is intentionally not wired into `/analyze` yet. It does not parse binary PDFs, perform OCR, expose PDF upload UI, modify existing runtime pipeline behavior, or change Meaning, Verification, Governance, or existing Rule Units.

Next implementation boundary: decide how and when this internal chain becomes an optional runtime path without collapsing it into the existing text-first pipeline.

## Architecture Rules

- SourceContext does not create meaning.
- Document extraction creates usable source text, not interpretation.
- Earlier source snapshots and cards should not be silently rewritten by later layers.
- Later layers may create derived cards or fields with traceability.
- Meaning remains bounded to selected, source-backed rule units.
- Verification remains routing-only.
- Governance Gate decides what Meaning may safely use.
- Final Governance checks support and safety.
- PDF parser is an adapter, not the architecture.

## Migration Notes

The first implementation should add an internal SourceContext spine without changing public response fields. Existing `source_metadata` should continue to be emitted as a compatibility projection.

Origin can then be refactored into a report/view over SourceContext sections. That refactor should preserve current Origin output shape while moving source intelligence into the shared contract.

PDF and document adapters should come after the contract exists, so they can populate `source_document`, `extraction_profile`, `document_map`, and `source_snapshots` without changing downstream architecture.
