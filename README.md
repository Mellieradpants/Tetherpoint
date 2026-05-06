# Tetherpoint

Tetherpoint is a domain-neutral interpretation-state and traceability system for sensitive-domain information workflows.

Tetherpoint is not a legislation app. Legislation is one possible domain adapter and historical implementation path, not the product identity.

Its core design rule is:

```text
Report the state of the graph, not the illusion of certainty.
```

In high-consequence contexts such as civic records, legal records, medical records, insurance, policy, benefits, contracts, finance, scientific records, and internal organizational records, the valuable output is not just an answer. The valuable output is an inspectable interpretation state that shows what the system used, found, could not verify, and must hand off.

Tetherpoint is designed to show:

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

Tetherpoint is not a truth engine and does not decide whether claims are true or false.

## Current status

This repository contains a working full-stack prototype:

- React/Vite frontend
- Vercel serverless proxy at `/api/analyze`
- FastAPI backend under `backend/`
- Deterministic input, structure, origin, selection, rule-unit, governance-gate, verification-routing, meaning, governance, and output layers
- Rule Units as the current implementation name for Trace Units
- Reference dependency packets for source material that points outside itself
- Document-level plain Meaning from a bounded Rule Unit brief
- OpenAPI contract under `backend/openapi.yaml`
- Backend tests under `backend/app/tests/`

## What this project is

Tetherpoint is best described as a source-anchored interface and pipeline for reporting Interpretation Graph State.

It separates source structure, origin signals, rule-unit assembly, reference dependency, verification routing, bounded meaning, governance checks, and output assembly so a user can inspect what the interpretation is standing on.

The project is intended to sit above different source systems and domain libraries. Legislation, policy, medicine, insurance, contracts, benefits, scientific records, civic records, finance, and internal documents are possible domains. They are adapters and examples, not the identity of the tool.

## What this project is not

Tetherpoint is not:

- a legislation-only tool
- a Washington State civic dashboard
- a fact checker
- a legal advice tool
- a medical advice tool
- a credibility score
- a confidence-scoring interface
- a general summarizer
- a political recommendation system
- a general chatbot
- a full retrieval backend
- a complete domain library
- a truth-resolution system
- a RAG research project
- a generic AI transparency page

## Interpretation Graph State

Tetherpoint models source-dependent interpretation as a dependency graph:

```text
Source objects are nodes.
Dependency links are edges.
Anchors connect outputs to sources.
Resolution states describe what is complete, missing, partial, conflicted, degraded, or blocked.
Human Review Handoffs preserve the human/domain boundary.
```

The system reports the state of this graph. It does not resolve meaning beyond what the graph directly supports.

## Executable pipeline order

The current backend executes layers in this order:

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

This order matters.

Atomic Structure nodes are traceability units. Rule Units are coherent interpretation units. The Governance Gate runs before Meaning to expose reference boundaries, non-blending constraints, and source-dependency limits. Verification routes Rule Units to likely record systems. Meaning is bounded by the source-backed Rule Unit brief. Final Governance checks anchored records before output assembly.

## Core mechanism

Tetherpoint is built around this sequence:

```text
input text
-> source structure
-> selected traceable nodes
-> rule units
-> referred-source detection
-> governance gate
-> verification routes
-> bounded meaning
-> governance result
-> inspectable output
```

The important interface behavior is:

```text
Source Metadata -> Dependency -> Meaning Boundary -> Human Review Handoff
```

When text points outside itself, Tetherpoint should not treat meaning as complete. It should show the referred source, retrieval state, local meaning boundary, blocked meaning, and active review or handoff path.

## Source Metadata Contract

The RAG edge should resolve source material into a standardized Source Metadata Contract.

This is not merely a visual source card. The UI may display the contract as a source card, but the architecture object is the contract.

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

## Reference dependency

Reference dependency is core to the project.

A document, rule, claim, policy, contract, record, or medical note may depend on another source: a definition, statute, exhibit, guideline, dataset, agency record, court opinion, policy manual, plan document, standard, or other authority.

Tetherpoint's job is not to own every domain retrieval system. Its job is to define the interface contract around those dependencies.

When a domain library or retrieval system is connected, it can supply the referred source and anchors. When the library is missing, incomplete, or not connected, Tetherpoint should still protect the user by making the stop point visible:

- referred source detected
- retrieval status shown
- local meaning limited
- unresolved meaning blocked
- human review path shown

This lets a user see how far the trace got and what specific source work remains.

## Human Review Handoff

Human review is an active escalation state, not a passive annotation.

It must be carried through the response contract and displayed as an explicit alert or escalation state. It must not be reduced to helper text, vague warnings, confidence disclaimers, hidden logs, or soft suggestions buried inside narrative output.

Human-review handoff states include:

- threshold not met
- conflict requiring judgment
- inference chain too long
- version or temporal ambiguity
- contextual fact requiring human input
- scope exceeded

See `docs/HUMAN_REVIEW_HANDOFF.md` for the structured handoff object and UI behavior.

## Rule Units

Rule Units are the current implementation name for Trace Units, the smallest source-backed units eligible for interpretation.

Atomic Structure nodes remain the trace layer. Rule Units assemble selected nodes into coherent interpretation units while preserving source-node IDs, source text, conditions, exceptions, evidence requirements, consequences, definitions, timing, jurisdiction, mechanisms, and reference dependencies.

Meaning and Verification operate on Rule Units, not loose text fragments.

## Governance Gate

The Governance Gate is a pre-Meaning constraint layer.

It does not decide truth. It does not write meaning. It does not resolve references. It identifies operational scope, reference boundaries, non-blending rules, practical questions, and limits before Meaning runs.

The Governance Gate protects the interface from presenting fluent meaning as complete when source dependencies are unresolved.

## Governance layer

The later Governance layer is a deterministic support and action-safety check.

It does not decide what is true. It determines whether a record is sufficiently supported and safe to act on under the current checks.

Current governance behavior:

- checks required support fields
- flags missing source support
- detects same-field contradictions when comparison records are supplied
- blocks unsupported downstream action when requested action lacks required support
- emits review status without resolving conflicts

Current response fields include:

```text
governance.status
governance.record_count
governance.issue_count
governance.results
governance.activeIssues
output.governance_status
output.governance_issue_count
```

Governance is not UI, upload, export, translation, retrieval, or truth adjudication.

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

## Deterministic control boundary

Tetherpoint does not permit AI to create or modify the structural record.

Before Meaning can produce a plain-language explanation, the pipeline has already produced:

- source anchors
- section and node boundaries
- node roles
- selection eligibility
- Rule Units
- reference dependency packets
- source-node references
- governance-gate limits
- verification routes
- governance status

Those fields are created by deterministic code, not by a model response.

AI, if enabled in a future bounded Meaning path, may only explain from the structured record it receives. It must not create anchors, change node roles, alter Rule Units, assign verification routes, change governance status, or decide whether a record is safe to pass forward.

Security implication: prompt text can be analyzed, but it does not control the schema, anchors, eligibility rules, verification routing, governance-gate limits, or governance outcome.

## Layer responsibilities

| Layer | Purpose | AI |
|---|---|---|
| Input | Intake and well-formedness validation | No |
| Structure | Deterministic parsing, normalization, hierarchy, and source anchors | No |
| Origin | Provenance, document identity, source-signal extraction, and referenced-source detection | No |
| Selection | Deterministic node eligibility | No |
| Rule Units | Assemble selected structure nodes into coherent interpretation units and reference dependency packets | No |
| Governance Gate | Pre-Meaning scope, reference-boundary, non-blending, and limit checks | No |
| Verification | Route rule units to likely record systems | No |
| Meaning | Plain-language document explanation from a bounded Rule Unit brief | No by default; future optional AI must stay bounded |
| Governance | Check anchored records for required support, internal consistency, and downstream action safety | No |
| Output | Assemble upstream layer results | No |

## Hard constraints

- No source span, no output.
- No anchor, no meaning.
- Source structure must exist before interpretation.
- Rule Units are interpretation units.
- Atomic Structure nodes are traceability units, not public Meaning targets.
- Reference dependencies must remain visible.
- Missing referred sources must not be silently filled.
- Meaning must not cross a reference boundary as if the referred source were anchored.
- AI does not define or modify record structure, source anchors, node roles, Rule Units, verification routes, governance-gate limits, or governance outcomes.
- Verification routing does not decide truth.
- Origin tracing does not judge credibility.
- Governance does not decide truth, repair values, overwrite values, or resolve conflicts.
- Output presents upstream results and should not create new meaning.
- Fail rather than guess.
- Missing information must stay explicit.

## Retrieval and domain libraries

Tetherpoint does not need to own every retrieval system.

Domain libraries and retrieval adapters can plug into the interface contract. Examples include legislative records, medical guidelines, insurance plan documents, court records, scientific registries, financial filings, policy manuals, and internal document stores.

When retrieval is available, Tetherpoint can display retrieved source text and anchors. When retrieval is unavailable or incomplete, Tetherpoint should show the dependency and limit meaning instead of smoothing over the gap.

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

## Frontend/backend shape

The browser calls the local Vercel function:

```text
POST /api/analyze
```

The Vercel function forwards the request to the backend:

```text
POST https://anchored-flow-stack.onrender.com/analyze
```

The backend requires `x-analyze-secret` for authorized server-to-server requests. The browser should not hold this secret.

## Backend docs

See `backend/README.md` for local setup, test commands, API behavior, and implementation details.

See `backend/openapi.yaml` for the current API contract.

## Reviewer note

The main technical claim of this repository is constraint separation at the interface level: each layer has a narrow responsibility, and downstream outputs remain traceable to explicit upstream source nodes and Rule Units.

Tetherpoint's product claim is not that it knows the truth. The claim is that high-consequence source-dependent interpretation should remain inspectable, bounded, and handoff-aware before a person relies on it.
