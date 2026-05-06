# Tetherpoint Overview

## Purpose

This document explains Tetherpoint at a human-readable architectural level.

It is intended for:

- engineers joining the project
- AI agents assisting with implementation
- reviewers evaluating the repository
- collaborators entering the system without prior context

This document explains:

- what Tetherpoint is
- what problem it solves
- what each layer does
- where boundaries exist
- how the frontend and backend relate
- what the system intentionally does not do

This is not a code walkthrough.

---

# What Tetherpoint Is

Tetherpoint is a source-dependent interpretation and verification architecture.

The system is designed to keep interpretation tethered to explicit source material instead of allowing free-floating generation.

Core principle:

```text
No source anchor → no interpretation.
```

Tetherpoint is not designed to behave like an unconstrained conversational assistant.

It is designed to:

- reveal structure
- preserve traceability
- expose uncertainty
- separate layers of meaning
- make verification paths inspectable
- expose when human review is required

The system treats interpretation as a constrained process with visible dependencies.

---

# The Problem Tetherpoint Solves

Most AI systems collapse:

- source retrieval
- interpretation
- verification
- confidence
- presentation

…into one opaque answer.

This creates several problems:

- source drift
- hidden assumptions
- unverifiable claims
- mixed authority levels
- overconfident outputs
- invisible uncertainty
- unclear provenance

Tetherpoint separates these concerns into explicit layers.

Instead of hiding uncertainty, the system exposes:

- what sources exist
- which sources are missing
- what dependencies remain unresolved
- what evidence paths are available
- when interpretation must stop
- when human review is required

---

# Core Architectural Principle

Tetherpoint treats interpretation as a dependency graph.

Nodes:

- source objects
- rule units
- assertions
- evidence routes
- review states

Edges:

- dependency relationships
- source references
- verification paths
- temporal/version requirements
- inclusion/exclusion conditions

The system’s job is not to invent answers.

The system’s job is to report the state of the graph.

---

# High-Level Layer Model

The architecture is intentionally layered.

Each layer has a bounded responsibility.

Layers should not silently absorb the responsibilities of other layers.

## 1. Input Layer

Purpose:

- receive source material
- normalize incoming content
- identify content type
- preserve original source text

Examples:

- legislation
- policy documents
- procedural forms
- contracts
- public records
- scientific material

Rules:

- preserve source fidelity
- no interpretation
- no summarization

---

## 2. Structure Layer

Purpose:

- parse structure from source material
- identify sections, nodes, fragments, hierarchy, references, and metadata

Examples:

- XML nodes
- section hierarchy
- document fragments
- references
- timestamps
- identifiers

Rules:

- deterministic only
- no semantic interpretation
- preserve document ordering and hierarchy

---

## 3. Origin Layer

Purpose:

- identify provenance and source state
- expose where information came from
- expose source identity and dependency state

Examples:

- referenced sources
- source metadata
- source role
- source system
- resolution state
- unresolved dependencies

Rules:

- source state is inspectable
- unresolved references remain visible
- no hidden provenance assumptions

Frontend ownership:

- Origin tab

---

## 4. Selection Layer

Purpose:

- identify relevant nodes/fragments for downstream processing
- build working sets

Rules:

- deterministic filtering
- no meaning generation
- preserve source references

---

## 5. Rule Unit Layer

Purpose:

- assemble interpretable source units
- preserve traceability to originating structure nodes

Examples:

- obligations
- conditions
- exceptions
- definitions
- timing requirements
- procedural steps

Rules:

- every unit must preserve source anchors
- no detached meaning generation

---

## 6. Governance Layer

Purpose:

- monitor interpretation boundaries
- expose unresolved conflicts
- expose review states
- block unsafe interpretation expansion

Examples:

- human review handoffs
- threshold failures
- scope exceeded
- unresolved conflicts
- missing anchors

Rules:

- governance state must remain visible
- blocked interpretation cannot silently continue
- unresolved states remain explicit

Frontend ownership:

- Governance tab

---

## 7. Verification Layer

Purpose:

- identify what evidence systems apply
- expose verification routes
- map assertions to authoritative record systems

Examples:

- Congress.gov
- RCW/WAC
- PubMed
- SEC EDGAR
- court records
- statistical datasets

Rules:

- verification paths are explicit
- evidence routes are inspectable
- verification is separated from meaning

Frontend ownership:

- Verification tab

---

## 8. Meaning Layer

Purpose:

- generate bounded plain-language interpretation
- preserve tethering to source material
- expose limits and constraints

Examples:

- plain-language explanations
- procedural meaning
- effect summaries
- bounded interpretation

Rules:

- meaning must remain source-dependent
- unsupported interpretation is blocked
- source limits remain visible
- interpretation cannot overwrite provenance or governance state

Frontend ownership:

- Meaning tab

---

# Human Review Model

Tetherpoint does not assume the system can resolve every ambiguity.

Human review is treated as a first-class architectural state.

Examples:

- threshold not met
- unresolved conflict
- temporal ambiguity
- contextual fact required
- inference chain too long
- scope exceeded

The system should expose:

- why review is needed
- what evidence is missing
- what dependency remains unresolved
- whether processing can safely continue

Human review is not considered failure.

It is part of the governance model.

---

# Frontend Philosophy

The frontend is not a cosmetic wrapper.

It is an inspection surface over the interpretation graph.

The interface should:

- reveal structure
- reduce cognitive load
- preserve boundaries
- keep layers separated
- expose uncertainty visibly
- avoid hidden state

Core rule:

```text
No junk drawers.
```

Each frontend file should have one primary responsibility.

Tabs are ownership boundaries, not visual categories.

Examples:

- Origin owns provenance
- Governance owns review state
- Verification owns evidence paths
- Meaning owns bounded interpretation

---

# AI-Agent Workflow Philosophy

AI agents are treated like collaborators entering an existing engineering system.

Agents should not wander the repository without structure.

Agents require:

- visible ownership boundaries
- clear active vs legacy surfaces
- explicit allowed/forbidden files
- scoped tasks
- plain-language commit history
- cleanup rules

The repo itself should provide orientation.

---

# What Tetherpoint Is Not

Tetherpoint is not:

- an unrestricted chatbot
- a persuasion engine
- a confidence simulator
- a hidden reasoning black box
- a fully autonomous decision-maker
- a system that silently fills missing information

The architecture intentionally prefers:

```text
visible uncertainty over fabricated certainty
```

---

# Current Frontend Cleanup Direction

Current cleanup priority:

1. reduce `ReceiptWorkspace.tsx` into a shell-only component
2. extract tab ownership into separate files
3. separate shared helpers from tab logic
4. make active vs alternate result surfaces visible
5. improve repo readability for engineers and agents

The goal is a frontend structure that mirrors the architectural principles of Tetherpoint itself.

---

# Recommended Reading Order For New Contributors

1. `README.md`
2. `docs/TETHERPOINT_OVERVIEW.md`
3. `docs/ASSISTANT_BUILD_ANCHOR.md`
4. `docs/FRONTEND_STRUCTURE_RULES.md`
5. `docs/FRONTEND_STRUCTURE_INVENTORY.md`
6. inspect active frontend files
7. inspect backend contracts and adapters

New contributors should understand the architecture before modifying implementation details.
