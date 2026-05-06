# Frontend Structure Inventory

This document records the current frontend structure before further UI feature work.

Purpose:

- make file ownership visible
- identify junk-drawer risk
- identify stale or duplicate result surfaces
- define cleanup order before new feature work resumes

This inventory is based on GitHub `main` as source of truth.

## Current rule

Feature work is paused until the active frontend structure is cleaned enough that each file has a clear responsibility.

Readable structure is part of the product. The repo should demonstrate the same inspectability and traceability that Tetherpoint exposes in its outputs.

## Active files reviewed

### `src/App.tsx`

Current role:

- application shell
- landing/how-to-use content
- analysis request orchestration
- input visibility toggle
- result state ownership
- mounts `AnalyzeForm`
- mounts `ReceiptWorkspace`

Current status:

- active
- should remain the app shell
- currently clean of global `ContractStateSections` mounting

Ownership recommendation:

- keep as shell/orchestration
- do not add tab content here
- do not add contract display here
- consider moving landing/how-to-use copy into its own component later if it grows

Risk level: low to moderate.

---

### `src/components/AnalyzeForm.tsx`

Current role:

- input form
- content type selector
- submit controls
- bundled SAVE Act sample text

Current status:

- active
- contains a large hard-coded legislation sample

Ownership recommendation:

- keep form behavior here
- move sample text to a dedicated sample file later, such as `src/samples/saveActSample.ts` or `src/samples/legislation/saveActSample.ts`
- eventually replace legislation-as-primary sample framing with adapter-neutral sample selection

Risk level: moderate.

---

### `src/components/ReceiptWorkspace.tsx`

Current role:

- active result workspace
- tab routing
- Meaning tab content
- Origin tab content
- Verification tab content
- Governance tab content
- Issues/review content
- translation UI
- extended meaning resolver UI
- repeated UI helpers
- export/copy result logic
- source/reference helper logic
- governance helper logic

Current status:

- active
- highest junk-drawer risk
- highest edit-risk file
- should not receive new feature work until split

Ownership recommendation:

- convert into workspace shell only
- extract tab content into separate files
- extract shared UI helpers into a shared file
- avoid whole-file replacement unless absolutely necessary

Target future role:

- owns selected tab state
- owns high-level workspace layout
- imports tab components
- passes `PipelineResponse` data into tab components

Risk level: high.

Immediate cleanup priority:

1. extract shared primitives/helpers needed by tab components
2. extract `OriginTab.tsx`
3. extract `GovernanceTab.tsx`
4. only then wire `source_metadata` into Origin and `human_review_handoffs` into Governance
5. extract Meaning/Verification/Issues later

---

### `src/components/ContractStateSections.tsx`

Current role:

- contract-state display helpers
- Human Review Handoff summary logic
- Source Metadata Contract summary logic
- legacy/global wrapper export `ContractStateSections`

Current status:

- active utility/component file
- not currently mounted globally from `App.tsx`
- summary helpers exist but are not yet exported for tab-level use

Ownership recommendation:

- keep reusable contract-state summary components here
- export `SourceMetadataSummary`
- export `HumanReviewSummary`
- do not make this file responsible for workspace placement
- do not globally mount `ContractStateSections` above the workspace

Risk level: moderate.

---

### `src/components/Workspace.tsx`

Current role:

- defines exported `PipelineResponse` frontend type
- contains an alternate/older workspace-style UI surface
- includes many types and helper components
- imports `SourceMetadataContract` and `HumanReviewHandoff` types

Current status:

- type source is active because `PipelineResponse` is imported elsewhere
- UI surface appears alternate/stale relative to active `ReceiptWorkspace`

Ownership recommendation:

- separate type ownership from UI surface later
- move response types into a dedicated file such as `src/types/pipeline.ts`
- decide whether the `Workspace` UI component is active, archived, or removed

Risk level: high.

---

### `src/components/WorkspaceConsole.tsx`

Current role:

- alternate engine trace / console workspace
- imports `PipelineResponse` from `Workspace`
- contains its own side panel, tabs, helpers, origin/governance/verification display, and engine rail

Current status:

- likely alternate/stale result surface
- not mounted by `App.tsx`

Ownership recommendation:

- quarantine until active usage is confirmed
- do not update during active UI cleanup unless a verified import path requires it
- decide later whether to archive, remove, or convert into a developer/debug view

Risk level: high.

---

### `src/lib/api-client.ts`

Current role:

- frontend API client
- request/response helpers for `/api/analyze`, `/api/translate`, and `/api/resolve-reference`
- source metadata and human review contract types

Current status:

- active
- appropriate place for API-client behavior and API-adjacent types

Ownership recommendation:

- keep API request functions here
- keep contract types here unless a dedicated `src/types` structure is created later
- avoid adding UI logic here

Risk level: low.

## Current structural risks

### 1. Active workspace file is too large

`ReceiptWorkspace.tsx` is the primary cleanup blocker. It mixes shell, tabs, helpers, translation, extended meaning, governance, origin, verification, and UI primitives.

Resolution:

- split by tab boundary before adding more UI behavior

### 2. Multiple workspace surfaces exist

Current result surfaces include at least:

- `ReceiptWorkspace.tsx`
- `Workspace.tsx`
- `WorkspaceConsole.tsx`

Resolution:

- mark `ReceiptWorkspace` as active result surface
- treat `WorkspaceConsole` and `Workspace` UI as alternate/stale until verified
- preserve `Workspace.tsx` type exports until type ownership is moved

### 3. Type ownership is mixed with UI ownership

`Workspace.tsx` exports `PipelineResponse` but also contains UI rendering.

Resolution:

- later extract `PipelineResponse` and related types into a dedicated type file

### 4. Contract rendering exists but placement is not wired cleanly

`ContractStateSections.tsx` has useful summary logic, but the global wrapper should not be used as the primary placement surface.

Resolution:

- export summary components
- render them only inside their owning tabs after tab extraction

### 5. Legislation sample is embedded in the form

`AnalyzeForm.tsx` contains a large SAVE Act sample.

Resolution:

- later move sample text into a dedicated samples file
- keep current behavior until sample strategy is replaced

## Cleanup order

### C1: confirm active surface and quarantine alternates

Goal:

- document that `ReceiptWorkspace.tsx` is active because `App.tsx` mounts it
- mark `Workspace.tsx` and `WorkspaceConsole.tsx` as not to edit unless active usage is verified

### C2: extract shared helpers from `ReceiptWorkspace.tsx`

Goal:

- create `src/components/receipt-workspace/shared.tsx`
- move only small, low-risk shared UI primitives and pure helpers

Candidate helpers:

- `Section`
- `EmptyState`
- `StatusPill`
- `DetailRow`
- `SourceQuote`
- status formatting/tone helpers if needed by extracted tabs

Rules:

- no behavior change
- no contract rendering yet
- no tab extraction in same pass unless required

### C3: extract `OriginTab.tsx`

Goal:

- move Origin tab rendering into `src/components/receipt-workspace/OriginTab.tsx`
- preserve current Origin behavior exactly

### C4: extract `GovernanceTab.tsx`

Goal:

- move Governance tab rendering into `src/components/receipt-workspace/GovernanceTab.tsx`
- preserve current Governance behavior exactly

### C5: wire contract summaries into extracted tabs

Goal:

- export `SourceMetadataSummary` from `ContractStateSections.tsx`
- export `HumanReviewSummary` from `ContractStateSections.tsx`
- render Source Metadata inside `OriginTab.tsx`
- render Human Review inside `GovernanceTab.tsx`

Rules:

- no global contract mount
- no empty states for missing arrays
- no backend/schema/OpenAPI changes

## Current do-not-touch list

Until the first extraction passes are complete, do not modify:

- backend models
- backend handlers
- `backend/openapi.yaml`
- pipeline behavior
- retrieval behavior
- `App.tsx` global result mounting
- Meaning/Verification feature behavior
- alternate workspace surfaces unless the task is specifically inventory/quarantine

## Next recommended implementation task

Phase C2: shared helper extraction from `ReceiptWorkspace.tsx`.

Task shape:

```text
Extract only shared UI primitives and pure status helpers from ReceiptWorkspace.tsx into src/components/receipt-workspace/shared.tsx.
Preserve behavior exactly.
Do not extract tabs yet.
Do not add Source Metadata or Human Review rendering yet.
Do not edit backend/OpenAPI/schema.
```
