# Research Summary Evaluation Note

This note records a future evaluation case for academic/research summary and scholarly article text. It is an evaluation checkpoint only. It does not implement taxonomy changes, retrieval, evidence resolution, or pipeline behavior changes.

## Evaluation Case

Input type: academic/research summary or scholarly article text.

Observed issue: Meaning classified research recommendation language as legal requirements.

Observed issue: Origin emitted noisy or malformed author-like signals.

Observed issue: Verification over-routed research-method and disclosure statements to `statistical_public_data`, Census, and data.gov.

Observed issue: Governance marked many source-backed records as match, but upstream classification did not distinguish rule records from research statements, citations, disclosures, questions, and publisher disclaimers.

## Expected Future Behavior

Research recommendation language should not be labeled legal requirement language.

The phrase "may benefit from" should route as recommendation or research framing, not legal permission or obligation.

Academic/research content should support lanes such as:

- `academic_research_literature`
- `research_methodology`
- `publication_disclosure`
- `scholarly_citation`
- `conceptual_theory`

Census and data.gov should only be used when the text contains actual public-data or government statistical-data signals.

Governance should continue to expose support state, but should not compensate for poor upstream document-type classification.

## Architecture Boundary

This note documents an evaluation gap only. The taxonomy change should be designed separately before implementation. Do not infer that automatic retrieval, RAG/vector search, or evidence resolution exists for this case.
