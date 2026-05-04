# Codex Build Anchor

This file is the alignment checkpoint for future Codex and agent-assisted build work.

## Current project frame

Tetherpoint is an interface-level traceability layer for source-dependent AI meaning.

Core rule:

```text
Traceability before fluency.
```

The valuable output is not just a fluent answer. The valuable output is an answer a person can inspect before relying on it.

Tetherpoint should show:

- what source text was used
- what the meaning depends on
- what source or reference is missing
- what can be said from the current anchored source
- what is blocked until another source is checked
- what still needs human or domain review

## Do not drift

Do not turn this project into:

- a legislation-only tool
- a Washington State civic dashboard
- a full retrieval backend
- a RAG research project
- a domain-specific expert system
- a legal advice tool
- a medical advice tool
- a truth engine
- a general chatbot
- a credibility score

Legislation, medicine, insurance, contracts, policy, finance, scientific records, civic records, and internal organizational records are possible domain adapters. They are not the product identity.

## Architecture spine

Tetherpoint models source-dependent interpretation as a dependency graph.

```text
Source objects are nodes.
Dependency links are edges.
Anchors connect outputs to sources.
Resolution states describe what is complete, missing, partial, conflicted, or blocked.
Review handoffs preserve the human/domain boundary.
```

The system reports the state of this graph. It does not resolve meaning beyond what the graph directly supports.

## Target domain-neutral primitives

- Source Object
- Trace Unit
- Dependency Link
- Anchor
- Resolution State
- Meaning Boundary
- Review Handoff
- Domain Adapter

## Current implementation mapping

| Current implementation | Target architecture role |
|---|---|
| `StructureNode` | Source anchor / structured source unit |
| `RuleUnit` | Trace Unit |
| `RuleUnitReferencedSource` | Dependency Link / referenced source packet |
| `GovernanceGateResult` | Pre-Meaning Boundary Gate / resolution limits |
| `VerificationResult` | Verification Route |
| `MeaningResult` | Bounded Meaning |
| `GovernanceResult` | Final support and action-safety check |
| `OutputResult` | Interface-ready assembly |

Do not break working code only to rename concepts. Rename or wrap concepts when the architecture requires it.

## Current pipeline

The current backend pipeline is:

1. Input
2. Structure
3. Origin
4. Selection
5. Rule Units
6. Governance Gate
7. Verification
8. Meaning
9. Governance
10. Output

Governance Gate must remain before Meaning. Meaning must stay bounded to source-backed records and unresolved reference boundaries.

## First implementation direction

The first safe implementation target is interface-facing, not deep backend restructuring.

Use existing backend data to expose clearer user-facing cards:

- Source Card
- Reference Dependency Card
- Meaning Boundary Card
- Review Handoff Card

Use existing fields first:

- `rule_units.rule_units[*].source_text_combined`
- `rule_units.rule_units[*].referenced_sources`
- `rule_units.rule_units[*].requires_reference_resolution`
- `governance_gate.limits`
- `governance_gate.practical_questions`
- `verification.node_results`
- `meaning.summary_missing_information`

Do not build domain libraries yet.

Do not build retrieval adapters yet.

Do not rename `RuleUnit` yet unless the change is planned across schema, backend, frontend, OpenAPI, tests, and docs in the same pass.

## Interface rule

The user-facing rhythm should be:

```text
Source → Dependency → Meaning Boundary → Review
```

The interface should reduce cognitive load. Avoid backend-console presentation, crawler language, dense telemetry, and raw pipeline clutter unless the user explicitly opens technical detail.

## Domain adapter boundary

Domain adapters own:

- source naming conventions
- retrieval endpoints and authentication
- source-library coverage
- version resolution logic
- threshold definitions
- contextual fact schemas
- reviewer roles
- domain-specific output formats

Tetherpoint core owns:

- source visibility
- dependency links
- anchor typing
- resolution states
- meaning boundaries
- review handoff structure
- interface consistency

## Build discipline

Before any architecture surgery:

1. Check this file.
2. Check `ARCHITECTURE.md`.
3. Check `backend/openapi.yaml`.
4. Check affected frontend/backend types.
5. Update docs and contracts in the same pass as schema changes.

No isolated schema changes.
No silent field drift.
No domain-specific overfitting.
