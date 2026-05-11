# SourceContext Architecture Alignment

This document records the architecture alignment for SourceContext, DocumentMap, and the document-first v2 runtime path. It is intentionally focused on source and document state. It does not add binary PDF parsing, OCR, upload UI, frontend behavior, or new Meaning behavior.

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

SourceContext should be internal-first. Existing public response fields should remain stable unless a scoped API contract change updates backend models, OpenAPI, tests, and docs in the same pass. The existing `source_metadata` field should remain as a compatibility projection generated from internal source state until the contract is mature enough to expose directly.

PDF and broader document parsing must be treated as adapter work, not the architecture itself. A parser may create source text and document locations. It must not create meaning, verification, governance, or final output.

## Proposed SourceContext Sections

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
| Semantic Structure | Owns explicit meaning-signals inside pieces while preserving source text and anchors. |
| Selection | Owns eligibility. It must not rewrite source text. |
| Rule Units | Own grouping and must preserve node IDs and anchors. |
| Governance | Owns pass, block, review, and limit states. |
| Meaning | Explains only governed outputs and must not create anchors. |

Anti-drift rule: a later layer may add a derived card or field only when it records traceability back to the earlier source object. Later layers must not silently rewrite earlier source snapshots, anchors, document pieces, node IDs, or source text.

## Current Document-First v2 Runtime Path

The document-first v2 chain now exists as an optional backend `/analyze` path for structured `document_packet` input.

This path is tested. The backend suite has passed with:

```text
cd backend && python -m pytest app/tests/ -v
124 passed
```

Current chain:

1. structured document packet input becomes `CanonicalDocumentPacket`
2. `CanonicalDocumentPacket` becomes `DocumentStructureResult`
3. `DocumentStructureResult` becomes `SemanticStructureResult`
4. `SemanticStructureResult` becomes `SelectionV2Result`
5. `SelectionV2Result` and Structure become `RuleUnitV2CandidateResult`

The response keeps this path separate under `document_first_v2`.

This path preserves source text, anchors, page and block structure, semantic signals, selected signals, and rule-unit candidates as separate layer outputs.

This path does not parse binary PDFs, perform OCR, expose PDF upload UI, run existing Meaning, run existing Verification, run Governance, modify existing Rule Units, or merge v2 candidates into the existing text-first runtime pipeline.

The existing text, XML, HTML, and JSON `/analyze` path remains the primary runtime pipeline. For those inputs, `document_first_v2.status` is `skipped`.

## Current Runtime Boundary

There are currently two backend paths by design:

- the existing text-first path for `text`, `xml`, `html`, and `json`
- the document-first v2 path for structured `document_packet` input

This is a controlled migration boundary, not a permanent product goal. The document-first path exists separately so page/block source structure is not forced into older semantic roles too early.

The next implementation decision is how to converge around a shared core without collapsing layer ownership. Do not merge these paths by mapping document blocks into old semantic roles such as `PRIMARY_RULE`, `CONDITION`, `EXCEPTION`, `EVIDENCE`, `DEFINITION`, or `CONSEQUENCE`.

## Architecture Rules

- SourceContext does not create meaning.
- Document extraction creates usable source text, not interpretation.
- Earlier source snapshots and cards should not be silently rewritten by later layers.
- Later layers may create derived cards or fields only with traceability.
- Meaning remains bounded to selected, source-backed rule units.
- Verification remains routing-only.
- Governance Gate decides what Meaning may safely use.
- Final Governance checks support and safety.
- PDF parser is an adapter, not the architecture.
- Document-first v2 is a source-backed runtime diagnostic path, not final Meaning output.

## Migration Notes

The current `document_first_v2` path proves the source-backed document chain without replacing the existing runtime pipeline.

Future integration should move toward one shared core with input-specific adapters. The safe convergence target is:

- intake adapter creates source/document state
- Structure owns document pieces and anchors
- Semantic Structure owns explicit signals
- Selection owns eligibility
- Rule Units own grouping
- Governance and Verification preserve limits and routes
- Meaning explains only bounded, governed outputs

Do not add PDF upload, OCR, frontend display, final Meaning, Verification, or Governance behavior to the document-first path until the contract for that next boundary is explicit and tested.
