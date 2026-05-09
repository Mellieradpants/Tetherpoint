"""Verification layer: external verification-path routing.

No true/false decisions. No credibility scoring. No final judgment.
This is routing logic, not truth logic.
"""

from __future__ import annotations

import re
from typing import Optional

from app.schemas.models import RuleUnit, VerificationNodeResult, VerificationResult


_ASSERTION_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("legal_legislative", re.compile(
        r"\b(statute|legislation|law|enacted|codified|U\.?S\.?C\.?|United States Code|act of|public law|bill|section\s+\d+|is amended|federal office)\b",
        re.I,
    )),
    ("court_case_law", re.compile(
        r"\b(court|courtlistener|ruling|judicial decision|court opinion|case law|plaintiff|defendant|judge|verdict|appeal)\b",
        re.I,
    )),
    ("government_publication", re.compile(
        r"\b(federal register|executive order|proclamation|regulation|agency|department|bureau)\b", re.I)),
    ("scholarly_citation", re.compile(
        r"\b(DOI|doi\.org|citation|cited by|references|bibliography|journal citation|volume\s+\d+|issue\s+\d+|"
        r"pp\.?\s*\d+|et al\.|Crossref)\b",
        re.I,
    )),
    ("publication_disclosure", re.compile(
        r"\b(conflict of interest|competing interests?|funding statement|author contributions?|data availability statement|"
        r"ethics statement|institutional review board|IRB|informed consent|publisher'?s note|disclosure statement|"
        r"acknowledg(?:e)?ments?)\b",
        re.I,
    )),
    ("conceptual_theory", re.compile(
        r"\b(conceptual framework|theoretical framework|theory of|conceptual model|philosophical|epistemic|"
        r"phenomenolog(?:y|ical)|ontology|cognitive architecture|consciousness|qualia|intentionality|"
        r"embodied cognition|predictive processing)\b",
        re.I,
    )),
    ("scientific_biomedical", re.compile(
        r"\b(biomedical|neuroscience|clinical trial|randomized clinical trial|patient|patients|diagnosis|treatment|"
        r"therapy|therapeutic|disease|disorder|symptom|brain|neural|neuron|cortex|fMRI|EEG|"
        r"biomarker|genomic|pharmacological|medical intervention|evidence-based medicine)\b",
        re.I,
    )),
    ("statistical_public_data", re.compile(
        r"\b(Census|American Community Survey|ACS|Bureau of Labor Statistics|BLS|data\.gov|federal dataset|"
        r"government statistics?|public[- ]data portal|official statistics?|population estimate|demographic table|"
        r"statistical agency|national survey|administrative data)\b",
        re.I,
    )),
    ("research_methodology", re.compile(
        r"\b(methods?|methodology|materials and methods|participants?|sample size|cohort|randomi[sz]ed|"
        r"control group|regression|qualitative|quantitative|survey instrument|interviews?|protocol|pre-registered|"
        r"preregistration|replication|research dataset|study dataset|codebook|statistical analysis)\b",
        re.I,
    )),
    ("academic_research_literature", re.compile(
        r"\b(peer-reviewed|scholarly article|academic literature|literature review|systematic review|meta-analysis|"
        r"journal article|published in|abstract|authors?|research summary|research recommendation|may benefit from|"
        r"future research|findings suggest)\b",
        re.I,
    )),
    ("corporate_financial", re.compile(
        r"\b(SEC|filing|10-K|10-Q|annual report|quarterly|earnings|revenue|stock|shareholder)\b", re.I)),
    ("infrastructure_energy", re.compile(
        r"\b(FERC|NERC|grid|pipeline|utility|energy|power plant|transmission|generation)\b", re.I)),
    ("historical_archival", re.compile(
        r"\b(archive|historical|record|museum|manuscript|primary source|collection)\b", re.I)),
]

_RECORD_SYSTEMS: dict[str, list[str]] = {
    "legal_legislative": ["Congress.gov", "GovInfo", "Federal Register"],
    "court_case_law": ["CourtListener", "GovInfo"],
    "government_publication": ["Federal Register", "GovInfo"],
    "scholarly_citation": ["Crossref", "DOI Registry", "Publisher article page"],
    "publication_disclosure": ["Publisher article page", "Journal disclosure section", "DOI/Crossref"],
    "research_methodology": ["OSF", "Journal article methods section", "Publisher article page", "DOI/Crossref"],
    "conceptual_theory": ["JSTOR", "PhilPapers", "DOI/Crossref", "Publisher article page"],
    "academic_research_literature": ["DOI/Crossref", "Publisher article page", "JSTOR"],
    "scientific_biomedical": ["PubMed", "JSTOR"],
    "statistical_public_data": ["Census", "data.gov"],
    "corporate_financial": ["SEC EDGAR"],
    "infrastructure_energy": ["FERC", "NERC", "EIA"],
    "historical_archival": ["National Archives", "JSTOR"],
}


def _detect_assertion(text: str) -> tuple[bool, Optional[str]]:
    for atype, pattern in _ASSERTION_PATTERNS:
        if pattern.search(text):
            return True, atype
    return False, None


def _process_unit(unit: RuleUnit) -> VerificationNodeResult:
    if not unit.verification_eligible:
        return VerificationNodeResult(
            node_id=unit.rule_unit_id,
            rule_unit_id=unit.rule_unit_id,
            source_node_ids=unit.source_node_ids,
            assertion_detected=False,
            assertion_type=None,
            verification_path_available=False,
            expected_record_systems=[],
            verification_notes="Rule unit not eligible for verification routing",
        )

    detected, atype = _detect_assertion(unit.source_text_combined)

    if detected and atype:
        systems = _RECORD_SYSTEMS.get(atype, [])
        return VerificationNodeResult(
            node_id=unit.rule_unit_id,
            rule_unit_id=unit.rule_unit_id,
            source_node_ids=unit.source_node_ids,
            assertion_detected=True,
            assertion_type=atype,
            verification_path_available=len(systems) > 0,
            expected_record_systems=systems,
            verification_notes=(
                f"Assertion type '{atype}' detected for rule unit; "
                f"routed to {len(systems)} record system(s). "
                f"Supporting nodes: {', '.join(unit.source_node_ids)}"
            ),
        )

    return VerificationNodeResult(
        node_id=unit.rule_unit_id,
        rule_unit_id=unit.rule_unit_id,
        source_node_ids=unit.source_node_ids,
        assertion_detected=False,
        assertion_type=None,
        verification_path_available=False,
        expected_record_systems=[],
        verification_notes=None,
    )


def process_verification(
    rule_units: list[RuleUnit],
    run: bool = True,
) -> VerificationResult:
    """Route rule units to candidate verification record systems."""
    if not run:
        return VerificationResult(status="skipped")

    return VerificationResult(
        status="executed",
        node_results=[_process_unit(unit) for unit in rule_units],
    )
