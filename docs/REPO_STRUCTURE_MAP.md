# Repository Structure Map

## Purpose

This document maps the active Tetherpoint repository structure.

It is intended for engineers, AI agents, reviewers, and collaborators who need to understand where responsibilities live before changing code.

This is not a full architecture document. For project architecture, start with `README.md` and `docs/TETHERPOINT_OVERVIEW.md`. For agent workflow and task discipline, read `docs/AGENT_WORKFLOW.md`.

## Top-level areas

### `/backend`

Owns the FastAPI backend and traceability pipeline:

- input validation
- structure extraction
- origin processing
- selection
- rule-unit assembly
- governance gate
- verification routing
- bounded meaning
- governance checks
- output assembly
- OpenAPI contract

Rules:

- Do not change backend behavior during frontend cleanup unless explicitly scoped.
- Schema or response-shape changes must update backend models, OpenAPI, frontend types, tests, and docs in the same pass.
- Document-intake behavior belongs in backend adapter work, not frontend cleanup.

Key files and areas:

- `backend/app/pipeline/runner.py`
- `backend/app/schemas/models.py`
- `backend/app/schemas/document_packet.py`
- `backend/app/structure/document_packet_adapter.py`
- `backend/openapi.yaml`
- `backend/README.md`

### `/src`

Owns the React/Vite frontend:

- app shell
- input form
- result workspace
- tab surfaces
- frontend response types
- sample text fixtures
- frontend API client
- UI presentation of source, meaning, verification, and governance state

### `/docs`

Owns stable project orientation:

- architecture overview
- agent workflow rules
- repository map
- human review handoff behavior
- source/document architecture notes

Docs should stay current and should not preserve temporary cleanup scaffolding after the cleanup has been absorbed into code.

## Active frontend surfaces

### `src/App.tsx`

Active app shell.

Owns:

- application-level state
- input visibility
- `AnalyzeForm` mount
- `ReceiptWorkspace` mount

Must not own:

- tab rendering
- source metadata display
- governance display
- result detail logic

### `src/components/AnalyzeForm.tsx`

Active input form.

Owns:

- document input controls
- content type selector
- submit controls
- sample button behavior

Sample text lives outside the form in `src/samples/`.

### `src/samples/`

Owns frontend sample text fixtures used by the input form.

Current sample modules:

- `saveActSample.ts`
- `documentPacketSample.ts`

Rules:

- Keep large sample strings out of interactive form components.
- Do not change sample content during structural cleanup unless the task explicitly asks for content changes.

### `src/types/pipeline.ts`

Owns frontend response types for the analysis result surface.

Current responsibilities:

- `PipelineResponse`
- related frontend response interfaces used by active result components

Rules:

- Frontend components should import pipeline response types from this file, not from UI surfaces.
- Backend schema changes must still be handled through backend models, OpenAPI, frontend types, tests, and docs together.

### `src/components/ReceiptWorkspace.tsx`

Active result workspace shell.

Owns:

- workspace layout
- selected tab state
- tab routing
- top result header
- error banner placement
- support-path placement

Must not own:

- individual tab logic
- contract summary logic
- support-path internals
- copy/export internals
- API behavior

### `src/components/receipt-workspace/`

Active tab and panel directory.

Current extracted surfaces:

- `MeaningTab.tsx`
- `OriginTab.tsx`
- `VerificationTab.tsx`
- `GovernanceTab.tsx`
- `IssuesTab.tsx`
- `SupportPathPanel.tsx`
- `ResultActions.tsx`
- `ExtendedMeaningPanel.tsx`
- `shared.tsx`

Ownership rules:

- Origin owns provenance, referenced sources, and `source_metadata` rendering.
- Governance owns review state, governance checks, and `human_review_handoffs` rendering.
- Verification owns evidence routes and expected record systems.
- Meaning owns bounded plain-language output and related meaning tools.
- Issues owns pipeline and governance issue lists.
- Support Path owns `document_first_v2` display only.
- `SupportPathPanel.tsx` remains the document-first display surface; it should not claim the unified pipeline is complete.
- `shared.tsx` owns small reusable UI primitives and pure helpers only.

### `src/components/ContractStateSections.tsx`

Reusable contract-summary component file.

Owns:

- `SourceMetadataSummary`
- `HumanReviewSummary`
- compatibility wrapper `ContractStateSections`

Placement rule:

- Source Metadata summary should render inside Origin.
- Human Review summary should render inside Governance.
- Do not globally mount contract cards unless a separate alert-strip design is explicitly approved.

### `src/lib/api-client.ts`

Frontend API client.

Owns:

- `/api/analyze` call helper
- `/api/translate` call helper
- `/api/resolve-reference` call helper
- API-adjacent frontend contract types

Must not own UI rendering.

## Partially active or stale frontend surfaces

### `src/components/WorkspaceConsole.tsx`

Alternate/unconfirmed surface.

Current status:

- not mounted by the active app shell
- imports pipeline response types from `src/types/pipeline.ts`
- still needs a product decision: remove, archive, or explicitly label as developer/debug-only

Do not treat it as the active result workspace unless an import path proves it is active.

### Removed surfaces

`src/components/Workspace.tsx` has been removed.

The old file no longer owns frontend response types or an alternate workspace UI surface. Frontend response types now live in `src/types/pipeline.ts`.

## Current cleanup status

Completed:

- shared helper extraction from `ReceiptWorkspace.tsx`
- Origin tab extraction
- Governance tab extraction
- Meaning tab extraction
- Verification tab extraction
- Issues tab extraction
- Result actions extraction
- Support Path panel extraction
- Source Metadata rendered inside Origin
- Human Review Handoffs rendered inside Governance
- `ReceiptWorkspace.tsx` reduced to active workspace shell
- frontend response types moved to `src/types/pipeline.ts`
- old `Workspace.tsx` UI surface removed
- large sample text moved to `src/samples/`

Remaining:

- decide the fate of `WorkspaceConsole.tsx`
- keep docs aligned after each cleanup pass

## Current architectural principle

The repository should visually reflect the same principles as the runtime system:

- explicit structure
- visible boundaries
- traceable flow
- no hidden assumptions
- no junk drawers
- no silent layer mixing

The codebase itself is part of the trust model.
