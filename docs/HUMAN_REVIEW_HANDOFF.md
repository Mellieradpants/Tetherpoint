# Human Review Handoff

Human review is an active escalation state, not a passive annotation.

This document defines when Tetherpoint must stop producing an interpretation-state output as if it were complete and instead expose a human-review handoff state.

## Purpose

Tetherpoint reports the state of an interpretation graph. It does not hide unresolved source dependencies, inference gaps, conflicts, missing evidence, or temporal ambiguity behind confident synthesis.

Human review exists to make unresolved graph states visible and actionable.

A handoff must tell the user:

- what blocked completion
- which source object or dependency caused the block
- what evidence is present
- what evidence is missing
- what inference would be required to proceed
- what specific human input or judgment is needed
- whether the affected output is blocked, degraded, or reviewable

## Core Rule

Human review is a system state.

It must be carried through the response contract and displayed as an explicit alert or escalation state.

It must not be reduced to:

- faint helper text
- a background note
- a vague warning
- a confidence disclaimer
- a hidden log entry
- a soft suggestion buried inside narrative output

## Governance Placement

Human review belongs to the domain-neutral governance core.

Domain adapters may define domain-specific thresholds, authorities, schemas, or review roles, but adapters must not rewrite the underlying escalation behavior.

## Handoff Types

### 1. Threshold Not Met

Use when the minimum evidence set has not been satisfied.

Required handoff payload:

- present evidence
- missing evidence
- source objects checked
- unresolved dependencies
- retrieval needed
- affected output IDs
- blocked or degraded status

### 2. Conflict Requiring Judgment

Use when two or more valid source objects provide contradictory anchors for the same output.

The system must not silently resolve the conflict.

Required handoff payload:

- conflicting source objects
- conflicting anchors
- conflict type
- affected output IDs
- domain authority needed, if known
- blocked status

### 3. Inference Chain Too Long

Use when the output would require inference beyond the allowed depth or beyond the available source anchors.

Required handoff payload:

- direct anchors available
- inference steps required
- point where the chain leaves direct sourcing
- affected output IDs
- review question
- blocked or degraded status

### 4. Version or Temporal Ambiguity

Use when the correct source version, time window, effective date, publication date, or temporal lock cannot be determined programmatically.

Required handoff payload:

- candidate versions or dates
- unresolved temporal dependency
- source objects involved
- affected output IDs
- disambiguation needed
- blocked or degraded status

### 5. Contextual Fact Requiring Human Input

Use when the system knows the exact missing fact but cannot retrieve or verify it from available source systems.

Required handoff payload:

- missing contextual fact
- why it is required
- source objects already checked
- affected output IDs
- specific question for the human reviewer
- blocked or degraded status

### 6. Scope Exceeded

Use when the requested interpretation is outside the authorized interpretation set for the current adapter, policy, or source boundary.

This is a hard boundary, not a soft warning.

Required handoff payload:

- requested output or interpretation
- authorized scope
- exceeded boundary
- affected output IDs
- blocked status

## Minimum Handoff Object

Every human-review handoff should be representable as a structured object.

The JSON below is a conceptual object sketch. The backend Pydantic and OpenAPI implementation uses snake_case field names, such as `handoff_id`, `handoff_type`, `affected_output_ids`, `source_objects`, `anchors_present`, `anchors_missing`, `human_question`, and `can_proceed`.

```json
{
  "handoffId": "string",
  "handoffType": "threshold_not_met | conflict_requiring_judgment | inference_chain_too_long | version_or_temporal_ambiguity | contextual_fact_required | scope_exceeded",
  "severity": "alert | blocked | degraded | review_required",
  "status": "active",
  "affectedOutputIds": [],
  "sourceObjects": [],
  "dependencies": [],
  "anchorsPresent": [],
  "anchorsMissing": [],
  "reason": "string",
  "humanQuestion": "string",
  "canProceed": false
}
```

## UI Behavior

The interface must display handoff states as visible escalation states.

Required UI behavior:

- show the handoff near the affected output
- use explicit status language
- expose the reason code
- show present evidence and missing evidence separately
- show whether the output is blocked or degraded
- preserve links back to source objects and anchors

The UI must not visually demote handoff states into low-priority helper text.

## Adapter Boundary

Adapters may supply:

- threshold definitions
- domain-specific review questions
- domain-specific source authorities
- domain-specific version rules
- domain-specific conflict authority
- domain-specific output formatting

Adapters must not change:

- conflict produces handoff
- absence is an evidence state, not permission
- inference is flagged differently than direct sourcing
- temporal ambiguity is not masked
- unresolved dependencies are not collapsed into answers

## Relationship to Source Metadata Contract

The human-review handoff depends on source metadata being standardized at the RAG edge.

A source metadata contract should expose:

- what source was used
- what was found
- what could not be verified
- what version or time window applies
- what dependencies remain open
- what anchors are available
- what anchors are missing or conflicting

The handoff layer uses that source-state information to decide whether an output can proceed, must be degraded, or must be blocked for review.

## Design Principle

Report the state of the graph, not the illusion of certainty.
