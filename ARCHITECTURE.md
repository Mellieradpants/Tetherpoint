# Architecture

Tetherpoint is a domain-neutral interpretation-state and traceability system for sensitive-domain information workflows.

It is designed for contexts where the valuable output is not a fluent answer. The valuable output is an inspectable interpretation state that shows what the system used, found, could not verify, and must hand off.

Tetherpoint is not a legislation app. Legislation is one possible domain adapter and historical implementation path, not the product identity.

Core rule:

```text
Report the state of the graph, not the illusion of certainty.
```

## Current executable pipeline

The current backend executes a locked 10-layer pipeline:

1. Input
   Raw text or structured content enters the system. Supported content types are text, HTML, XML, and JSON. This layer validates well-formedness and preserves the original input.

2. Structure
   Deterministic parsing creates source-anchored nodes. This layer performs normalization, statement extraction, hierarchy assignment, explicit field extraction, constraint flags, and validation. It does not use AI.

3. Origin
   Source and provenance signals are extracted from the document where available. This includes metadata, canonical links, JSON-LD, Open Graph tags, Twitter card tags, explicit source fields, and referenced-source signals. Origin does not judge credibility.

4. Selection
   Nodes are selected or excluded using deterministic eligibility rules. Selection passes eligible nodes forward unchanged.

5. Rule Units
   Selected structure nodes are assembled into coherent interpretation units while preserving supporting source-node references. Rule Units also carry reference dependency packets when source text points outside itself.

6. Governance Gate
   The Governance Gate runs before Meaning. It exposes reference boundaries, source-dependency limits, non-blending constraints, and practical review questions. It does not decide truth, write meaning, or resolve references.

7. Verification
   Rule Units are routed to likely record systems. This layer identifies broad assertion types and returns candidate systems such as Congress.gov, Federal Register, CourtListener, PubMed, SEC EDGAR, FERC, NERC, EIA, JSTOR, and National Archives. Verification does not decide whether a claim is true.

8. Meaning
   Meaning produces document-level plain-language explanation from a bounded Rule Unit brief. The default path is deterministic. Any future AI-enabled Meaning path must stay bounded to the structured record and must not create anchors, change node roles, alter Rule Units, assign verification routes, cross unresolved reference boundaries, or change governance status.

9. Governance
   Governance checks anchored records for required source support, internal consistency, and downstream action safety. It does not decide truth, resolve conflicts, repair values, or overwrite values.

10. Output
   Final response assembly. Output presents upstream layer results and should not create new meaning.

## Target domain-neutral core model

The long-term architecture should not overfit to legislation, medicine, insurance, policy, finance, contracts, or any single specialty.

Tetherpoint models source-dependent interpretation as a dependency graph:

```text
Source objects are nodes.
Dependency links are edges.
Anchors connect outputs to sources.
Resolution states describe what is complete, missing, partial, conflicted, degraded, or blocked.
Review handoffs preserve the human/domain boundary.
```

The system reports the state of this graph. It does not resolve meaning past what the graph directly supports.

The resulting Interpretation Graph State is the product output: an inspectable state of source objects, anchors, dependencies, resolution states, meaning boundaries, and active human-review handoffs.

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

Adapters may provide domain-specific thresholds, source systems, naming, retrieval logic, schemas, reviewer roles, and output formats. Adapters must not rewrite the core governance behavior.

## Core primitives

### Source Object

A Source Object is any source-bearing item that may support, constrain, or contextualize meaning.

Domain-neutral source object roles:

- authoritative_record - the primary source that speaks first
- derivative_record - a document or output whose meaning depends on another source
- reference_record - an external source pointed to by local text
- temporal_record - a version, amendment, update, supersession, or time-bound source
- contextual_record - situational facts that determine which sources or rules apply
- unknown - source role cannot be determined safely

Domain adapters may rename these for local use, but the core roles should remain stable.

### Source Metadata Contract

The RAG edge should resolve source material into a standardized Source Metadata Contract.

This is a metadata standardization checkpoint, not merely a visual source card. The UI may display the contract as a source card, but the architecture object is the contract.

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

### Trace Unit

A Trace Unit is the smallest source-backed unit being inspected for meaning.

The current implementation uses `RuleUnit` for this role. That name is retained for compatibility, but the domain-neutral architecture target is `TraceUnit`.

A Trace Unit may represent a clause, paragraph, chart note, lab value, policy section, claim sentence, contract provision, scientific claim, internal procedure step, or any other source-backed interpretive unit.

### Dependency Link

A Dependency Link records where a Trace Unit or Source Object depends on another source, condition, version, threshold, or review path.

Domain-neutral dependency types:

- inclusion_dependency - another source must be included before meaning is complete
- exclusion_dependency - another source may block, limit, or defeat the meaning
- sequence_dependency - one source must resolve before another can be interpreted
- version_dependency - meaning is valid only for the correct version or time window
- threshold_dependency - minimum evidence/support requirements are not yet met
- reference_resolution_dependency - local text points to another source that has not been resolved

Dependencies must remain visible when unresolved.

### Anchor

An Anchor is the traceable link between an output and source support.

Domain-neutral anchor types:

- direct_text_anchor - exact source text supports the output
- structural_anchor - document structure, hierarchy, metadata, or location supports the output
- inference_anchor - output follows from applying a sourced rule to a sourced fact; this is higher risk and must be flagged separately
- absence_anchor - the system searched a defined scope and did not find the expected source or passage
- conflict_anchor - two or more valid anchors conflict and require review

Inference anchors must never be converted into direct anchors.

Absence is a valid evidence state when the search scope is explicit. It is not permission to invent.

Conflict produces handoff. The system must not silently resolve source conflict.

### Resolution State

Resolution State describes the current state of a source dependency or anchor.

Domain-neutral states:

- not_attempted
- found
- partial
- multiple_candidates
- not_found
- manual_required
- failed
- passage_not_found
- version_unresolved
- reference_chain_open
- contextual_fact_missing
- conflict_unresolved
- threshold_not_met
- scope_exceeded

Simple UI labels may compress these into user-facing states such as Anchored, Dangling, Obstructed, Contested, and Review Required. The backend should preserve the more precise state.

### Meaning Boundary

A Meaning Boundary defines what can and cannot be said from the currently anchored source graph.

It should separate:

- allowed meaning - what the current anchors support
- blocked meaning - what cannot be claimed until dependencies resolve
- boundary reason - why the limit exists
- missing sources or facts - what the graph still needs
- review requirement - what human or domain review remains

### Human Review Handoff

A Human Review Handoff is an active escalation state, not a passive annotation and not a generic error.

Human-review handoff types include:

- threshold_not_met - minimum evidence set is incomplete
- conflict_requiring_judgment - valid sources conflict and require domain judgment
- inference_chain_too_long - the system would need too many chained inferences
- version_or_temporal_ambiguity - correct version or time window cannot be determined
- contextual_fact_required - a situational fact is needed but missing
- scope_exceeded - the request reaches outside the authorized interpretation set

The handoff should state the exact unresolved question or next source needed. It must be carried through the response contract and displayed as an explicit alert or escalation state near the affected output.

See `docs/HUMAN_REVIEW_HANDOFF.md` for the handoff object and UI behavior.

### Domain Adapter

A Domain Adapter maps specialty libraries, source systems, and review rules into the stable Tetherpoint primitives.

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

## Core interface mechanism

Tetherpoint separates structure, provenance, Trace Unit assembly, reference dependency, governance-gate limits, verification routing, meaning, and governance so each output can be traced back to explicit source support.

The interface should show:

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
- what needs active human or domain review

The stable user-facing rhythm is:

```text
Source Metadata -> Dependency -> Meaning Boundary -> Human Review Handoff
```

## Retrieval relationship

Tetherpoint is not a full retrieval backend and does not need to own every domain library.

Domain-specific retrieval systems can plug into the traceability contract. When a referred source is retrieved, Tetherpoint can show the source text and anchors. When the source is not retrieved or is incomplete, Tetherpoint should preserve that boundary and prevent fluent meaning from appearing complete.

Retrieval answers:

```text
Can the referred source be found?
```

Tetherpoint answers:

```text
What is the source state, and what must remain unresolved or handed off before anyone relies on the interpretation?
```

## Current-to-target mapping

The current implementation should be treated as a working prototype that maps toward the domain-neutral target model:

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

This mapping should guide refactoring. Do not break working code only to rename concepts. Rename or wrap concepts when the architecture requires it.

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

## Non-goals

Tetherpoint is not a legislation-only tool, Washington State civic dashboard, fact checker, legal advice tool, medical advice tool, credibility score, confidence-scoring interface, political recommendation system, truth-resolution system, full retrieval backend, complete domain library, RAG research project, general AI transparency page, or general chatbot.
