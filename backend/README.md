# Tetherpoint Backend

Source-anchored parsing stack. API-first.

The backend supports Tetherpoint’s interface-level traceability goal:

```text
Traceability before fluency.
```

It does not try to decide truth. It produces structured, source-backed records so the interface can show what an AI-assisted meaning came from, what it depends on, what is missing, and what still needs review.

## Executable layer order

The current backend executes this order:

| # | Layer | Purpose | AI |
|---|---|---|---|
| 1 | Input | Intake and well-formedness validation. No inference. | No |
| 2 | Structure | Deterministic parse, normalization, hierarchy, and source anchors. | No |
| 3 | Origin | Provenance, document identity, source-signal extraction, and referenced-source detection. | No |
| 4 | Selection | Deterministic node eligibility. | No |
| 5 | Rule Units | Assemble selected structure nodes into coherent interpretation units and reference dependency packets. | No |
| 6 | Governance Gate | Pre-Meaning scope, reference-boundary, non-blending, and limit checks. | No |
| 7 | Verification | Verification-path routing for rule units only. | No |
| 8 | Meaning | Document-level plain meaning from a bounded Rule Unit brief. | No by default; future optional AI must stay bounded |
| 9 | Governance | Deterministic source-support, consistency, and action-safety checks. | No |
| 10 | Output | Assemble upstream results. No new meaning. | No |

This order matches `backend/app/pipeline/runner.py`.

Atomic Structure nodes are traceability units. Rule Units are coherent interpretation units. The Governance Gate runs before Meaning to expose reference boundaries, non-blending constraints, and source-dependency limits. Verification and Meaning operate on Rule Units, not raw atomic nodes. Final Governance evaluates normalized anchored records before output assembly.

## Core backend mechanism

```text
Input
→ Structure
→ Origin
→ Selection
→ Rule Units
→ Governance Gate
→ Verification
→ Meaning
→ Governance
→ Output
```

The backend should preserve this contract:

```text
source first
anchor visible
meaning second
missing dependencies shown
human review preserved
```

When text points outside itself, the backend should represent that dependency instead of allowing the interface to treat meaning as complete.

## Reference dependency

Reference dependency is a core backend concern.

A source may depend on another source: a definition, statute, exhibit, guideline, dataset, agency record, court opinion, policy manual, plan document, standard, or other authority.

The backend does not need to own every domain retrieval system. It must provide a stable structure for exposing dependencies to the interface.

When a referred source is detected, the response should preserve:

- local source text
- matched reference text
- referred source name
- reference type
- retrieval status
- anchors
- limits
- source text if supplied or retrieved

When the referred source is missing, incomplete, or not attempted, the backend should keep that state explicit so Meaning stays bounded and the interface can show the unresolved dependency.

## Rule Units

Rule Units are the smallest source-backed units eligible for interpretation.

Atomic nodes remain source and trace pieces. Rule Units assemble selected nodes into coherent interpretation units while preserving source-node IDs, source text, conditions, exceptions, evidence requirements, consequences, definitions, timing, jurisdiction, mechanisms, and reference dependencies.

Meaning and Verification operate on Rule Units, not loose text fragments.

## Governance Gate

The Governance Gate is a pre-Meaning constraint layer.

It does not decide truth. It does not write meaning. It does not resolve references. It identifies operational scope, reference boundaries, non-blending rules, practical questions, and limits before Meaning runs.

The Governance Gate protects the system from presenting fluent meaning as complete when source dependencies are unresolved.

## Hard constraints

- No inference in Input, Structure, Origin, Selection, Rule Units, Governance Gate, Verification, Governance, or Output.
- Atomic nodes are source/trace pieces, not public Meaning targets.
- Rule Units are interpretation units.
- Reference dependencies must stay visible.
- Missing referred sources must not be silently filled.
- Meaning must not cross a reference boundary as if the referred source were anchored.
- Meaning must not use scope labels, shift labels, or comparison taxonomy in the default Tetherpoint path.
- Origin traces provenance and reference signals only; it does not judge credibility.
- Verification routes to record systems only and does not decide truth.
- Governance Gate exposes source-dependency limits before Meaning; it does not resolve references.
- Governance checks support and action safety only; it does not decide truth, resolve conflicts, repair values, or overwrite values.
- Output presents upstream results and should not transform meaning.
- Fail rather than guess.
- Absence is not permission to invent.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/analyze` | Run the 10-layer pipeline on a document |
| GET | `/health` | Liveness check |
| GET | `/docs` | Interactive OpenAPI documentation |
| GET | `/redoc` | ReDoc documentation |

## API contract

See `openapi.yaml` for the full OpenAPI 3.1 specification.

### Request

```json
{
  "content": "raw document text",
  "content_type": "xml | html | json | text",
  "options": {
    "run_meaning": true,
    "run_origin": true,
    "run_verification": true
  }
}
```

### Response

```json
{
  "input": {},
  "structure": {},
  "selection": {},
  "rule_units": {},
  "governance_gate": {},
  "meaning": {},
  "origin": {},
  "verification": {},
  "governance": {},
  "output": {},
  "errors": []
}
```

Each layer produces its own distinct section. Layers are not merged.

### Governance Gate response

The Governance Gate emits a structured pre-Meaning result object:

```json
{
  "status": "needs_review",
  "scope_lanes": ["reference_boundary"],
  "actor_scopes": [],
  "process_scopes": [],
  "evidence_categories": [],
  "reference_roles": [],
  "non_blending_rules": [],
  "practical_questions": [],
  "limits": ["Referenced source text has not been retrieved or selected by Governance Gate."]
}
```

The exact lanes and rules may be domain-specific, but the interface contract is general: expose limits before Meaning.

### Governance response

Governance emits a structured result object:

```json
{
  "status": "match",
  "record_count": 2,
  "issue_count": 0,
  "results": [],
  "activeIssues": [],
  "principle": "The governance layer does not decide what is true; it determines whether a record is sufficiently supported and safe to act on."
}
```

The output summary also exposes:

```json
{
  "governance_status": "match",
  "governance_issue_count": 0
}
```

## Authentication

The backend `/analyze` endpoint is intended to be called by the server-side Vercel proxy, not directly by the browser.

The backend requires this header when `ANALYZE_SECRET` is configured:

```text
x-analyze-secret: <shared secret>
```

The browser calls `/api/analyze`; the Vercel function attaches the backend secret before forwarding the request.

## Run backend locally

### Prerequisites

- Python 3.11+
- pip

### Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Linux/macOS
# venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

### Environment variables

```bash
cp .env.example .env
```

Set these as needed:

```text
ANALYZE_SECRET=<shared secret for server-to-server calls>
OPENAI_API_KEY=<optional, reserved for future bounded Meaning use>
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.example
```

The default Meaning path does not require `OPENAI_API_KEY`. It uses a deterministic Rule Unit brief so the pipeline stays runtime-safe.

### Start

```bash
uvicorn app.main:app --reload --port 8000
```

API docs are available at:

```text
http://localhost:8000/docs
```

### Docker

```bash
cd backend
docker build -t tetherpoint .
docker run -p 8000:8000 -e ANALYZE_SECRET=dev-secret tetherpoint
```

## Sample curl

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -H "x-analyze-secret: dev-secret" \
  -d '{
    "content": "The SEC must enforce compliance by March 2025. Congress enacted Public Law 118-1.",
    "content_type": "text",
    "options": {
      "run_meaning": false,
      "run_origin": true,
      "run_verification": true
    }
  }'
```

## Run tests

```bash
cd backend
python -m pytest app/tests/ -v
```

Governance-specific tests live in:

```text
backend/app/tests/test_governance.py
```

## What each layer does

1. Input — Accepts raw content in xml, html, json, or text. Validates well-formedness. Preserves raw input. Records size and parse status. No interpretation.

2. Structure — Deterministic parsing via 10 subsystems: SSE, LNS, CFS, 5W1H, AAC, TPS, SJM, MPS, RDS, and ISC. Each node carries source anchors for traceability.

3. Origin — Extracts provenance and source-reference signals from the source document. For HTML, this includes canonical URL, author, publish time, JSON-LD publisher, Open Graph tags, and Twitter card tags. For JSON/XML, this includes explicit metadata fields. Distribution metadata stays separate from origin identity.

4. Selection — Deterministic eligibility check. Nodes must have source text, must not be CFS-blocked, and must contain at least one structured signal. Nodes pass through unchanged.

5. Rule Units — Groups selected structure nodes into coherent interpretation units while preserving supporting source-node IDs and referenced-source dependency packets.

6. Governance Gate — Checks for reference boundaries, practical source questions, non-blending constraints, and source-dependency limits before Verification and Meaning.

7. Verification — Routes Rule Units to candidate record systems. Detects broad assertion types and maps them to record systems such as Congress.gov, PubMed, SEC EDGAR, FERC, and National Archives. This is routing logic, not truth logic.

8. Meaning — Produces document-level plain meaning from a deterministic Rule Unit brief. It does not use scope labels, shift labels, or comparison lenses. Meaning must remain bounded to supplied and anchored source material.

9. Governance — Evaluates normalized anchored records for required source support, field-level contradictions when comparison records are supplied, and downstream action safety when an action is requested. It emits review status only; it does not decide truth or repair data.

10. Output — Assembles the final response from upstream layers. Presentation only.

## Project structure

```text
backend/
  app/
    main.py              # FastAPI app, endpoints, CORS
    schemas/
      models.py          # Pydantic models
    input/
      handler.py         # Layer 1: Input
    structure/
      handler.py         # Layer 2: Structure
    origin/
      handler.py         # Layer 3: Origin
    selection/
      handler.py         # Layer 4: Selection
    rule_units/
      handler.py         # Layer 5: Rule Units
    governance/
      gate.py            # Layer 6: Governance Gate
      handler.py         # Layer 9: Governance
    verification/
      handler.py         # Layer 7: Verification
    meaning/
      handler.py         # Layer 8: Meaning
    output/
      handler.py         # Layer 10: Output
    pipeline/
      runner.py          # Orchestrates executable layer order
    tests/
      test_pipeline.py   # Backend pipeline tests
      test_governance.py # Governance constraint tests
  openapi.yaml           # OpenAPI 3.1 spec
  requirements.txt
  Dockerfile
  .env.example
  README.md
```
