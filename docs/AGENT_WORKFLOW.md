# Agent Workflow Guide

## Purpose

This file is the durable working guide for AI-assisted and human-assisted implementation in this repository.

It replaces the temporary cleanup-planning docs. It should stay short, current, and practical.

## Source of truth

Use GitHub `main` as the source of truth unless the maintainer explicitly says otherwise.

Do not assume local files, deleted chat context, uncommitted work, or previous assistant memory reflects the current repository.

If a file, build result, route, endpoint, or dependency has not been verified from the repository or a tool result, treat it as unknown.

## Current project posture

Tetherpoint is a source-backed interpretation-state system. The repository should reflect the same principle as the product:

```text
clear boundaries, visible handoffs, no hidden junk drawers
```

Feature work should not be added into files that are already carrying unrelated responsibilities. Split ownership first, then add behavior.

Do not claim pipeline integration is complete unless the backend, OpenAPI, tests, frontend display, and product behavior have all been explicitly connected and verified for that scope.

## Active frontend status

`src/components/ReceiptWorkspace.tsx` is the active result workspace mounted by `App.tsx`.

It should remain a shell for:

- workspace layout
- tab state
- tab routing
- top-level result header
- error banner placement
- support-path placement

Tab and panel logic belongs in `src/components/receipt-workspace/`.

Current extracted surfaces include:

- `MeaningTab.tsx`
- `OriginTab.tsx`
- `VerificationTab.tsx`
- `GovernanceTab.tsx`
- `IssuesTab.tsx`
- `SupportPathPanel.tsx`
- `ResultActions.tsx`
- `shared.tsx`

`SupportPathPanel.tsx` remains the document-first display surface for `document_first_v2`. It should present document-first support state without implying Meaning, Verification, Governance, or full pipeline integration is complete.

Frontend response types live in `src/types/pipeline.ts`. Active components should import `PipelineResponse` and related frontend response types from there, not from UI components.

Frontend sample text lives in `src/samples/`. Keep large sample strings out of interactive form components.

`src/components/Workspace.tsx` has been removed. It no longer owns response types or an alternate workspace UI surface.

Contract-state rendering rule:

- `source_metadata` belongs in Origin.
- `human_review_handoffs` belongs in Governance.
- Do not mount contract cards globally unless a separate alert-strip design is explicitly approved.

## Remaining cleanup targets

Do these before major new product-direction work:

1. Decide whether `WorkspaceConsole.tsx` is removed, archived, or explicitly labeled developer/debug-only.
2. Keep docs aligned with the actual code state after each cleanup pass.

## Task discipline

Every implementation task should have:

- one clear goal
- allowed files
- forbidden files or areas
- expected behavior
- verification step
- plain-language commit message

Avoid broad prompts like:

```text
clean up the frontend
fix the app
improve the repo
```

Prefer scoped prompts like:

```text
Move sample text out of AnalyzeForm.tsx into src/samples. Do not change form behavior.
```

## Commit discipline

One commit should equal one scoped change.

Use plain-language commit messages, such as:

- `Extract Issues tab component`
- `Move pipeline response types`
- `Remove unused workspace surface`
- `Move sample text out of analyze form`
- `Update frontend structure docs`

Avoid:

- `fix`
- `updates`
- `cleanup`
- `misc`

## Backend and contract rule

Do not change backend behavior, schemas, OpenAPI, pipeline order, retrieval behavior, or document-intake behavior as part of frontend cleanup unless the task explicitly allows it.

Any backend schema or response shape change must keep these aligned in the same pass:

- backend models
- backend handlers
- `backend/openapi.yaml`
- frontend API client/types
- frontend rendering assumptions
- tests
- relevant docs

## Mobile rule

Frontend-facing changes must remain usable on mobile.

Check form controls, sample buttons, result panels, long source text, wide identifiers, tab navigation, and structured output wrapping or scrolling.

Do not solve cramped mobile layout with vertical or rotated text.

## Stop conditions

Stop and report instead of guessing when:

- a file cannot be verified
- an import path is unclear
- a build or deploy check fails
- a change would cross frontend/backend/schema boundaries
- a supposedly unused file may still own exported types
- a task would require broad whole-file replacement without review
