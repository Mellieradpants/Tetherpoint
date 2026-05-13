# Trust Evidence Workflow

This file defines how Tetherpoint changes are evaluated for internal trust evidence.

This is not external certification.

It does not claim SOC 2, ISO, legal compliance, security certification, audit approval, or outside validation.

It is a repo workflow for making each meaningful change show:

- what it depends on
- what it creates
- what it does not create
- what verified the boundary
- what remains missing, blocked, skipped, or review-needed

## Core rule

A feature is not complete just because it runs.

A meaningful change must leave evidence that the correct boundary was preserved.

Tetherpoint is a source-backed interpretation-state system. The repo workflow must follow the same rule as the product:

```text
Show what supports the output before relying on the output.
```

## What counts as a meaningful change

A change is meaningful when it affects any of these:

- source intake
- source structure
- anchors
- support status
- semantic signals
- selection
- rule units or rule-unit candidates
- verification routing
- governance state
- review state
- Meaning inputs or outputs
- API or response shape
- frontend display of support, status, review, or missing information
- documentation that describes current capability

Small copy edits or typo fixes may not need the full workflow, but they should still use plain-language commits.

## Stage 1: Define the support rule

Before building, state the boundary.

The change must say what it is allowed to create and what it is not allowed to create.

Use this shape:

```text
This change is allowed to create:
- [specific output or behavior]

This change is not allowed to create:
- [specific support object, layer output, runtime behavior, or capability]
```

Examples:

```text
Allowed to create: a frontend inspection panel for existing document_first_v2 support objects.
Not allowed to create: Meaning, Verification, Governance, PDF upload, OCR, or pipeline merge behavior.
```

```text
Allowed to create: an internal source-backed support object shape.
Not allowed to expose it through /analyze or mark it eligible for Meaning or Verification yet.
```

## Stage 2: Implement the smallest scoped change

Use only the files needed.

Do not widen the task while working.

Rules:

- no ad hoc patches
- no broad cleanup
- no side quests
- no unrelated refactors
- no vague naming
- no hidden bridge logic unless it is explicitly temporary and documented
- one scoped change per commit
- one plain-language commit message per scoped change

If a change touches a large mixed file, keep the edit bounded. If the file needs extraction, that is a separate scoped change.

## Stage 3: Test the promise

Tests or checks must prove the architecture rule, not only that the code runs.

A good test asks:

```text
Did the change preserve the boundary it promised to preserve?
```

Examples:

- If a support object is added, test that source text and anchors are preserved.
- If missing support exists, test that it becomes `needs_review`, `blocked`, skipped, or handed off.
- If Meaning is not supposed to run, test that it remains skipped or ineligible.
- If a frontend panel displays support data, verify the displayed data comes from existing upstream objects.
- If mobile behavior matters, verify the active mobile surface, not only desktop layout.

Running code is not enough. The check must match the trust boundary.

## Stage 4: Verify contract alignment

If backend or API shape changes, the change is not complete unless these are aligned in the same pass:

- backend models
- backend handlers or runner
- OpenAPI
- tests
- frontend API assumptions if the frontend reads the shape
- docs that describe the shape or capability

If frontend-only behavior changes, check:

- active UI assumptions
- frontend types if present
- mobile behavior when the change affects forms, navigation, panels, long text, or structured output
- skipped, missing, error, and executed states where relevant

No backend/API contract change is complete without OpenAPI and tests.

If OpenAPI cannot be updated or verified in the same pass, treat the change as incomplete.

## Stage 5: Record the evidence

Every meaningful change should leave a plain-language trail.

The trail should answer:

- what changed
- what did not change
- what command or check was run
- what passed
- what remains intentionally not implemented

This evidence can appear in the commit summary, PR notes, review notes, or build-thread update.

It should be specific enough that a future maintainer can understand the boundary without guessing the original intent.

## Required questions

Ask these questions for every meaningful change:

1. What source support does this depend on?
2. What layer owns this output?
3. What did this change add?
4. What did this change intentionally not add?
5. What tests or checks prove the boundary?
6. Did backend/API shape change?
7. If API shape changed, were models, OpenAPI, tests, and docs updated?
8. What remains missing, blocked, skipped, or review-needed?

If the answer is unknown, the change is not ready to be described as complete.

## Hard rules

No agent-created trust objects.

No Meaning creating structure, anchors, source state, verification, governance, support status, or review status.

No unsupported claim passes forward.

No backend/API contract change without OpenAPI and tests.

No feature is complete without evidence of what was verified.

Missing support must be flagged, blocked, skipped, or handed off.

A layer may read approved upstream source-backed objects, but may write only its own output.

No layer may erase, replace, fake, or silently rewrite support from an earlier layer.

## Layer ownership rule

Each layer owns only its own output.

A downstream layer may read approved upstream objects, but it must not create or repair upstream trust objects.

Examples:

- Meaning may explain from source-backed support objects. It must not create anchors.
- Verification may route supported assertions to record systems. It must not decide truth.
- Governance may check support and action-safety state. It must not repair missing source support.
- Frontend may display support status. It must not invent support status.

## Missing support rule

Missing support is an evidence state.

It is not a failure to hide.

It must appear as one of these states:

- skipped
- missing
- needs_review
- blocked
- handed off

Do not fill missing support with inference.

Do not present missing support as complete.

## Plain-language evidence format

Use this format for build summaries when useful:

```text
Changed:
- [file or behavior]

Did not change:
- [explicit non-change]

Verified:
- [command/check]
- [result]

Still not implemented:
- [intentional missing capability]
```

Example:

```text
Changed:
- Added Support Path panel for document_first_v2.

Did not change:
- No backend code.
- No OpenAPI.
- No Meaning, Verification, or Governance connection.

Verified:
- Vercel build passed.
- Mobile packet sample rendered executed support path.

Still not implemented:
- Raw PDF upload.
- OCR.
- Downstream Meaning from document-first candidates.
```

## Commit rule

Use plain-language commit messages.

Good:

- `Add trust evidence workflow`
- `Add document packet sample button`
- `Clarify document-first inspection mode`
- `Map v2 candidates to source support objects`

Avoid:

- `fix`
- `update`
- `changes`
- `cleanup`
- `misc`

Commit history is part of the trust evidence trail.

## What this workflow does not claim

This workflow does not claim external certification.

It does not prove legal compliance.

It does not prove security certification.

It does not replace code review, testing, domain review, or deployment review.

It is an internal repo discipline for keeping Tetherpoint changes inspectable, bounded, and supported by evidence.
