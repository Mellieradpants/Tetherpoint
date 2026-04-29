# Tetherpoint

Tetherpoint is a source-anchored parsing and traceability system.

It takes source content, breaks it into traceable nodes, assembles coherent Rule Units, applies deterministic structure and selection rules, routes assertions to likely record systems, produces document-level plain meaning from a bounded Meaning brief, and runs a deterministic governance check before final output assembly.

The project is not a truth engine and does not decide whether claims are true or false.

## Current status

This repository contains a working full-stack prototype:

- React/Vite frontend
- Vercel serverless proxy at `/api/analyze`
- FastAPI backend under `backend/`
- Deterministic structure, origin, selection, rule-unit, verification-routing, and governance layers
- Document-level plain Meaning from a deterministic Rule Unit brief
- OpenAPI contract under `backend/openapi.yaml`
- Backend tests under `backend/app/tests/`

## Executable pipeline order

The current backend executes layers in this order:

1. Input
2. Structure
3. Origin
4. Selection
5. Rule Units
6. Verification
7. Meaning
8. Governance
9. Output

This order matters. Atomic Structure nodes are traceability units. Rule Units are the coherent interpretation units used by Verification and Meaning. Governance evaluates source support and action-safety constraints after structured records exist and before final output assembly.

## Layer responsibilities

| Layer | Purpose | AI |
|---|---|---|
| Input | Intake and well-formedness validation | No |
| Structure | Deterministic parsing, normalization, hierarchy, source anchors | No |
| Origin | Provenance, document identity, and source-signal extraction | No |
| Selection | Deterministic node eligibility | No |
| Rule Units | Assemble selected structure nodes into coherent interpretation units | No |
| Verification | Route rule units to likely record systems | No |
| Meaning | Plain-language document explanation from a bounded Rule Unit brief | No by default; future optional AI must stay document-level and bounded |
| Governance | Check anchored records for required support, internal consistency, and downstream action safety | No |
| Output | Assemble upstream layer results | No |

## Governance layer

Governance is a deterministic constraint layer. It does not decide what is true. It determines whether a record is sufficiently supported and safe to act on.

Current governance behavior:

- checks required support fields
- flags missing source support
- detects same-field contradictions when comparison records are supplied
- blocks unsupported downstream action when requested action lacks required support
- emits `match` or `needs_review` without resolving conflicts

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

Governance is not UI, upload, export, translation, or truth adjudication.

## Hard constraints

- No source span, no output.
- No anchor, no meaning.
- Atomic Structure nodes are traceability units, not public Meaning targets.
- Rule Units are interpretation units.
- Meaning must not use scope or shift-label taxonomy in the default Tetherpoint path.
- Verification routing does not decide truth.
- Origin tracing does not judge credibility.
- Governance does not decide truth, repair values, overwrite values, or resolve conflicts.
- Output presents upstream results and should not create new meaning.
- Fail rather than guess.
- Missing information must stay explicit.

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

## What this project is

Tetherpoint is best described as a source-anchored parsing pipeline, verification-routing prototype, and deterministic governance gate for extracted records.

It is designed to make dense source text inspectable by separating structure, provenance, rule-unit assembly, verification routing, plain-language meaning, and governance checks.

## What this project is not

Tetherpoint is not:

- a fact checker
- a legal advice tool
- a credibility score
- a general summarizer
- a political recommendation system
- a general chatbot
- a comparison-taxonomy tool
- a truth-resolution system

## Reviewer note

The main technical claim of this repository is constraint separation: each layer has a narrow responsibility, and downstream outputs should remain traceable to explicit upstream source nodes. Governance adds a final deterministic safety gate before output assembly without turning the system into a truth engine.
