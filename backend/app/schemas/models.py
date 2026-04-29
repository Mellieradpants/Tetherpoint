"""Pydantic models for the Tetherpoint pipeline."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    xml = "xml"
    html = "html"
    json = "json"
    text = "text"


class AnalyzeOptions(BaseModel):
    run_meaning: bool = False
    run_origin: bool = True
    run_verification: bool = True


class AnalyzeRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=500_000)
    content_type: ContentType
    options: AnalyzeOptions = Field(default_factory=AnalyzeOptions)


class InputResult(BaseModel):
    raw_content: str
    content_type: str
    size: int
    parse_status: Literal["ok", "error"]
    parse_errors: list[str] = Field(default_factory=list)


class StructureNode(BaseModel):
    node_id: str
    section_id: str
    parent_id: Optional[str] = None
    role: Literal[
        "PRIMARY_RULE",
        "EVIDENCE",
        "CONDITION",
        "EXCEPTION",
        "CONSEQUENCE",
        "DEFINITION",
        "BOILERPLATE",
    ]
    depth: int = 0
    source_span_start: Optional[int] = None
    source_span_end: Optional[int] = None
    validation_status: Literal["valid", "repaired", "invalid"] = "valid"
    validation_errors: list[str] = Field(default_factory=list)
    source_anchor: str
    source_text: str
    normalized_text: str
    actor: Optional[str] = None
    action: Optional[str] = None
    condition: Optional[str] = None
    temporal: Optional[str] = None
    jurisdiction: Optional[str] = None
    mechanism: Optional[str] = None
    risk: Optional[dict[str, Optional[str]]] = None
    tags: list[str] = Field(default_factory=list)
    blocked_flags: list[str] = Field(default_factory=list)
    who: Optional[str] = None
    what: Optional[str] = None
    when: Optional[str] = None
    where: Optional[str] = None
    why: Optional[str] = None
    how: Optional[str] = None


class StructureValidationIssue(BaseModel):
    section_id: str
    issue_type: Literal[
        "missing_primary",
        "multiple_primary",
        "boilerplate_leak",
        "oversized_node",
        "unclassified_node",
        "unattached_child",
    ]
    message: str
    node_id: Optional[str] = None


class StructureValidationReport(BaseModel):
    status: Literal["clean", "repaired", "failed"]
    issues: list[StructureValidationIssue] = Field(default_factory=list)
    repaired_sections: list[str] = Field(default_factory=list)


class StructureResult(BaseModel):
    nodes: list[StructureNode]
    node_count: int
    section_count: int
    validation_report: StructureValidationReport


class SelectionResult(BaseModel):
    selected_nodes: list[StructureNode]
    excluded_nodes: list[StructureNode]
    selection_log: list[str]


class RuleUnitNodeRef(BaseModel):
    node_id: str
    text: str
    role: str


class RuleUnit(BaseModel):
    rule_unit_id: str
    section_id: str
    primary_node_id: Optional[str] = None
    primary_text: Optional[str] = None
    conditions: list[RuleUnitNodeRef] = Field(default_factory=list)
    exceptions: list[RuleUnitNodeRef] = Field(default_factory=list)
    evidence_requirements: list[RuleUnitNodeRef] = Field(default_factory=list)
    consequences: list[RuleUnitNodeRef] = Field(default_factory=list)
    definitions: list[RuleUnitNodeRef] = Field(default_factory=list)
    timing: list[RuleUnitNodeRef] = Field(default_factory=list)
    jurisdiction: list[RuleUnitNodeRef] = Field(default_factory=list)
    mechanisms: list[RuleUnitNodeRef] = Field(default_factory=list)
    source_node_ids: list[str] = Field(default_factory=list)
    fragment_node_ids: list[str] = Field(default_factory=list)
    source_text_combined: str
    assembly_status: Literal["complete", "needs_review", "blocked"]
    assembly_issues: list[str] = Field(default_factory=list)
    meaning_eligible: bool
    verification_eligible: bool
    review_status: Literal["ready", "needs_review", "blocked"]


class RuleUnitResult(BaseModel):
    rule_units: list[RuleUnit]
    unit_count: int
    ready_count: int
    needs_review_count: int
    assembly_log: list[str] = Field(default_factory=list)


class MeaningBrief(BaseModel):
    rule_unit_ids: list[str] = Field(default_factory=list)
    source_node_ids: list[str] = Field(default_factory=list)
    key_terms: list[str] = Field(default_factory=list)
    obligations: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)
    exceptions: list[str] = Field(default_factory=list)
    referenced_acts: list[str] = Field(default_factory=list)
    truncated: bool = False


class MeaningNodeResult(BaseModel):
    node_id: str
    source_text: str
    status: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None
    raw_response: Optional[str] = None
    plain_meaning: Optional[str] = None
    missing_information: list[str] = Field(default_factory=list)


class MeaningResult(BaseModel):
    status: Literal["executed", "fallback", "skipped", "error"]
    message: Optional[str] = None
    node_results: list[MeaningNodeResult] = Field(default_factory=list)
    overall_plain_meaning: Optional[str] = None
    summary_basis: Optional[str] = None
    summary_brief: Optional[MeaningBrief] = None
    summary_missing_information: list[str] = Field(default_factory=list)


class OriginSignal(BaseModel):
    signal: str
    value: str
    category: Optional[str] = None


class OriginResult(BaseModel):
    status: Literal["executed", "skipped"]
    origin_identity_signals: list[OriginSignal] = Field(default_factory=list)
    origin_metadata_signals: list[OriginSignal] = Field(default_factory=list)
    distribution_signals: list[OriginSignal] = Field(default_factory=list)
    evidence_trace: list[str] = Field(default_factory=list)


AssertionType = Literal[
    "legal_legislative",
    "court_case_law",
    "government_publication",
    "scientific_biomedical",
    "statistical_public_data",
    "corporate_financial",
    "infrastructure_energy",
    "historical_archival",
]


class VerificationNodeResult(BaseModel):
    node_id: str
    rule_unit_id: Optional[str] = None
    source_node_ids: list[str] = Field(default_factory=list)
    assertion_detected: bool
    assertion_type: Optional[AssertionType] = None
    verification_path_available: bool
    expected_record_systems: list[str] = Field(default_factory=list)
    verification_notes: Optional[str] = None


class VerificationResult(BaseModel):
    status: Literal["executed", "skipped"]
    node_results: list[VerificationNodeResult] = Field(default_factory=list)


GovernanceStatus = Literal[
    "match",
    "mismatch_detected",
    "contradiction_detected",
    "missing_required_source",
    "needs_review",
    "unsupported_downstream_action",
]


class GovernanceRecord(BaseModel):
    fieldName: str
    extractedValue: Optional[str] = None
    sourceAnchor: Optional[str] = None
    sourceSystem: Optional[str] = None
    documentType: Optional[str] = None


class GovernanceCheckResult(BaseModel):
    checkName: str
    status: GovernanceStatus
    issue: Optional[str] = None
    missingFields: list[str] = Field(default_factory=list)
    comparedField: Optional[str] = None
    firstValue: Optional[str] = None
    secondValue: Optional[str] = None
    requestedAction: Optional[str] = None
    blockingStatus: Optional[GovernanceStatus] = None


class GovernanceRecordResult(BaseModel):
    inputField: Optional[str] = None
    extractedValue: Optional[str] = None
    sourceAnchor: Optional[str] = None
    sourceSystem: Optional[str] = None
    documentType: Optional[str] = None
    overallStatus: GovernanceStatus
    checks: list[GovernanceCheckResult] = Field(default_factory=list)
    activeIssues: list[GovernanceCheckResult] = Field(default_factory=list)
    principle: str


class GovernanceResult(BaseModel):
    status: GovernanceStatus
    record_count: int
    issue_count: int
    results: list[GovernanceRecordResult] = Field(default_factory=list)
    activeIssues: list[GovernanceCheckResult] = Field(default_factory=list)
    principle: str


class OutputResult(BaseModel):
    summary: dict[str, Any]
    total_nodes: int
    selected_count: int
    excluded_count: int
    rule_unit_count: int = 0
    ready_rule_unit_count: int = 0
    needs_review_rule_unit_count: int = 0
    meaning_status: str
    origin_status: str
    verification_status: str
    governance_status: str = "match"
    governance_issue_count: int = 0


PipelineLayerName = Literal[
    "input",
    "structure",
    "origin",
    "selection",
    "rule_units",
    "verification",
    "meaning",
    "governance",
    "output",
]


class PipelineError(BaseModel):
    layer: PipelineLayerName
    error: str
    fatal: bool = False


class PipelineResponse(BaseModel):
    input: InputResult
    structure: StructureResult
    selection: SelectionResult
    rule_units: RuleUnitResult
    meaning: MeaningResult
    origin: OriginResult
    verification: VerificationResult
    governance: GovernanceResult
    output: OutputResult
    errors: list[PipelineError] = Field(default_factory=list)
