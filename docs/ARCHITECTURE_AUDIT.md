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
| `docs/ASSISTANT_BUILD_ANCHOR.md` | Assistant alignment anchor | Prevents drift before assistant-assisted changes | Aligned |
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

### First interface pass is live

Commit `7e7070c6a6fa41239cffd1a8c5285501b6427236` added the first frontend card rhythm in `src/components/Workspace.tsx`.

The deployed Vercel app confirms the first pass is live and the app still loads through the existing Vercel/Render path.

This pass added the user-facing rhythm:

```text
Source → Dependency → Meaning Boundary → Review
```

The pass stayed frontend-only and did not change backend, OpenAPI, schema, package, or lock files.

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

### 6. Needs Human Review needs stronger visual treatment

The Cornell LII / 52 U.S.C. 20503 test showed the system can separate detected legal references from source-supported meaning, but review warnings still blend into the interface too much.

Future UI pass:

- make `Needs Human Review` visually distinct
- use a stronger warning color treatment
- consider a subtle border, left stripe, badge, or card header emphasis
- keep warning language conservative and non-alarming
- do not imply final truth, proof, or completed verification

This should be a frontend-focused pass unless backend status fields are missing.

### 7. Reference status needs explicit modeling

The Cornell LII / 52 U.S.C. 20503 test produced the key rule:

```text
Detected reference does not equal imported meaning.
```

A detected reference may be useful for citation matching, source discovery, or role classification. It should not automatically become meaning-bearing.

Future reference statuses to model and expose:

- detected_only
- source_retrieved
- source_anchored
- meaning_bearing
- not_supported_by_source
- needs_human_review

Rule to preserve:

```text
Only retrieved, anchored, meaning-bearing source text may feed Extended Meaning without a review warning.
```

### 8. Source/data cards need source-role classification

The Hugging Face data/model card pattern is useful as a general interface pattern, not as a product to copy.

Tetherpoint source/data cards should make source role and authority class visible before meaning is relied on.

Future source card fields may include:

- source name
- source URL
- source role
- source authority class
- retrieval status
- anchor status
- meaning permission
- primary authority route
- review warning

Example distinction:

- Cornell LII = legal reference/access source useful for reading and citation matching
- official U.S. Code / govinfo / Congress source = stronger primary authority route
- news/commentary/unknown site = discovery or claim context only, not legal meaning authority

This is a reference-accuracy step before Meaning, not a new Meaning layer.

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
- the first frontend card rhythm as the base interface layer

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

Status: first frontend pass complete and deployed.

## Recommended implementation order

1. Preserve current backend behavior.
2. Add user-facing card rendering from existing response data. Completed in first pass.
3. Validate that the interface can show source, dependency, boundary, and review without new retrieval. Initial validation completed with Cornell LII / 52 U.S.C. 20503 test.
4. Strengthen Needs Human Review visual treatment.
5. Document and expose explicit reference statuses.
6. Only after the UI shape is stable, generalize Governance Gate away from domain-specific logic.
7. Then generalize Meaning to consume the boundary model.
8. Then define retrieval/domain-adapter contracts.
9. Only then consider schema renaming or Trace Unit migration.

## Assistant guardrails

Before assistant-assisted implementation:

- read `docs/ASSISTANT_BUILD_ANCHOR.md`
- read `ARCHITECTURE.md`
- read this audit
- do not overfit to legislation, medicine, insurance, or any one domain
- do not rename `RuleUnit` yet
- do not build retrieval adapters yet
- do not change schema without updating backend, frontend, OpenAPI, tests, and docs in the same pass
- remember GitHub is the source of truth; Vercel and Render are the deployment path
- do not treat the workspace as local-first
- do not install dependencies or change package files unless explicitly required

## Current decision

The codebase has completed the first small interface pass.

It is still not ready for deep backend surgery.

The next build should stay interface-first and focus on making unresolved review states more visible, especially `Needs Human Review`, while preserving the source/dependency/meaning-boundary/review pattern.
