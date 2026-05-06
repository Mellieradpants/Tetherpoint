# Repository Structure Map

## Purpose

This document provides a human-readable map of the Tetherpoint repository.

It is intended for:

- engineers joining the project
- AI agents assisting with implementation
- reviewers evaluating repository organization
- collaborators entering the system without prior context

This document explains:

- where major responsibilities live
- which frontend surfaces are active
- which files are alternate/stale
- how the frontend and backend are separated
- where new contributors should start
- what areas require extra caution

This is not a full architecture document.

Read first:

1. `README.md`
2. `docs/TETHERPOINT_OVERVIEW.md`
3. `docs/FRONTEND_STRUCTURE_RULES.md`
4. `docs/FRONTEND_STRUCTURE_INVENTORY.md`
5. `docs/REPO_STRUCTURE_MAP.md`

---

# Current Project Direction

Tetherpoint is evolving from a legislation-focused prototype into a broader source-dependent interpretation and verification system.

Current cleanup direction:

- reduce large mixed frontend files
- separate frontend ownership boundaries
- improve repo readability
- preserve explicit source/meaning/governance separation
- make active vs alternate surfaces visible

Feature work is currently secondary to cleanup and stabilization.

---

# Top-Level Repository Areas

## `/backend`

Purpose:

- pipeline execution
- parsing
- structure extraction
- origin processing
- verification routing
- governance logic
- bounded meaning generation
- API endpoints
- OpenAPI contract generation

Rules:

- backend behavior changes must remain traceable
- frontend cleanup should not casually modify backend behavior
- schema and contract changes require explicit scope

Key areas:

- adapters
- parsers
- governance
- verification
- API routes
- OpenAPI generation

---

## `/src`

Purpose:

- frontend application
- workspace UI
- analysis input
- inspection surfaces
- tab rendering
- API client calls

Primary frontend ownership area.

---

## `/src/components`

Purpose:

- frontend React components
- workspace rendering
- form rendering
- contract display
- result surfaces

Current important distinction:

Some files are active.
Some files are alternate/stale.

Do not assume every workspace file is active.

---

# Active Frontend Surface

## `src/components/ReceiptWorkspace.tsx`

Current status:

- ACTIVE result workspace
- mounted from `App.tsx`

Current role:

- workspace shell
- tab routing
- multiple tab render surfaces
- helper ownership
- translation/extended meaning UI

Current cleanup direction:

- reduce into shell-only responsibility
- extract tab ownership into separate files

High caution file.

Do not perform broad rewrites.

---

## `src/App.tsx`

Current status:

- ACTIVE app shell

Role:

- application shell
- result state ownership
- form/workspace orchestration

Rules:

- do not add tab logic here
- do not mount global contract cards here

---

## `src/components/AnalyzeForm.tsx`

Current status:

- ACTIVE

Role:

- document input
- submission controls
- sample content

Future cleanup:

- move large hard-coded samples into dedicated sample files

---

## `src/components/ContractStateSections.tsx`

Current status:

- ACTIVE reusable contract display surface

Role:

- Source Metadata summaries
- Human Review summaries
- reusable contract-state rendering

Rules:

- owns reusable contract rendering only
- should not own global placement/layout policy

---

# Alternate / Stale Frontend Surfaces

These files exist but are not currently treated as the primary result surface.

Do not casually modify them during cleanup.

---

## `src/components/Workspace.tsx`

Current status:

- PARTIALLY ACTIVE

Important:

- exports `PipelineResponse` type currently used elsewhere
- also contains an alternate workspace-style UI surface

Rules:

- preserve type compatibility
- do not remove casually
- eventual cleanup should separate type ownership from UI ownership

---

## `src/components/WorkspaceConsole.tsx`

Current status:

- ALTERNATE / UNCONFIRMED

Role:

- engine trace console surface
- alternate workspace visualization

Rules:

- do not treat as active frontend source of truth
- do not edit unless explicitly scoped
- likely candidate for archive, quarantine, or later developer/debug tooling

---

# API Client Area

## `src/lib/api-client.ts`

Purpose:

- frontend API calls
- request/response helpers
- frontend contract types

Rules:

- no UI rendering here
- preserve API contract clarity
- backend field additions should remain visible to frontend callers

---

# Documentation Area

## `/docs`

Purpose:

- architecture explanation
- workflow rules
- cleanup direction
- onboarding
- agent guidance
- frontend inventory

Important principle:

The repo should explain itself.

A contributor should not need hidden chat context to understand the project direction.

---

# Current Cleanup Sequence

## Phase C1

Completed:

- frontend structure rules
- frontend structure inventory
- architecture overview
- repo structure map

---

## Phase C2

Next:

- extract shared helpers from `ReceiptWorkspace.tsx`
- create `src/components/receipt-workspace/shared.tsx`

Rules:

- preserve behavior exactly
- no tab extraction yet
- no backend changes
- no contract rendering changes yet

---

## Phase C3

Next after shared helper extraction:

- extract `OriginTab.tsx`

---

## Phase C4

Next after Origin extraction:

- extract `GovernanceTab.tsx`

---

## Phase C5

Only after extraction stabilizes:

- wire `source_metadata` into Origin
- wire `human_review_handoffs` into Governance

---

# Agent Workflow Rules

AI agents are treated like collaborators entering an existing engineering system.

Agents should not wander the repository without structure.

Every scoped task should specify:

- allowed files
- forbidden files
- expected ownership boundary
- expected render behavior
- verification step
- cleanup check
- plain-language commit message

Avoid:

- broad “inspect and fix” prompts
- large unreviewable rewrites
- local filesystem drift
- OneDrive/source confusion
- vague commits such as `fix` or `updates`

---

# Current Architectural Principle

The repository should visually reflect the same principles as the runtime system:

- explicit structure
- visible boundaries
- traceable flow
- no hidden assumptions
- no junk drawers
- no silent layer mixing

The codebase itself is part of the trust model.
