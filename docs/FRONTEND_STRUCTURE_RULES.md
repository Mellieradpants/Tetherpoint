# Frontend Structure Rules

This file defines frontend cleanup and structure rules for Tetherpoint.

These rules apply before new UI features, tab changes, contract rendering changes, or frontend refactors.

## Core rule

Readable structure is part of the product.

Tetherpoint is an inspectable interpretation-state system. In plain language: the app shows what an interpretation is standing on, what is missing, and where human review is needed.

The frontend code must follow the same rule:

- clear boundaries
- clear ownership
- plain names
- no hidden junk drawers

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

Tabs are not cosmetic categories. Each tab owns one kind of result state.

- Origin = where the source came from and what source dependencies exist.
- Verification = where claims or assertions should be checked.
- Governance = what needs review, what is blocked, and what boundary was reached.
- Meaning = bounded plain-language interpretation.
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

## Plain-language agent prompting rule

Agents do better when the task is concrete.

Do not ask an agent to “clean up,” “improve,” “refactor,” or “fix” a large area without exact boundaries.

Every agent prompt should reduce ambiguity.

Use this shape:

```text
Phase [name]: [plain task title]

Use GitHub main as source of truth.

Goal:
[one sentence]

Allowed files:
- [file]

Forbidden files:
- [file or area]

Task:
[exact action]

Hard stops:
- Do not [specific drift risk].
- Do not [specific unrelated area].
- Do not change behavior unless explicitly stated.

Verify:
[build/test/deploy/source check]

Commit message:
[plain-language message]

Return:
- files changed
- verification result
- remaining risk
```

Bad prompt:

```text
Refactor the frontend and clean things up.
```

Good prompt:

```text
Move shared helpers out of ReceiptWorkspace into shared.tsx. Preserve behavior. Do not extract tabs.
```

## Commit discipline

Commit history is part of the navigation system for the project.

Each commit must be readable by a person scanning by pattern, not only by someone reading diffs line by line.

Hard rule:

```text
One commit = one scoped change = one plain-language message.
```

Commit messages must say what changed in plain language.

Good examples:

- `Add frontend structure rules`
- `Add frontend structure inventory`
- `Extract Origin tab component`
- `Move SAVE Act sample into samples file`
- `Export contract summary components`
- `Wire source metadata into Origin tab`
- `Restore tabbed workspace hierarchy`

Avoid vague messages:

- `fix`
- `updates`
- `cleanup`
- `changes`
- `frontend work`
- `misc`

Avoid bundling unrelated changes into one commit.

If a task needs multiple kinds of work, split the commits:

1. structure extraction
2. behavior wiring
3. cleanup/removal
4. docs update

A commit should help answer:

```text
Where did this behavior or structure change enter the repo?
```

## Agent workflow rules

For AI-assisted frontend work:

- Use GitHub main as source of truth.
- Do not use OneDrive, local paths, or unverified runtime state unless explicitly authorized.
- Do not run broad “inspect and fix” tasks.
- Always list allowed files and forbidden files.
- Avoid whole-file replacement for large files unless the complete current file has been verified and the replacement is intentional.
- Prefer exact insertions, exact imports, and exact render guards.
- Preserve working behavior before adding new behavior.
- Use one plain-language commit per scoped change.
- Do not use vague commit messages such as `fix`, `updates`, `cleanup`, or `changes`.

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
- plain-language commit message

## Cleanup check

Before a frontend task is complete, verify:

- Does each edited file still have one primary job?
- Did the change introduce hidden coupling?
- Did tab-specific logic stay inside the correct tab?
- Did shared helpers stay generic?
- Did contract rendering stay attached to the correct meaning layer?
- Did any temporary bridge logic need a follow-up note or removal?
- Would a new engineer understand the file structure without private context?
- Is the commit message specific enough to navigate by later?

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
