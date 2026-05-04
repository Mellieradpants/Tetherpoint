# Architecture

Tetherpoint is an interface-level traceability layer for source-dependent AI meaning.

It is designed for contexts where the valuable output is not just a fluent answer. The valuable output is an answer a person can inspect before relying on it.

Core rule:

```text
Traceability before fluency.
```

## Executable pipeline

The current backend executes a locked 10-layer pipeline:

1. Input
   Raw text or structured content enters the system. Supported content types are text, HTML, XML, and JSON. This layer validates well-formedness and preserves the original input.

2. Structure
   Deterministic parsing creates source-anchored nodes. This layer performs normalization, statement extraction, hierarchy assignment, explicit field extraction, constraint flags, and validation. It does not use AI.

3. Origin
   Source and provenance signals are extracted from the document where available. This includes metadata, canonical links, JSON-LD, Open Graph tags, Twitter card tags, explicit source fields, and referenced-source signals. Origin does not judge credibility.

4. Selection
   Nodes are selected or excluded using deterministic eligibility rules. Selection passes eligible nodes forward unchanged.

5. Rule Units
   Selected structure nodes are assembled into coherent interpretation units while preserving supporting source-node references. Rule Units also carry reference dependency packets when source text points outside itself.

6. Governance Gate
   The Governance Gate runs before Meaning. It exposes reference boundaries, source-dependency limits, non-blending constraints, and practical review questions. It does not decide truth, write meaning, or resolve references.

7. Verification
   Rule Units are routed to likely record systems. This layer identifies broad assertion types and returns candidate systems such as Congress.gov, Federal Register, CourtListener, PubMed, SEC EDGAR, FERC, NERC, EIA, JSTOR, and National Archives. Verification does not decide whether a claim is true.

8. Meaning
   Meaning produces document-level plain-language explanation from a bounded Rule Unit brief. The default path is deterministic. Any future AI-enabled Meaning path must stay bounded to the structured record and must not create anchors, change node roles, alter Rule Units, assign verification routes, cross unresolved reference boundaries, or change governance status.

9. Governance
   Governance checks anchored records for required source support, internal consistency, and downstream action safety. It does not decide truth, resolve conflicts, repair values, or overwrite values.

10. Output
   Final response assembly. Output presents upstream layer results and should not create new meaning.

## Core interface mechanism

Tetherpoint separates structure, provenance, rule-unit assembly, reference dependency, governance-gate limits, verification routing, meaning, and governance so each output can be traced back to explicit source text.

The interface should show:

- what source text was used
- what the meaning depends on
- where references point outside the local text
- whether referred sources were found, missing, partial, or not attempted
- what can be said from anchored local text only
- what is blocked until referred sources are anchored
- what still needs human or domain review

## Retrieval relationship

Tetherpoint is not a full retrieval backend and does not need to own every domain library.

Domain-specific retrieval systems can plug into the traceability contract. When a referred source is retrieved, Tetherpoint can show the source text and anchors. When the source is not retrieved or is incomplete, Tetherpoint should preserve that boundary and prevent fluent meaning from appearing complete.

## Non-goals

Tetherpoint is not a fact checker, legal advice tool, medical advice tool, credibility score, political recommendation system, truth-resolution system, full retrieval backend, complete domain library, or general chatbot.
