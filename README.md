# Tetherpoint

Tetherpoint is an interface-level traceability layer for source-dependent AI meaning.

Its core design rule is simple:

```text
Traceability before fluency.
```

In low-risk contexts, the valuable AI behavior may be speed, creativity, or exploration. In civic, legal, medical, insurance, policy, benefits, contract, and other high-consequence contexts, the valuable output is not just an answer. The valuable output is an answer a person can inspect before relying on it.

Tetherpoint is designed to show:

- what source text the system used
- what the answer depends on
- what references point outside the local text
- whether referred sources were found, missing, partial, or not attempted
- what meaning is allowed from anchored source text
- what meaning is blocked until missing sources are anchored
- what still needs human or domain review

Tetherpoint is not a truth engine and does not decide whether claims are true or false.

## Current status

This repository contains a working full-stack prototype:

- React/Vite frontend
- Vercel serverless proxy at `/api/analyze`
- FastAPI backend under `backend/`
- Deterministic input, structure, origin, selection, rule-unit, governance-gate, verification-routing, meaning, governance, and output layers
- Rule Units as the smallest source-backed interpretation units
- Reference dependency packets for source material that points outside itself
- Document-level plain Meaning from a bounded Rule Unit brief
- OpenAPI contract under `backend/openapi.yaml`
- Backend tests under `backend/app/tests/`

## What this project is

Tetherpoint is best described as a source-anchored interface and pipeline for inspecting AI-assisted meaning.

It separates source structure, origin signals, rule-unit assembly, reference dependency, verification routing, plain-language meaning, and governance checks so a user can see what the output is standing on.

The project is intended to sit above different source systems and domain libraries. Legislation, policy, medicine, insurance, contracts, benefits, scientific records, and internal documents are possible domains. They are not the identity of the tool.

## What this project is not

Tetherpoint is not:

- a fact checker
- a legal advice tool
- a medical advice tool
- a credibility score
- a general summarizer
- a political recommendation system
- a general chatbot
- a full retrieval backend
- a complete domain library
- a truth-resolution system

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
→ source structure
→ selected traceable nodes
→ rule units
→ referred-source detection
→ governance gate
→ verification routes
→ bounded meaning
→ governance result
→ inspectable output
```

The important interface behavior is:

```text
source first
anchor visible
meaning second
missing dependencies shown
human review preserved
```

When text points outside itself, Tetherpoint should not treat meaning as complete. It should show the referred source, retrieval state, local meaning boundary, blocked meaning, and next review path.

## Reference dependency

Reference dependency is core to the project.

A document, rule, claim, policy, contract, record, or medical note may depend on another source: a definition, statute, exhibit, guideline, dataset, agency record, court opinion, policy manual, plan document, standard, or other authority.

Tetherpoint’s job is not to own every domain retrieval system. Its job is to define the interface contract around those dependencies.

When a domain library or retrieval system is connected, it can supply the referred source and anchors. When the library is missing, incomplete, or not connected, Tetherpoint should still protect the user by making the stop point visible:

- referred source detected
- retrieval status shown
- local meaning limited
- unresolved meaning blocked
- human review path shown

This lets a user see how far the trace got and what specific footwork remains.

## Rule Units

Rule Units are the smallest source-backed units eligible for interpretation.

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

Tetherpoint’s product claim is not that it knows the truth. The claim is that high-consequence AI meaning should be inspectable before a person relies on it.
