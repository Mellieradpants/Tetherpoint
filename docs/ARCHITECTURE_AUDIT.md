# Architecture Audit

This audit maps the current Tetherpoint implementation to the target domain-neutral traceability architecture.

Current project frame:

```text
Tetherpoint is an interface-level traceability layer for source-dependent AI meaning.
Traceability before fluency.
```

The purpose of this audit is to identify which files already align, which files are transitional, and which files should be touched first when implementation work begins.

## Target architecture spine

Tetherpoint models source-dependent interpretation as a dependency graph:

```text
Source objects are nodes.
Dependency links are edges.
Anchors connect outputs to sources.
Resolution states describe what is complete, missing, partial, conflicted, or blocked.
Review handoffs preserve the human/domain boundary.
```

Core target primitives:

- Source Object
- Trace Unit
- Dependency Link
- Anchor
- Resolution State
- Meaning Boundary
- Review Handoff
- Domain Adapter

## Current implementation map

| File | Current role | Target architecture mapping | Status |
|---|---|---|---|
| `backend/app/schemas/models.py` | Pydantic schema source of truth | Defines current StructureNode, RuleUnit, referenced source packets, Governance Gate, Meaning, Verification, Governance, Output | Aligned but transitional |
| `backend/app/pipeline/runner.py` | Pipeline orchestrator | Executes the 10-layer order with Governance Gate before Verification and Meaning | Aligned |
| `backend/app/rule_units/handler.py` | Assembles selected nodes into Rule Units and attaches referenced-source packets | Current RuleUnit maps to target Trace Unit; referenced source packets map to Dependency Links | Strong, but public naming is transitional |
| `backend/app/governance/gate.py` | Pre-Meaning Governance Gate | Should become or feed Meaning Boundary / Resolution State logic | Needs generalization |
| `backend/app/verification/handler.py` | Routes Rule Units to likely record systems | Maps to Verification Route | Needs domain-adapter boundary later |
| `backend/app/meaning/handler.py` | Produces deterministic bounded plain meaning from Rule Unit brief | Maps to Bounded Meaning | Needs domain-neutral cleanup later |
| `backend/app/output/handler.py` | Assembles final summary | Maps to interface-ready assembly | Needs Governance Gate / Review Handoff visibility later |
| `backend/openapi.yaml` | Public API contract | Now reflects Governance Gate and 10-layer pipeline | Aligned but will need updates with schema changes |
| `src/components/WorkspaceConsole.tsx` | Current inspection UI console | Shows pipeline and unit-level inspection | Aligned at high level, but still too backend-console-like for final UX |
| `src/components/Workspace.tsx` | Additional current workspace UI/types | Contains current frontend response typing and older inspection patterns | Needs review before UI surgery |
| `src/components/ReceiptWorkspace.tsx` | User-facing result workspace with reference/extended meaning behavior | Contains useful reference dependency UI patterns | Candidate source for first interface pass |
| `docs/CODEX_BUILD_ANCHOR.md` | Agent alignment anchor | Prevents drift before Codex-assisted changes | Aligned |
| `ARCHITECTURE.md` | Architecture source of truth | Defines target domain-neutral model | Aligned |

## What is already strong

### Pipeline order

The current pipeline already enforces the most important sequencing rule:

```text
Input → Structure → Origin → Selection → Rule Units → Governance Gate → Verification → Meaning → Governance → Output
```

Governance Gate already runs before Meaning. This should not be removed.

### Rule Unit assembly

The current Rule Unit layer is the strongest existing bridge to the target architecture.

It already:

- groups selected source nodes into interpretation units
- preserves source node IDs
- carries source text
- carries conditions, exceptions, evidence requirements, consequences, definitions, timing, jurisdiction, and mechanisms
- detects referenced sources
- marks `requires_reference_resolution`
- stores referenced source packets with retrieval status, anchors, and limits

Target mapping:

```text
RuleUnit → Trace Unit
RuleUnitReferencedSource → Dependency Link / referenced source packet
```

Do not rename this yet. It is working infrastructure.

### Reference dependency packets

`RuleUnitReferencedSource` already contains the seed of the user-facing Reference Dependency Card:

- `name`
- `referenceType`
- `matchedText`
- `officialSourceUrl`
- `retrievalStatus`
- `sourceText`
- `anchors`
- `limits`

This should be used before creating new backend fields.

### Governance Gate placement

The Governance Gate is correctly positioned before Meaning.

Target mapping:

```text
GovernanceGateResult → Meaning Boundary / Resolution State / pre-Meaning limits
```

## What needs dialing in

### 1. Governance Gate is still too domain-shaped

Current `backend/app/governance/gate.py` contains domain-specific voter registration / citizenship / REAL ID logic.

This is not wrong as a test pack, but it should not remain the core default gate.

Future direction:

- extract the domain-neutral boundary behavior
- move domain-specific rules into adapter-style logic later
- preserve the role of the gate: expose limits before Meaning

Do not delete the current logic until replacement behavior and tests exist.

### 2. Meaning still contains domain-specific summary logic

Current `backend/app/meaning/handler.py` still includes voter-registration and citizenship-specific language patterns.

This should not drive the future domain-neutral Meaning layer.

Future direction:

- keep deterministic bounded Meaning
- make it consume generic Trace Unit / Dependency / Boundary data
- remove domain-shaped summary text once interface cards carry boundary state clearly

### 3. Verification routing is useful but broad and static

Current `backend/app/verification/handler.py` uses regex patterns and static record-system mappings.

This is acceptable for prototype routing, but future architecture should separate:

```text
Tetherpoint core = verification route structure
Domain adapter = domain-specific record systems and trigger logic
```

### 4. Output does not expose enough interface-ready state

Current `backend/app/output/handler.py` summarizes counts and statuses only.

Future direction:

- preserve presentation-only rule
- include or assemble interface-ready cards later
- expose Reference Dependency / Meaning Boundary / Review Handoff summaries without inventing new meaning

### 5. UI is still too console-shaped

`WorkspaceConsole.tsx` is useful for technical inspection, but the product direction needs a calmer user-facing interface.

Future direction:

- keep technical console as optional/developer view if useful
- create or adapt a user-facing card workspace
- prioritize Source → Dependency → Meaning Boundary → Review
- reduce pipeline clutter by default

## What to let go

- Rule Unit as the long-term public product term
- Governance Gate as final governance language
- any implication that Verification proves truth
- any UI that defaults to backend telemetry instead of user inspection
- any idea that Tetherpoint must own retrieval libraries
- any domain-specific wording as core product identity

## What to keep

- the 10-layer execution order for now
- Governance Gate before Meaning
- deterministic source structure
- Rule Units as current working implementation
- referenced source packets
- bounded Meaning
- Verification as route-only logic
- final Governance as support/action-safety check
- docs/contracts-first discipline before schema surgery

## First safe implementation target

Do not start with backend restructuring.

Start with a user-facing interface object using existing data:

```text
Reference Dependency Card
Meaning Boundary Card
Review Handoff Card
```

Use existing fields first:

- `rule_units.rule_units[*].source_text_combined`
- `rule_units.rule_units[*].referenced_sources`
- `rule_units.rule_units[*].requires_reference_resolution`
- `governance_gate.limits`
- `governance_gate.practical_questions`
- `verification.node_results`
- `meaning.summary_missing_information`

This gives the product the new direction without breaking the working backend.

## Recommended implementation order

1. Preserve current backend behavior.
2. Add user-facing card rendering from existing response data.
3. Validate that the interface can show source, dependency, boundary, and review without new retrieval.
4. Only after the UI shape is stable, generalize Governance Gate away from domain-specific logic.
5. Then generalize Meaning to consume the boundary model.
6. Then define retrieval/domain-adapter contracts.
7. Only then consider schema renaming or Trace Unit migration.

## Codex guardrails

Before Codex-assisted implementation:

- read `docs/CODEX_BUILD_ANCHOR.md`
- read `ARCHITECTURE.md`
- read this audit
- do not overfit to legislation, medicine, insurance, or any one domain
- do not rename `RuleUnit` yet
- do not build retrieval adapters yet
- do not change schema without updating backend, frontend, OpenAPI, tests, and docs in the same pass

## Current decision

The codebase is aligned enough to begin a small interface pass.

It is not ready for deep backend surgery yet.

The next build should be interface-first and use existing response fields to render the new source/dependency/meaning-boundary/review pattern.
