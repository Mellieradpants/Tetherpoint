# Tetherpoint Backend

Source-anchored parsing stack. API-first.

## Executable layer order

The current backend executes this order:

| # | Layer | Purpose | AI |
|---|---|---|---|
| 1 | Input | Intake and well-formedness validation. No inference. | No |
| 2 | Structure | Deterministic parse, normalization, hierarchy, and source anchors. | No |
| 3 | Origin | Provenance, document identity, and source-signal extraction. | No |
| 4 | Selection | Deterministic node eligibility. | No |
| 5 | Rule Units | Assemble selected structure nodes into coherent interpretation units. | No |
| 6 | Verification | Verification-path routing for rule units only. | No |
| 7 | Meaning | Document-level plain meaning from a bounded Rule Unit brief. | No by default; future optional AI must stay document-level and bounded |
| 8 | Governance | Deterministic source-support, consistency, and action-safety checks. | No |
| 9 | Output | Assemble upstream results. No new meaning. | No |

This order matches `backend/app/pipeline/runner.py`.

Atomic Structure nodes are traceability units. Rule Units are coherent interpretation units. Verification and Meaning operate on Rule Units, not raw atomic nodes. Governance evaluates normalized anchored records before final output assembly.

## Hard constraints

- No inference in Input, Structure, Origin, Selection, Rule Units, Verification, Governance, or Output.
- Atomic nodes are source/trace pieces, not public Meaning targets.
- Rule Units are interpretation units.
- Meaning must not use scope labels, shift labels, or comparison taxonomy in the default Tetherpoint path.
- Origin traces provenance and reference signals only; it does not judge credibility.
- Verification routes to record systems only and does not decide truth.
- Governance checks support and action safety only; it does not decide truth, resolve conflicts, repair values, or overwrite values.
- Output presents upstream results and should not transform meaning.
- Fail rather than guess.
- Absence is not permission to invent.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/analyze` | Run the 9-layer pipeline on a document |
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
  "meaning": {},
  "origin": {},
  "verification": {},
  "governance": {},
  "output": {},
  "errors": []
}
```

Each layer produces its own distinct section. Layers are not merged.

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

5. Rule Units — Groups selected structure nodes into coherent interpretation units while preserving supporting source-node IDs.

6. Verification — Routes Rule Units to candidate record systems. Detects broad assertion types and maps them to record systems such as Congress.gov, PubMed, SEC EDGAR, FERC, and National Archives. This is routing logic, not truth logic.

7. Meaning — Produces document-level plain meaning from a deterministic Rule Unit brief. It does not use scope labels, shift labels, or comparison lenses.

8. Governance — Evaluates normalized anchored records for required source support, field-level contradictions when comparison records are supplied, and downstream action safety when an action is requested. It emits review status only; it does not decide truth or repair data.

9. Output — Assembles the final response from upstream layers. Presentation only.

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
    verification/
      handler.py         # Layer 6: Verification
    meaning/
      handler.py         # Layer 7: Meaning
    governance/
      handler.py         # Layer 8: Governance
    output/
      handler.py         # Layer 9: Output
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
