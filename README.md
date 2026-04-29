# Tetherpoint

Tetherpoint is a source-anchored parsing and traceability system.

It takes source content, breaks it into traceable nodes, applies deterministic structure and selection rules, routes factual assertions to likely record systems, and optionally runs a constrained AI Meaning layer on selected nodes.

The project is not a truth engine and does not decide whether claims are true or false.

## Current status

This repository contains a working full-stack prototype:

- React/Vite frontend
- Vercel serverless proxy at `/api/analyze`
- FastAPI backend under `backend/`
- Deterministic structure, selection, origin, and verification-routing layers
- Optional AI Meaning layer
- OpenAPI contract under `backend/openapi.yaml`
- Backend tests under `backend/app/tests/`

## Executable pipeline order

The current backend executes layers in this order:

1. Input
2. Structure
3. Origin
4. Selection
5. Verification
6. Meaning
7. Output

This order matters. Meaning runs after Origin and Verification so it can use their outputs as read-only grounding context.

## Layer responsibilities

| Layer | Purpose | AI |
|---|---|---|
| Input | Intake and well-formedness validation | No |
| Structure | Deterministic parsing, normalization, hierarchy, source anchors | No |
| Origin | Provenance and source-signal extraction | No |
| Selection | Deterministic node eligibility | No |
| Verification | Route assertions to likely record systems | No |
| Meaning | Plain-language explanation of selected nodes | Yes |
| Output | Assemble upstream layer results | No |

## Hard constraints

- No source span, no output.
- No anchor, no meaning.
- Input, Structure, Origin, Selection, Verification, and Output do not use AI.
- Meaning is the only AI interpretation layer.
- Verification routing does not decide truth.
- Origin tracing does not judge credibility.
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

Tetherpoint is best described as a source-anchored parsing pipeline and verification-routing prototype.

It is designed to make dense source text inspectable by separating structure, provenance, verification routing, and plain-language meaning.

## What this project is not

Tetherpoint is not:

- a fact checker
- a legal advice tool
- a credibility score
- a summarizer
- a political recommendation system
- a general chatbot

## Reviewer note

The main technical claim of this repository is constraint separation: each layer has a narrow responsibility, and downstream outputs should remain traceable to explicit upstream source nodes.
