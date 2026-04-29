### Architecture

Tetherpoint is a source-anchored parsing and traceability system.

The current backend executes a locked 9-layer pipeline:

1. Input
   Raw text or structured content enters the system. Supported content types are text, HTML, XML, and JSON. This layer validates well-formedness and preserves the original input.

2. Structure
   Deterministic parsing creates source-anchored nodes. This layer performs normalization, statement extraction, hierarchy assignment, explicit field extraction, constraint flags, and validation. It does not use AI.

3. Origin
   Source and provenance signals are extracted from the document where available. This includes metadata, canonical links, JSON-LD, Open Graph tags, Twitter card tags, and explicit source fields. Origin does not judge credibility.

4. Selection
   Nodes are selected or excluded using deterministic eligibility rules. Selection passes eligible nodes forward unchanged.

5. Rule Units
   Selected structure nodes are assembled into coherent interpretation units while preserving supporting source-node references.

6. Verification
   Rule Units are routed to likely record systems. This layer identifies broad assertion types and returns candidate systems such as Congress.gov, Federal Register, CourtListener, PubMed, SEC EDGAR, FERC, NERC, EIA, JSTOR, and National Archives. Verification does not decide whether a claim is true.

7. Meaning
   Meaning produces document-level plain-language explanation from a bounded Rule Unit brief. The default path is deterministic. Any future AI-enabled Meaning path must stay bounded to the structured record and must not create anchors, change node roles, alter Rule Units, assign verification routes, or change governance status.

8. Governance
   Governance checks anchored records for required source support, internal consistency, and downstream action safety. It does not decide truth, resolve conflicts, repair values, or overwrite values.

9. Output
   Final response assembly. Output presents upstream layer results and should not create new meaning.

### Core rule

Tetherpoint separates structure, provenance, rule-unit assembly, verification routing, meaning, and governance so each output can be traced back to explicit source text.

### Non-goals

Tetherpoint is not a fact checker, legal advice tool, credibility score, political recommendation system, truth-resolution system, or general chatbot.
