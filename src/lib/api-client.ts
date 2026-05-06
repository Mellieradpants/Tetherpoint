/**
 * Frontend API client - analysis requests route through local server proxies
 * so the browser never handles secrets directly.
 */

interface AnalyzeRequest {
  content: string;
  content_type: string;
  language?: string;
  options: {
    run_meaning: boolean;
    run_origin: boolean;
    run_verification: boolean;
  };
}

interface TranslatePlainMeaningRequest {
  text: string;
  language: string;
}

export type SourceMetadataRole =
  | "authoritative_record"
  | "derivative_record"
  | "reference_record"
  | "temporal_record"
  | "contextual_record"
  | "unknown";

export type ResolutionState =
  | "not_attempted"
  | "found"
  | "partial"
  | "multiple_candidates"
  | "not_found"
  | "manual_required"
  | "failed"
  | "passage_not_found"
  | "version_unresolved"
  | "reference_chain_open"
  | "contextual_fact_missing"
  | "conflict_unresolved"
  | "threshold_not_met"
  | "scope_exceeded";

export interface SourceMetadataContract {
  source_id: string;
  source_name: string;
  source_role: SourceMetadataRole;
  source_system?: string | null;
  source_url?: string | null;
  adapter?: string | null;
  matched_text?: string | null;
  source_text?: string | null;
  resolution_state: ResolutionState;
  version_or_time_window?: string | null;
  dependencies_open: string[];
  anchors_available: string[];
  anchors_missing: string[];
  anchors_conflict: string[];
  review_state: "ready" | "needs_review" | "blocked";
  related_rule_unit_ids: string[];
  related_node_ids: string[];
  limits: string[];
}

export type HumanReviewHandoffType =
  | "threshold_not_met"
  | "conflict_requiring_judgment"
  | "inference_chain_too_long"
  | "version_or_temporal_ambiguity"
  | "contextual_fact_required"
  | "scope_exceeded";

export interface HumanReviewHandoff {
  handoff_id: string;
  handoff_type: HumanReviewHandoffType;
  severity: "alert" | "blocked" | "degraded" | "review_required";
  status: "active";
  affected_output_ids: string[];
  source_objects: string[];
  dependencies: string[];
  anchors_present: string[];
  anchors_missing: string[];
  reason: string;
  human_question: string;
  can_proceed: boolean;
}

export interface ResolveReferenceRequest {
  current_text: string;
  plain_meaning: string;
  referenced_sources: string[];
  referenced_source_text: string;
  source_anchors?: string[];
}

export type ReferenceEffectType =
  | "document_requirement"
  | "registration_framework"
  | "timing_deadline"
  | "agency_process"
  | "form_requirement"
  | "eligibility_condition"
  | "definition_imported"
  | "authority_modified"
  | "not_supported_by_text";

export interface ReferencedSourceMapping {
  sourceName: string;
  roleInCurrentRule: string;
  specificTextUsed: string;
  effectType: ReferenceEffectType;
  howItConnectsToCurrentRule: string;
  plainLanguageEffect: string;
}

export interface ResolveReferenceResponse {
  status: "resolved" | "needs_review";
  whoIsAffected: string;
  whatChanges: string;
  whenItApplies: string;
  whereInProcessItApplies: string;
  howProcessOrRequirementChanges: string;
  whyReferencedSourceMatters: string;
  affectedActorEffects: string[];
  referencedSourceMappings: ReferencedSourceMapping[];
  whatDoesNotFollowFromSuppliedText: string[];
  limits: string[];
}

async function readErrorMessage(response: Response, fallback: string) {
  const text = await response.text();
  let message = fallback;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === "string") {
      message = parsed.message;
    }
  } catch {
    if (text.trim()) {
      message = text;
    }
  }

  return { text, message };
}

export async function analyzeDocument(request: AnalyzeRequest) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: request.content,
      content_type: request.content_type,
      options: request.options,
    }),
  });

  if (!response.ok) {
    const { message } = await readErrorMessage(response, `Analysis failed (${response.status})`);
    throw new Error(message);
  }

  return JSON.parse(await response.text());
}

export async function translatePlainMeaning(request: TranslatePlainMeaningRequest) {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: request.text,
      language: request.language,
    }),
  });

  if (!response.ok) {
    const { message } = await readErrorMessage(response, `Translation failed (${response.status})`);
    throw new Error(message);
  }

  return JSON.parse(await response.text()) as {
    translated_text: string;
    language: string;
    source_stage?: "meaning";
  };
}

export async function resolveReference(request: ResolveReferenceRequest) {
  const response = await fetch("/api/resolve-reference", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const { message } = await readErrorMessage(response, `Extended meaning failed (${response.status})`);
    throw new Error(message);
  }

  return JSON.parse(await response.text()) as ResolveReferenceResponse;
}
