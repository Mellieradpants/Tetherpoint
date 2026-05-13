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

Remaining cleanup:

- move large hard-coded sample text into a dedicated sample file.

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

### `src/components/Workspace.tsx`

Partially active because it exports `PipelineResponse` and related frontend response types.

It also contains an older alternate workspace UI surface.

Remaining cleanup:

1. Move `PipelineResponse` and related response types into a dedicated type file, likely `src/types/pipeline.ts`.
2. Update imports.
3. Decide whether the old UI surface should be archived, removed, or retained as a developer/debug view.

Do not delete this file until type ownership has been moved and imports have been verified.

### `src/components/WorkspaceConsole.tsx`

Alternate/unconfirmed surface.

Remaining cleanup:

- confirm imports/usages
- archive, remove, or label as developer/debug-only

Do not treat it as the active result workspace unless an import path proves it is active.

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

Remaining:

- move frontend response types out of `Workspace.tsx`
- decide the fate of the old `Workspace.tsx` UI surface
- decide the fate of `WorkspaceConsole.tsx`
- move large sample text out of `AnalyzeForm.tsx`
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
