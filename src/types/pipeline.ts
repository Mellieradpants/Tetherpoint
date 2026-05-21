import type { HumanReviewHandoff, SourceMetadataContract } from "../lib/api-client";

export interface StructureNode {
  node_id: string;
  section_id: string;
  parent_id: string | null;
  role:
    | "PRIMARY_RULE"
    | "EVIDENCE"
    | "CONDITION"
    | "EXCEPTION"
    | "CONSEQUENCE"
    | "DEFINITION"
    | "BOILERPLATE";
  depth: number;
  source_span_start: number | null;
  source_span_end: number | null;
  validation_status: "valid" | "repaired" | "invalid";
  validation_errors: string[];
  source_anchor: string;
  source_text: string;
  normalized_text: string;
  actor: string | null;
  action: string | null;
  condition: string | null;
  temporal: string | null;
  jurisdiction: string | null;
  mechanism: string | null;
  risk: { likelihood?: string | null; impact?: string | null } | null;
  tags: string[];
  blocked_flags: string[];
  who: string | null;
  what: string | null;
  when: string | null;
  where: string | null;
  why: string | null;
  how: string | null;
}

export interface RuleUnitNodeRef {
  node_id: string;
  text: string;
  role: string;
}

export interface RuleUnitReferencedSource {
  name: string;
  referenceType: string;
  matchedText: string;
  officialSourceUrl?: string | null;
  retrievalStatus?: "not_attempted" | "manual_required" | "retrieved" | "failed" | string;
  sourceText?: string | null;
  anchors?: string[];
  limits?: string[];
}

export interface RuleUnit {
  rule_unit_id: string;
  section_id: string;
  primary_node_id: string | null;
  primary_text: string | null;
  conditions: RuleUnitNodeRef[];
  exceptions: RuleUnitNodeRef[];
  evidence_requirements: RuleUnitNodeRef[];
  consequences: RuleUnitNodeRef[];
  definitions: RuleUnitNodeRef[];
  timing: RuleUnitNodeRef[];
  jurisdiction: RuleUnitNodeRef[];
  mechanisms: RuleUnitNodeRef[];
  source_node_ids: string[];
  fragment_node_ids: string[];
  source_text_combined: string;
  requires_reference_resolution?: boolean;
  referenced_sources?: RuleUnitReferencedSource[];
  assembly_status: "complete" | "needs_review" | "blocked";
  assembly_issues: string[];
  meaning_eligible: boolean;
  verification_eligible: boolean;
  review_status: "ready" | "needs_review" | "blocked";
}

export interface RuleUnitData {
  rule_units: RuleUnit[];
  unit_count: number;
  ready_count: number;
  needs_review_count: number;
  assembly_log: string[];
}

export interface MeaningBrief {
  rule_unit_ids: string[];
  source_node_ids: string[];
  key_terms: string[];
  obligations: string[];
  conditions: string[];
  exceptions: string[];
  referenced_acts: string[];
  truncated: boolean;
}

export interface MeaningNodeResult {
  node_id: string;
  source_text: string;
  status: string | null;
  error?: string | null;
  message?: string | null;
  raw_response?: string | null;
  plain_meaning?: string | null;
  missing_information?: string[];
}

export interface MeaningData {
  status: string;
  message: string | null;
  node_results: MeaningNodeResult[];
  overall_plain_meaning?: string | null;
  summary_basis?: string | null;
  summary_brief?: MeaningBrief | null;
  summary_missing_information?: string[];
}

export interface VerificationNode {
  node_id: string;
  rule_unit_id?: string | null;
  source_node_ids?: string[];
  assertion_detected: boolean;
  assertion_type: string | null;
  verification_path_available: boolean;
  expected_record_systems: string[];
  verification_notes: string | null;
}

export interface OriginSignal {
  signal: string;
  value: string;
  category: string | null;
}

export interface ReferencedSource {
  reference_id: string;
  name: string;
  reference_type: string;
  matched_text: string;
  source_system?: string | null;
  official_source_url?: string | null;
  why_it_matters?: string | null;
  status: string;
}

export interface OriginData {
  status: string;
  origin_identity_signals: OriginSignal[];
  origin_metadata_signals: OriginSignal[];
  distribution_signals: OriginSignal[];
  referenced_sources?: ReferencedSource[];
  evidence_trace: unknown[];
}

export interface GovernanceCheckResult {
  checkName: string;
  status: string;
  issue?: string | null;
  missingFields?: string[];
}

export interface GovernanceData {
  status: string;
  record_count: number;
  issue_count: number;
  results: unknown[];
  activeIssues: GovernanceCheckResult[];
  principle: string;
}

export interface GovernanceGateData {
  status?: "match" | "needs_review" | string;
  practical_questions?: string[];
  limits?: string[];
}

export interface StructureValidationIssue {
  section_id: string;
  issue_type: string;
  message: string;
  node_id?: string | null;
}

export interface VerificationRouteSummary {
  system: string;
  assertionTypes: string[];
  unitIds: string[];
  evidence: string[];
}

export interface DocumentFirstSourceAnchor {
  anchor_id?: string | null;
  source_type?: string | null;
  document_id?: string | null;
  page_number?: number | null;
  block_id?: string | null;
  char_start?: number | null;
  char_end?: number | null;
  bbox?: number[] | null;
  source_path?: string | null;
}

export interface DocumentFirstStructureNode {
  document_id?: string | null;
  structural_node_id: string;
  parent_id?: string | null;
  page_number?: number | null;
  block_id?: string | null;
  block_type?: string | null;
  structural_type?: string | null;
  order?: number | null;
  depth?: number | null;
  source_text?: string | null;
  normalized_text?: string | null;
  source_anchor?: DocumentFirstSourceAnchor | null;
}

export interface DocumentFirstRuleUnitCandidate {
  candidate_id?: string | null;
  document_id?: string | null;
  structural_node_id?: string | null;
  source_anchor?: DocumentFirstSourceAnchor | null;
  source_text?: string | null;
  selected_signal_ids?: string[] | null;
  signal_types?: string[] | null;
  anchor_texts?: string[] | null;
  assembly_status?: string | null;
  assembly_notes?: string[] | null;
}

export interface DocumentFirstBlockMetadata {
  block_id?: string | null;
  page_number?: number | null;
  title?: string | null;
  source_name?: string | null;
  source_uri?: string | null;
  source_path?: string | null;
  extraction_warnings?: string[] | null;
}

export interface DocumentFirstDocumentMetadata {
  document_id?: string | null;
  title?: string | null;
  source_name?: string | null;
  source_uri?: string | null;
  source_hash?: string | null;
  extraction_warnings?: string[] | null;
  block_metadata?: DocumentFirstBlockMetadata[] | null;
}

export interface DocumentFirstV2Result {
  status?: "executed" | "skipped" | "error" | string | null;
  document_metadata?: DocumentFirstDocumentMetadata | null;
  document_structure?: {
    document_id?: string | null;
    nodes?: DocumentFirstStructureNode[] | null;
  } | null;
  semantic_structure?: {
    document_id?: string | null;
    signals?: unknown[] | null;
    signal_count?: number | null;
  } | null;
  selection_v2?: {
    document_id?: string | null;
    selected_signals?: unknown[] | null;
    excluded_signals?: unknown[] | null;
    selected_count?: number | null;
    excluded_count?: number | null;
  } | null;
  rule_unit_candidates?: {
    document_id?: string | null;
    candidates?: DocumentFirstRuleUnitCandidate[] | null;
    candidate_count?: number | null;
    assembly_log?: string[] | null;
  } | null;
  error?: string | null;
}

export interface PipelineResponse {
  input: {
    raw_content: string;
    content_type: string;
    size: number;
    parse_status: string;
    parse_errors: string[];
  };
  structure: {
    nodes: StructureNode[];
    node_count: number;
    section_count: number;
    validation_report: {
      status: "clean" | "repaired" | "failed";
      issues: StructureValidationIssue[];
      repaired_sections: string[];
    };
  };
  selection: {
    selected_nodes: StructureNode[];
    excluded_nodes: StructureNode[];
    selection_log: string[];
  };
  rule_units: RuleUnitData;
  governance_gate?: GovernanceGateData;
  meaning: MeaningData;
  origin: OriginData;
  verification: { status: string; node_results: VerificationNode[] };
  governance?: GovernanceData;
  output: {
    total_nodes: number;
    selected_count: number;
    excluded_count: number;
    rule_unit_count?: number;
    ready_rule_unit_count?: number;
    needs_review_rule_unit_count?: number;
    meaning_status: string;
    origin_status: string;
    verification_status: string;
    governance_status?: string;
    governance_issue_count?: number;
  };
  errors: Array<{ layer: string; error: string; fatal?: boolean }>;
  source_metadata?: SourceMetadataContract[];
  human_review_handoffs?: HumanReviewHandoff[];
  jurisdiction_context?: {
    user_selected_state: string | null;
    document_detected_state: string | null;
    jurisdiction_status: "matched" | "missing" | "unclear" | "conflict" | "needs_review";
  };
  document_first_v2?: DocumentFirstV2Result;
}
