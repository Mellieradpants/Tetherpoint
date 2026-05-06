# Frontend Structure Rules

This file defines frontend cleanup and structure rules for Tetherpoint.

These rules apply before new UI features, tab changes, contract rendering changes, or frontend refactors.

## Core rule

Readable structure is part of the product.

Tetherpoint is an inspectable interpretation-state system. The frontend code must demonstrate the same principle: clear boundaries, clear ownership, and no hidden junk drawers.

## No junk-drawer files

A file must not become a catch-all for unrelated UI, state, helpers, API behavior, contract rendering, and domain logic.

If a file starts collecting multiple responsibilities, split it before adding more behavior.

A reviewer should be able to understand why a file exists within 30 seconds.

## One file, one primary job

Each frontend file should have one clear primary responsibility.

Examples:

- `ReceiptWorkspace.tsx` should own workspace shell behavior: tab state, layout, and routing between tab components.
- `OriginTab.tsx` should own source identity, source metadata, provenance, reference packets, and origin signals.
- `GovernanceTab.tsx` should own governance status, review handoffs, active issues, and escalation states.
- `MeaningTab.tsx` should own bounded plain meaning, source-backed interpretation, translation, and extended meaning tools.
- `VerificationTab.tsx` should own verification routes, evidence paths, expected record systems, and assertion/path state.
- `shared.tsx` should contain small reusable UI primitives and helpers only.
- `ContractStateSections.tsx` should contain reusable contract-state display components, not global layout ownership.

## Tab ownership

Tabs are not cosmetic categories. They are views over specific parts of the interpretation graph.

- Origin = source state and provenance.
- Verification = evidence route and source-path state.
- Governance = review, escalation, and boundary state.
- Meaning = bounded interpretation state.
- Issues = active problems and user-facing blockers.

Contract data must render where it belongs:

- `source_metadata` belongs in Origin.
- `human_review_handoffs` belongs in Governance.

Do not mount contract-state cards globally above the workspace unless there is a separate approved alert-strip design.

## Split before feature

If a requested change targets a large mixed file, the first question is:

```text
Can this be safely added here, or should the relevant responsibility be extracted first?
```

Default rule:

```text
If the file is already large and mixed, split first, then add the feature.
```

Do not continue adding new behavior to a file that is already carrying unrelated responsibilities.

## Allowed cleanup pattern

Cleanup should happen in small, verifiable phases:

1. Extract one bounded component or helper group.
2. Preserve existing behavior.
3. Build or deploy-verify.
4. Add the new feature only after the extraction is stable.
5. Remove temporary bridge logic once no longer needed.

Avoid broad refactors that change behavior and structure at the same time.

## Agent workflow rules

For AI-assisted frontend work:

- Use GitHub main as source of truth.
- Do not use OneDrive, local paths, or unverified runtime state unless explicitly authorized.
- Do not run broad “inspect and fix” tasks.
- Always list allowed files and forbidden files.
- Avoid whole-file replacement for large files unless the complete current file has been verified and the replacement is intentional.
- Prefer exact insertions, exact imports, and exact render guards.
- Preserve working behavior before adding new behavior.

## Required prompt shape for frontend changes

Every frontend task should specify:

- phase name
- goal
- allowed files
- forbidden files
- exact ownership boundary
- expected render behavior
- verification step
- cleanup check

## Cleanup check

Before a frontend task is complete, verify:

- Does each edited file still have one primary job?
- Did the change introduce hidden coupling?
- Did tab-specific logic stay inside the correct tab?
- Did shared helpers stay generic?
- Did contract rendering stay attached to the correct meaning layer?
- Did any temporary bridge logic need a follow-up note or removal?
- Would a new engineer understand the file structure without private context?

## Current cleanup priority

The current priority is reducing `ReceiptWorkspace.tsx` from a mixed workspace file into a shell plus tab components.

Recommended order:

1. Extract shared UI primitives/helpers used by tabs.
2. Extract `OriginTab.tsx`.
3. Extract `GovernanceTab.tsx`.
4. Wire `source_metadata` into Origin.
5. Wire `human_review_handoffs` into Governance.
6. Extract Meaning, Verification, and Issues later.

Do not combine all of these into one unreviewable rewrite.
