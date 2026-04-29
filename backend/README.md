# Tetherpoint Backend

Source-anchored parsing stack. API-first.

## Executable layer order

The current backend executes this order:

| # | Layer | Purpose | AI |
|---|---|---|---|
| 1 | Input | Intake and well-formedness validation. No inference. | No |
| 2 | Structure | Deterministic parse, normalization, hierarchy, and source anchors. | No |
| 3 | Origin | Provenance and source-signal extraction. | No |
| 4 | Selection | Deterministic node eligibility. | No |
| 5 | Verification | Verification-path routing only. | No |
| 6 | Meaning | Plain-language explanation of selected nodes. | Yes |
| 7 | Output | Assemble upstream results. No new meaning. | No |

This order matches `backend/app/pipeline/runner.py`.

Meaning runs after Origin and Verification so it can use provenance signals and verification routes as read-only grounding context.

## Hard constraints

- No inference in Input, Structure, Origin, Selection, Verification, or Output.
- Meaning is the only AI layer.
- Selection passes eligible nodes forward unchanged.
- Origin traces provenance only and does not judge credibility.
- Verification routes to record systems only and does not decide truth.
- Output presents upstream results and should not transform meaning.
- Fail rather than guess.
- Absence is not permission to invent.

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/analyze` | Run the 7-layer pipeline on a document |
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
  "meaning": {},
  "origin": {},
  "verification": {},
  "output": {},
  "errors": []
}
```

Each layer produces its own distinct section. Layers are not merged.

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
OPENAI_API_KEY=<optional, only needed for Meaning>
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.example
```

Without `OPENAI_API_KEY`, the Meaning layer returns explicit per-node errors or skipped status depending on the request path. Other layers can still run.

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

## What each layer does

1. Input — Accepts raw content in xml, html, json, or text. Validates well-formedness. Preserves raw input. Records size and parse status. No interpretation.

2. Structure — Deterministic parsing via 10 subsystems: SSE, LNS, CFS, 5W1H, AAC, TPS, SJM, MPS, RDS, and ISC. Each node carries source anchors for traceability.

3. Origin — Extracts provenance signals from the source document. For HTML, this includes canonical URL, author, publish time, JSON-LD publisher, Open Graph tags, and Twitter card tags. For JSON/XML, this includes explicit metadata fields. Distribution metadata stays separate from origin identity.

4. Selection — Deterministic eligibility check. Nodes must have source text, must not be CFS-blocked, and must contain at least one structured signal. Nodes pass through unchanged.

5. Verification — Routes assertions to candidate record systems. Detects broad assertion types and maps them to record systems such as Congress.gov, PubMed, SEC EDGAR, FERC, and National Archives. This is routing logic, not truth logic.

6. Meaning — The only AI layer. Evaluates selected nodes against constrained meaning lenses and produces plain-language explanation. It does not alter original node text.

7. Output — Assembles the final response from upstream layers. Presentation only.

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
    selection/
      handler.py         # Layer 4: Selection
    meaning/
      handler.py         # Layer 6: Meaning
    origin/
      handler.py         # Layer 3: Origin
    verification/
      handler.py         # Layer 5: Verification
    output/
      handler.py         # Layer 7: Output
    pipeline/
      runner.py          # Orchestrates executable layer order
    tests/
      test_pipeline.py   # Backend tests
  openapi.yaml           # OpenAPI 3.1 spec
  requirements.txt
  Dockerfile
  .env.example
  README.md
```
