# Codex Build Anchor

This file is the alignment checkpoint for future Codex and agent-assisted build work.

Codex must read this file before proposing features, code structures, workflows, abstractions, UI changes, or architectural direction.

## Operating context

Agents are operating against the live GitHub repository through GitHub plugin/tools unless the user explicitly provides another verified source.

The live GitHub repository is the source of truth.

Do not assume local filesystem access.
Do not assume a local clone.
Do not invent files, directories, build outputs, test results, runtime states, or dependency states that have not been verified from the live repository or an explicit tool result.

If a file cannot be verified from the repository, treat it as unknown or missing.

Do not infer implementation details from absent, empty, malformed, or corrupted files.

## Current product frame

Tetherpoint is a domain-neutral interpretation-state and traceability system for sensitive-domain information workflows.

Tetherpoint is not a legislation app.

Legislation is one possible domain adapter. It is historical context and a valid implementation path, but it is not the product identity.

Core rule:

```text
Report the state of the graph, not the illusion of certainty.
```

The valuable output is not a fluent answer. The valuable output is an inspectable interpretation state that shows what the system used, found, could not verify, and must hand off.

Tetherpoint should show:

- what source objects were used
- what source text or structure was anchored
- what the interpretation depends on
- what dependency remains unresolved
- what evidence is present
- what evidence is missing
- what is directly sourced
- what would require inference
- what is conflicted or temporally ambiguous
- what is blocked until another source is checked
- what needs active human/domain review

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
- a confidence-scoring interface
- a generic AI transparency page

Legislation, medicine, insurance, contracts, policy, finance, scientific records, civic records, and internal organizational records are possible domain adapters. They are not the product identity.

## Architecture spine

Tetherpoint models source-dependent interpretation as a dependency graph.

```text
Source objects are nodes.
Dependency links are edges.
Anchors connect outputs to sources.
Resolution states describe what is complete, missing, partial, conflicted, degraded, or blocked.
Review handoffs preserve the human/domain boundary.
```

The system reports the state of this graph. It does not resolve meaning beyond what the graph directly supports.

## Domain-neutral governance core

The governance core must remain stable across adapters.

Core owns:

- source object model
- dependency taxonomy
- anchor taxonomy
- missing-information states
- review handoff patterns
- inference-vs-direct distinction
- absence-as-evidence rule
- conflict-to-handoff rule
- temporal ambiguity visibility
- inspection and traceability guarantees

## Source object model

Source objects may be classified as:

- authoritative
- derivative
- reference
- temporal
- contextual

Adapters may provide domain-specific naming and retrieval logic, but they must not rewrite this source-object behavior.

## Dependency taxonomy

Dependency relationships include:

- inclusion
- exclusion
- sequence
- version
- threshold
- reference-resolution

Dependencies must remain visible when unresolved.

## Anchor taxonomy

Anchors include:

- direct text anchors
- structural anchors
- inference anchors
- absence anchors
- conflict anchors

Inference anchors must never be converted into direct anchors.

Absence is an evidence state. It is not permission to invent.

Conflict produces handoff. The system must not silently resolve source conflict.

## Source Metadata Contract

The RAG edge should resolve source material into a standardized Source Metadata Contract.

This is the architectural translation of the Hugging Face dataset-card pattern: not a visual card, but a metadata standardization checkpoint.

The UI may display this as a source card, but the architecture object is the contract.

The Source Metadata Contract should expose:

- what source was used
- what was found
- what could not be verified
- what version or time window applies
- what dependencies remain open
- what anchors are available
- what anchors are missing
- what anchors conflict
- what adapter retrieved or classified the source
- what review or handoff state applies

Do not reduce this to generic AI transparency language.

Do not treat Hugging Face cards as UI inspiration. Treat them as a reference point for metadata standardization.

## Human review handoff

Human review is an active escalation state, not a passive annotation.

It must be carried through the response contract and displayed as an explicit alert or escalation state.

It must not be reduced to:

- faint helper text
- background notes
- vague warnings
- confidence disclaimers
- hidden logs
- soft suggestions buried inside narrative output

Human-review handoff states include:

- threshold not met
- conflict requiring judgment
- inference chain too long
- version or temporal ambiguity
- contextual fact requiring human input
- scope exceeded

Reference: `docs/HUMAN_REVIEW_HANDOFF.md`.

## Target domain-neutral primitives

- Source Object
- Source Metadata Contract
- Trace Unit
- Dependency Link
- Anchor
- Resolution State
- Meaning Boundary
- Human Review Handoff
- Domain Adapter
- Interpretation Graph State

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

The first safe implementation target is contract and interface clarity, not deep backend restructuring.

Use existing backend data first to expose clearer user-facing inspection states:

- Source Metadata Contract display
- Reference Dependency display
- Meaning Boundary display
- Human Review Handoff alert

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
Source Metadata → Dependency → Meaning Boundary → Human Review Handoff
```

The interface should reduce cognitive load while preserving inspection visibility.

Avoid backend-console presentation, crawler language, dense telemetry, and raw pipeline clutter unless the user explicitly opens technical detail.

Human review must appear as an alert/escalation state near the affected output.

## Domain adapter boundary

Domain adapters own:

- source naming conventions
- retrieval endpoints and authentication
- source-library coverage
- version resolution logic
- threshold definitions
- contextual fact schemas
- reviewer roles
- conflict authority rules
- domain-specific output formats

Tetherpoint core owns:

- source visibility
- dependency links
- anchor typing
- resolution states
- meaning boundaries
- review handoff structure
- source metadata contract shape
- interface consistency
- inspection visibility

Adapters must not rewrite governance behavior.

## API and contract alignment

`backend/openapi.yaml` is a hard contract checkpoint.

Any backend schema, response shape, handoff object, source metadata object, or pipeline output change must be checked against `backend/openapi.yaml` in the same pass.

No backend/API change is complete unless these remain aligned:

- backend models
- backend handlers
- `backend/openapi.yaml`
- frontend API client/types
- frontend rendering assumptions
- tests
- relevant docs

If OpenAPI cannot be updated or verified in the same pass, the change is incomplete and must be treated as pending.

## Build discipline

Before any architecture surgery:

1. Check this file.
2. Check `ARCHITECTURE.md`.
3. Check `docs/HUMAN_REVIEW_HANDOFF.md`.
4. Check `backend/openapi.yaml`.
5. Check affected frontend/backend types.
6. Update docs and contracts in the same pass as schema changes.

No isolated schema changes.
No silent field drift.
No domain-specific overfitting.
No unsupported inference.
No collapsing unresolved states into answers.
No masking temporal ambiguity.
No converting inference anchors into direct anchors.
