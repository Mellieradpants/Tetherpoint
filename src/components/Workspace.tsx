import { useMemo, useState, type ReactNode } from "react";

interface StructureNode {
  node_id: string;
  section_id: string;
  parent_id: string | null;
  role: "PRIMARY_RULE" | "EVIDENCE" | "CONDITION" | "EXCEPTION" | "CONSEQUENCE" | "DEFINITION" | "BOILERPLATE";
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

interface RuleUnitNodeRef {
  node_id: string;
  text: string;
  role: string;
}

interface RuleUnitReferencedSource {
  name: string;
  referenceType: string;
  matchedText: string;
  officialSourceUrl?: string | null;
  retrievalStatus?: "not_attempted" | "manual_required" | "retrieved" | "failed" | string;
  sourceText?: string | null;
  anchors?: string[];
  limits?: string[];
}

interface RuleUnit {
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

interface RuleUnitData {
  rule_units: RuleUnit[];
  unit_count: number;
  ready_count: number;
  needs_review_count: number;
  assembly_log: string[];
}

interface MeaningBrief {
  rule_unit_ids: string[];
  source_node_ids: string[];
  key_terms: string[];
  obligations: string[];
  conditions: string[];
  exceptions: string[];
  referenced_acts: string[];
  truncated: boolean;
}

interface MeaningNodeResult {
  node_id: string;
  source_text: string;
  status: string | null;
  error?: string | null;
  message?: string | null;
  raw_response?: string | null;
  plain_meaning?: string | null;
  missing_information?: string[];
}

interface MeaningData {
  status: string;
  message: string | null;
  node_results: MeaningNodeResult[];
  overall_plain_meaning?: string | null;
  summary_basis?: string | null;
  summary_brief?: MeaningBrief | null;
  summary_missing_information?: string[];
}

interface VerificationNode {
  node_id: string;
  rule_unit_id?: string | null;
  source_node_ids?: string[];
  assertion_detected: boolean;
  assertion_type: string | null;
  verification_path_available: boolean;
  expected_record_systems: string[];
  verification_notes: string | null;
}

interface OriginSignal {
  signal: string;
  value: string;
  category: string | null;
}

interface ReferencedSource {
  reference_id: string;
  name: string;
  reference_type: string;
  matched_text: string;
  source_system?: string | null;
  official_source_url?: string | null;
  why_it_matters?: string | null;
  status: string;
}

interface OriginData {
  status: string;
  origin_identity_signals: OriginSignal[];
  origin_metadata_signals: OriginSignal[];
  distribution_signals: OriginSignal[];
  referenced_sources?: ReferencedSource[];
  evidence_trace: unknown[];
}

interface GovernanceCheckResult {
  checkName: string;
  status: string;
  issue?: string | null;
  missingFields?: string[];
}

interface GovernanceData {
  status: string;
  record_count: number;
  issue_count: number;
  results: unknown[];
  activeIssues: GovernanceCheckResult[];
  principle: string;
}

interface GovernanceGateData {
  status?: "match" | "needs_review" | string;
  practical_questions?: string[];
  limits?: string[];
}

interface StructureValidationIssue {
  section_id: string;
  issue_type: string;
  message: string;
  node_id?: string | null;
}

interface VerificationRouteSummary {
  system: string;
  assertionTypes: string[];
  unitIds: string[];
  evidence: string[];
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
}

type DetailTab = "meaning" | "rule_units" | "verification" | "origin" | "governance" | "errors";

const ORIGIN_EMPTY_MESSAGE = "Pasted text has no verifiable source metadata. Use official HTML, XML, JSON, or source metadata to enable Origin signals.";

const ASSERTION_TYPE_LABELS: Record<string, string> = {
  legal_legislative: "Law / legislative records",
  court_case_law: "Court / case-law records",
  government_publication: "Government publication records",
  scientific_biomedical: "Scientific / biomedical records",
  statistical_public_data: "Public data / statistics records",
  corporate_financial: "Corporate / financial records",
  infrastructure_energy: "Energy / infrastructure records",
  historical_archival: "Historical / archival records",
};

const PIPELINE_LAYERS = [
  "Input",
  "Structure",
  "Origin",
  "Selection",
  "Rule Units",
  "Verification",
  "Meaning",
  "Governance",
  "Output",
];

function formatAssertionType(assertionType: string): string {
  return ASSERTION_TYPE_LABELS[assertionType] ?? assertionType.replaceAll("_", " ");
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return "Not specified";
  return status.replaceAll("_", " ");
}

function getStatusTone(status: string | null | undefined): string {
  const normalized = status?.toLowerCase() ?? "";
  if (["error", "blocked", "failed", "fatal"].some((token) => normalized.includes(token))) {
    return "border-destructive/50 bg-destructive/10 text-destructive";
  }
  if (["needs_review", "fallback", "repaired", "skipped"].some((token) => normalized.includes(token))) {
    return "border-gold/30 bg-gold/10 text-gold-muted";
  }
  if (["executed", "ok", "clean", "match", "ready", "complete"].some((token) => normalized.includes(token))) {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  return "border-border/60 bg-background/30 text-muted-foreground";
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm leading-relaxed text-foreground">{value || "Not specified"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">{title}</div>
      <div className="rounded-2xl border border-border/60 bg-surface p-4 md:rounded-xl md:p-3">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-sm italic text-muted-foreground">{message}</div>;
}

function StatusPill({ label, status }: { label: string; status: string | null | undefined }) {
  return (
    <div className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest ${getStatusTone(status)}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="mx-1 text-border">/</span>
      <span>{formatStatus(status)}</span>
    </div>
  );
}

function RhythmCard({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/35 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-xs font-semibold text-gold">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function CardTextBlock({ text, empty }: { text: string | null | undefined; empty: string }) {
  if (!text?.trim()) return <EmptyState message={empty} />;

  return (
    <div className="whitespace-pre-wrap rounded-xl border border-border/50 bg-background/45 p-3 text-sm leading-relaxed text-foreground">
      {text}
    </div>
  );
}

function CardChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyState message={empty} />;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

function CardList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyState message={empty} />;

  return (
    <ul className="space-y-2 text-sm leading-relaxed text-foreground">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
          {item}
        </li>
      ))}
    </ul>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
      {detail && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</div>}
    </div>
  );
}

function EngineTraceHeader({ data, routeCount }: { data: PipelineResponse; routeCount: number }) {
  const governanceStatus = data.governance?.status ?? data.output.governance_status ?? "not returned";
  const governanceIssues = data.governance?.issue_count ?? data.output.governance_issue_count ?? 0;
  const layerStatuses: Record<string, string> = {
    Input: data.input.parse_status,
    Structure: data.structure.validation_report.status,
    Origin: data.origin.status,
    Selection: `${data.selection.selected_nodes.length} selected`,
    "Rule Units": `${data.rule_units.ready_count} ready`,
    Verification: data.verification.status,
    Meaning: data.meaning.status,
    Governance: governanceStatus,
    Output: data.errors.length > 0 ? "review" : "assembled",
  };

  return (
    <div className="border-b border-border bg-surface/40 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gold-muted">Engine Trace Console</div>
          <div className="mt-1 text-xs text-muted-foreground">9-layer source-anchored pipeline execution</div>
        </div>
        <StatusPill label="governance" status={governanceStatus} />
      </div>

      <div className="grid gap-2 md:grid-cols-9">
        {PIPELINE_LAYERS.map((layer, index) => (
          <div key={layer} className="rounded-xl border border-border/50 bg-background/30 p-2">
            <div className="text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</div>
            <div className="mt-1 text-xs font-semibold text-foreground">{layer}</div>
            <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${getStatusTone(layerStatuses[layer])}`}>
              {formatStatus(layerStatuses[layer])}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Source nodes" value={data.structure.node_count} detail={`${data.structure.section_count} section(s)`} />
        <MetricCard label="Selected nodes" value={data.selection.selected_nodes.length} detail={`${data.selection.excluded_nodes.length} excluded`} />
        <MetricCard label="Rule Units" value={data.rule_units.unit_count} detail={`${data.rule_units.ready_count} ready · ${data.rule_units.needs_review_count} review`} />
        <MetricCard label="Verification routes" value={routeCount} detail={`${data.verification.node_results.length} checked`} />
        <MetricCard label="Governance issues" value={governanceIssues} detail={formatStatus(governanceStatus)} />
      </div>
    </div>
  );
}

function OriginSignalList({ signals }: { signals: OriginSignal[] }) {
  if (signals.length === 0) return <EmptyState message={ORIGIN_EMPTY_MESSAGE} />;

  return (
    <div>
      {signals.map((signal, index) => (
        <FieldRow
          key={`${signal.signal}-${signal.value}-${index}`}
          label={signal.signal}
          value={signal.value}
        />
      ))}
    </div>
  );
}

function ReferencedSourceList({ sources }: { sources: ReferencedSource[] }) {
  if (sources.length === 0) return <EmptyState message="No referenced legal sources detected." />;

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <div key={source.reference_id} className="rounded-xl border border-border/50 bg-background/40 p-3">
          <div className="text-sm font-semibold text-foreground">{source.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{source.reference_type}{source.source_system ? ` · ${source.source_system}` : ""}</div>
          {source.why_it_matters && <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{source.why_it_matters}</div>}
          {source.official_source_url ? (
            <a className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" href={source.official_source_url} target="_blank" rel="noreferrer">
              Open official source
            </a>
          ) : (
            <div className="mt-3 text-xs text-muted-foreground">Official source link not mapped yet.</div>
          )}
        </div>
      ))}
    </div>
  );
}

function GovernanceDetails({ governance }: { governance?: GovernanceData }) {
  if (!governance) return <EmptyState message="Governance results were not returned." />;

  const hasIssues = governance.issue_count > 0 || governance.activeIssues.length > 0;

  return (
    <div className="space-y-5 px-5 py-6 pb-12">
      <div className="text-sm font-mono text-muted-foreground">document</div>
      <Section title="Governance Summary">
        <FieldRow label="status" value={formatStatus(governance.status)} />
        <FieldRow label="checked" value={`${governance.record_count} record(s)`} />
        <FieldRow label="issues" value={`${governance.issue_count} issue(s)`} />
        <FieldRow label="result" value={hasIssues ? "Warning: one or more fields need review." : "Match: no fields need review under current governance checks."} />
      </Section>
      <Section title="Fields Needing Review">
        {hasIssues ? (
          <div className="space-y-3">
            {governance.activeIssues.map((issue, index) => (
              <div key={`${issue.checkName}-${index}`} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="text-sm font-semibold text-foreground">{issue.checkName}</div>
                <div className="mt-1 text-xs text-muted-foreground">Status: {formatStatus(issue.status)}</div>
                {issue.issue && <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{issue.issue}</div>}
                {issue.missingFields && issue.missingFields.length > 0 && (
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">Missing fields: {issue.missingFields.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No fields need review under current governance checks." />
        )}
      </Section>
      <Section title="Governance Principle">
        <div className="text-sm leading-relaxed text-muted-foreground">{governance.principle || "Governance checks source support and review conditions for extracted records."}</div>
      </Section>
    </div>
  );
}

function NodeRefList({ label, items }: { label: string; items: RuleUnitNodeRef[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">{label}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${label}-${item.node_id}`} className="rounded border border-border/40 bg-background/40 p-2 text-sm leading-relaxed text-muted-foreground">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{item.node_id} · {formatStatus(item.role)}</div>
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceAnchorList({ unit }: { unit: RuleUnit }) {
  const anchors = [...unit.source_node_ids, ...unit.fragment_node_ids.filter((id) => !unit.source_node_ids.includes(id))];

  if (anchors.length === 0 && !unit.source_text_combined) {
    return <EmptyState message="No source anchors returned for this rule unit." />;
  }

  return (
    <div className="space-y-3">
      {anchors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {anchors.map((anchor) => (
            <span key={anchor} className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              {anchor}
            </span>
          ))}
        </div>
      )}
      {unit.source_text_combined && (
        <div className="rounded-xl border border-border/50 bg-background/40 p-3 text-sm leading-relaxed text-foreground">
          {unit.source_text_combined}
        </div>
      )}
    </div>
  );
}

function splitParagraphs(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  return text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function RuleUnitMeaning({ meaning }: { meaning: MeaningNodeResult | undefined }) {
  if (!meaning) return <EmptyState message="No plain meaning returned for this rule unit." />;

  if (meaning.status === "skipped") {
    return <EmptyState message={meaning.message || meaning.error || "Plain meaning unavailable for this rule unit."} />;
  }

  return meaning.plain_meaning ? (
    <div className="text-sm leading-relaxed text-foreground">{meaning.plain_meaning}</div>
  ) : (
    <EmptyState message="Plain meaning was not returned for this rule unit." />
  );
}

function RuleUnitsDetails({ ruleUnits, meaningMap }: { ruleUnits: RuleUnit[]; meaningMap: Map<string, MeaningNodeResult> }) {
  return (
    <div className="space-y-4 p-4 pb-12">
      <div className="rounded-xl border border-border/60 bg-surface px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Rule Units</div>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Rule Units are the interpretation units assembled from selected source nodes. Meaning and Verification operate on these units, not loose text fragments.
        </div>
      </div>

      {ruleUnits.length === 0 ? <EmptyState message="No rule units were assembled for this input." /> : ruleUnits.map((unit, index) => {
        const unitMeaning = meaningMap.get(unit.rule_unit_id);
        return (
          <div key={unit.rule_unit_id} className="rounded-xl border border-border/50 bg-surface px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{String(index + 1).padStart(2, "0")} · {unit.rule_unit_id}</div>
                <div className="mt-2 text-base font-semibold leading-snug text-foreground">{unit.primary_text || unit.source_text_combined || "Rule unit needs review"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label="assembly" status={unit.assembly_status} />
                <StatusPill label="review" status={unit.review_status} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MetricCard label="Meaning eligible" value={unit.meaning_eligible ? "yes" : "no"} />
              <MetricCard label="Verification eligible" value={unit.verification_eligible ? "yes" : "no"} />
              <MetricCard label="Source nodes" value={unit.source_node_ids.length} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Section title="Source Anchors"><SourceAnchorList unit={unit} /></Section>
              <Section title="Plain Meaning"><RuleUnitMeaning meaning={unitMeaning} /></Section>
            </div>

            <NodeRefList label="Conditions" items={unit.conditions} />
            <NodeRefList label="Exceptions" items={unit.exceptions} />
            <NodeRefList label="Evidence Requirements" items={unit.evidence_requirements} />
            <NodeRefList label="Consequences" items={unit.consequences} />
            <NodeRefList label="Definitions" items={unit.definitions} />
            <NodeRefList label="Timing" items={unit.timing} />
            <NodeRefList label="Jurisdiction" items={unit.jurisdiction} />
            <NodeRefList label="Mechanisms" items={unit.mechanisms} />

            {unit.assembly_issues.length > 0 && (
              <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm text-gold-muted">
                Needs review: {unit.assembly_issues.join(", ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getSelectedRuleUnit(ruleUnits: RuleUnit[], selectedNodeId: string | null, selectedRuleUnitId: string | null) {
  if (selectedNodeId) {
    const linkedUnit = ruleUnits.find(
      (unit) =>
        unit.rule_unit_id === selectedNodeId ||
        unit.primary_node_id === selectedNodeId ||
        unit.source_node_ids.includes(selectedNodeId) ||
        unit.fragment_node_ids.includes(selectedNodeId)
    );
    if (linkedUnit) return linkedUnit;
  }

  if (selectedRuleUnitId) {
    const selectedUnit = ruleUnits.find((unit) => unit.rule_unit_id === selectedRuleUnitId);
    if (selectedUnit) return selectedUnit;
  }

  return ruleUnits[0] ?? null;
}

function getUnresolvedReferencedSources(unit: RuleUnit | null) {
  return (unit?.referenced_sources ?? []).filter(
    (source) => source.retrievalStatus !== "retrieved" || !source.sourceText?.trim()
  );
}

function hasRetrievedReferencedSource(unit: RuleUnit | null) {
  return (unit?.referenced_sources ?? []).some(
    (source) => source.retrievalStatus === "retrieved" && source.sourceText?.trim()
  );
}

function getRuleUnitVerification(data: PipelineResponse, unit: RuleUnit | null) {
  if (!unit) return null;

  return (
    data.verification.node_results.find(
      (result) =>
        result.rule_unit_id === unit.rule_unit_id ||
        result.node_id === unit.rule_unit_id ||
        unit.source_node_ids.includes(result.node_id)
    ) ?? null
  );
}

function SourceCard({ unit }: { unit: RuleUnit | null }) {
  return (
    <RhythmCard step="1" title="Source">
      {!unit ? (
        <EmptyState message="No rule unit is available for the current selection." />
      ) : (
        <div className="space-y-4">
          <CardTextBlock text={unit.source_text_combined} empty="No source_text_combined returned for this rule unit." />
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Source node IDs</div>
            <CardChipList items={unit.source_node_ids} empty="No source node IDs returned." />
          </div>
        </div>
      )}
    </RhythmCard>
  );
}

function ReferenceDependencyCard({ unit }: { unit: RuleUnit | null }) {
  const referencedSources = unit?.referenced_sources ?? [];
  const dependencyUnresolved = Boolean(unit?.requires_reference_resolution) && !hasRetrievedReferencedSource(unit);

  return (
    <RhythmCard step="2" title="Reference Dependency">
      {!unit ? (
        <EmptyState message="No rule unit is available for the current selection." />
      ) : (
        <div className="space-y-3">
          {dependencyUnresolved && (
            <div className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-medium text-gold-muted">
              Dependency unresolved
            </div>
          )}
          {referencedSources.length === 0 ? (
            <EmptyState message="No referenced_sources returned for this rule unit." />
          ) : (
            referencedSources.map((source, index) => (
              <div key={`${source.name}-${source.matchedText}-${index}`} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-foreground">{source.name || "Unnamed source"}</div>
                  <StatusPill label="retrieval" status={source.retrievalStatus || "not_attempted"} />
                </div>
                <FieldRow label="type" value={source.referenceType} />
                <FieldRow label="matched" value={source.matchedText} />
                <FieldRow label="anchors" value={source.anchors && source.anchors.length > 0 ? source.anchors.join(", ") : null} />
                <FieldRow label="limits" value={source.limits && source.limits.length > 0 ? source.limits.join("; ") : null} />
              </div>
            ))
          )}
        </div>
      )}
    </RhythmCard>
  );
}

function MeaningBoundaryCard({ data, unit }: { data: PipelineResponse; unit: RuleUnit | null }) {
  const unresolvedSources = getUnresolvedReferencedSources(unit);
  const blockedItems = [
    ...(data.governance_gate?.limits ?? []),
    ...(data.meaning.summary_missing_information ?? []),
    ...unresolvedSources.map((source) => `${source.name}: reference source unresolved`),
  ];

  return (
    <RhythmCard step="3" title="Meaning Boundary">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Allowed from local source text only</div>
          <CardTextBlock text={unit?.source_text_combined} empty="No local source text returned for this rule unit." />
        </div>
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Blocked or unresolved</div>
          <CardList items={blockedItems} empty="No governance limits, unresolved references, or missing information returned." />
        </div>
      </div>
    </RhythmCard>
  );
}

function ReviewHandoffCard({ data, unit }: { data: PipelineResponse; unit: RuleUnit | null }) {
  const unresolvedSources = getUnresolvedReferencedSources(unit);
  const verification = getRuleUnitVerification(data, unit);
  const verificationSteps = verification
    ? [
        verification.verification_path_available
          ? `Review verification route: ${verification.expected_record_systems.length > 0 ? verification.expected_record_systems.join(", ") : "no expected record systems returned"}`
          : "Review verification route: unavailable",
        verification.verification_notes ? `Review verification notes: ${verification.verification_notes}` : "",
      ].filter(Boolean)
    : [];
  const reviewSteps = [
    ...(data.governance_gate?.practical_questions ?? []),
    ...unresolvedSources.map((source) => `Resolve referenced source: ${source.name}`),
    ...(data.meaning.summary_missing_information ?? []).map((item) => `Review missing information: ${item}`),
    ...verificationSteps,
  ];

  return (
    <RhythmCard step="4" title="Review Handoff">
      <CardList items={reviewSteps} empty="No practical questions, unresolved references, verification routes, or missing information returned." />
    </RhythmCard>
  );
}

function SelectedUnitRhythm({ data, ruleUnits }: { data: PipelineResponse; ruleUnits: RuleUnit[] }) {
  const [selectedRuleUnitId, setSelectedRuleUnitId] = useState<string | null>(ruleUnits[0]?.rule_unit_id ?? null);
  const selectedUnit = getSelectedRuleUnit(ruleUnits, null, selectedRuleUnitId);

  return (
    <div className="rounded-xl border border-border/60 bg-surface px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Selected Unit View</div>
          <div className="mt-1 text-sm text-muted-foreground">Source &rarr; Dependency &rarr; Meaning Boundary &rarr; Review</div>
        </div>
        {selectedUnit && (
          <span className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
            {selectedUnit.rule_unit_id}
          </span>
        )}
      </div>

      {ruleUnits.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {ruleUnits.map((unit) => {
            const isActive = selectedUnit?.rule_unit_id === unit.rule_unit_id;
            return (
              <button
                key={unit.rule_unit_id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelectedRuleUnitId(unit.rule_unit_id)}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${isActive ? "border-gold/30 bg-gold/10 text-foreground" : "border-border/60 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground"}`}
              >
                {unit.rule_unit_id}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-3">
        <SourceCard unit={selectedUnit} />
        <ReferenceDependencyCard unit={selectedUnit} />
        <MeaningBoundaryCard data={data} unit={selectedUnit} />
        <ReviewHandoffCard data={data} unit={selectedUnit} />
      </div>
    </div>
  );
}

function ErrorsDetails({ errors }: { errors: PipelineResponse["errors"] }) {
  if (errors.length === 0) {
    return <div className="p-5"><EmptyState message="No pipeline errors were returned." /></div>;
  }

  return (
    <div className="space-y-3 p-5 pb-12">
      {errors.map((error, index) => (
        <div key={`${error.layer}-${index}`} className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="font-semibold uppercase tracking-widest">{error.layer}</div>
          <div className="mt-2 leading-relaxed">{error.error}</div>
          {error.fatal && <div className="mt-2 text-xs uppercase tracking-widest">fatal</div>}
        </div>
      ))}
    </div>
  );
}

export function Workspace({ data }: { data: PipelineResponse }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("meaning");

  const ruleUnits = data.rule_units?.rule_units ?? [];
  const meaningMap = useMemo(
    () => new Map(data.meaning.node_results.map((node) => [node.node_id, node])),
    [data.meaning.node_results]
  );
  const ruleUnitById = useMemo(
    () => new Map(ruleUnits.map((unit) => [unit.rule_unit_id, unit])),
    [ruleUnits]
  );

  const overallPlainMeaning = splitParagraphs(data.meaning.overall_plain_meaning);

  const meaningIssues = useMemo(() => {
    const summaryMissing = data.meaning.summary_missing_information || [];
    const ruleUnitIssues = data.meaning.node_results
      .filter((result) => result.status === "skipped" || (result.missing_information && result.missing_information.length > 0))
      .map((result) => ({
        id: result.node_id,
        message: result.message || result.error || result.missing_information?.join(", ") || "Meaning needs review",
      }));

    return [
      ...summaryMissing.map((message) => ({ id: "summary", message })),
      ...ruleUnitIssues,
    ];
  }, [data.meaning.node_results, data.meaning.summary_missing_information]);

  const verificationSummary = useMemo(() => {
    const routes = new Map<string, { assertionTypes: Set<string>; unitIds: Set<string>; evidence: string[] }>();
    const assertionTypes = new Set<string>();
    let detectedCount = 0;
    let routedCount = 0;

    for (const result of data.verification.node_results) {
      const unitId = result.rule_unit_id || result.node_id;
      if (result.assertion_detected) detectedCount += 1;
      if (result.assertion_type) assertionTypes.add(result.assertion_type);
      if (result.expected_record_systems.length > 0) routedCount += 1;

      for (const system of result.expected_record_systems) {
        if (!routes.has(system)) routes.set(system, { assertionTypes: new Set<string>(), unitIds: new Set<string>(), evidence: [] });
        const route = routes.get(system)!;
        route.unitIds.add(unitId);
        if (result.assertion_type) route.assertionTypes.add(result.assertion_type);
        const unitText = ruleUnitById.get(unitId)?.source_text_combined?.trim();
        if (unitText && route.evidence.length < 3 && !route.evidence.includes(unitText)) route.evidence.push(unitText);
      }
    }

    return {
      detectedCount,
      routedCount,
      total: data.verification.node_results.length,
      assertionTypes: Array.from(assertionTypes),
      routes: Array.from(routes.entries()).map(([system, route]): VerificationRouteSummary => ({
        system,
        assertionTypes: Array.from(route.assertionTypes),
        unitIds: Array.from(route.unitIds),
        evidence: route.evidence,
      })),
    };
  }, [data.verification.node_results, ruleUnitById]);

  return (
    <div className="flex h-full flex-col bg-background">
      <EngineTraceHeader data={data} routeCount={verificationSummary.routes.length} />

      {data.errors.length > 0 && (
        <div className="mx-4 mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Errors returned by pipeline. Open the Errors tab for details.
        </div>
      )}

      <div className="border-b border-border bg-surface/30 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {(["meaning", "rule_units", "verification", "origin", "governance", "errors"] as DetailTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab ? "border-gold/30 bg-gold/10 text-foreground" : "border-border/60 bg-background/20 text-muted-foreground hover:border-border hover:text-foreground"}`}
            >
              {tab.replace("_", " ")}
              {tab === "errors" && data.errors.length > 0 ? ` (${data.errors.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "meaning" && (
          <div className="space-y-4 p-4">
            <SelectedUnitRhythm data={data} ruleUnits={ruleUnits} />

            <div className="rounded-xl border border-border/60 bg-surface px-4 py-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Overall Plain Meaning</div>
              </div>
              {overallPlainMeaning.length > 0 ? (
                <div className="space-y-3 text-sm leading-relaxed text-foreground">
                  {overallPlainMeaning.map((paragraph, index) => <p key={`overall-meaning-${index}`}>{paragraph}</p>)}
                </div>
              ) : (
                <EmptyState message="No overall plain meaning is available yet." />
              )}
              {meaningIssues.length > 0 && (
                <details className="mt-4 rounded-xl border border-border/40 bg-background/30 p-3">
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Meaning notes</summary>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {meaningIssues.map((issue, index) => <div key={`meaning-issue-${issue.id}-${index}`}>{issue.id}: {issue.message}</div>)}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {activeTab === "rule_units" && <RuleUnitsDetails ruleUnits={ruleUnits} meaningMap={meaningMap} />}

        {activeTab === "verification" && (
          <div className="space-y-5 px-5 py-6 pb-12">
            <div className="text-sm font-mono text-muted-foreground">document</div>
            <Section title="Document Verification Summary">
              <FieldRow label="status" value={data.verification.status} />
              <FieldRow label="checked" value={`${verificationSummary.total} rule unit(s)`} />
              <FieldRow label="detected" value={`${verificationSummary.detectedCount} rule unit(s) with verification signals`} />
              <FieldRow label="routed" value={`${verificationSummary.routedCount} rule unit(s) routed to record systems`} />
            </Section>
            <Section title="Expected Record Systems">
              {verificationSummary.routes.length > 0 ? (
                <div className="space-y-3">
                  {verificationSummary.routes.map((route) => {
                    const assertionLabels = route.assertionTypes.map(formatAssertionType);
                    return (
                      <div key={route.system} className="rounded-xl border border-border/50 bg-background/40 p-3">
                        <div className="text-sm font-semibold text-foreground">{route.system}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Triggered by {route.unitIds.length} rule unit(s){assertionLabels.length > 0 ? ` · ${assertionLabels.join(", ")}` : ""}</div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState message="No document-level record systems were detected for this input." />}
            </Section>
          </div>
        )}

        {activeTab === "origin" && (
          <div className="space-y-5 px-5 py-6 pb-12">
            <div className="text-sm font-mono text-muted-foreground">document</div>
            <Section title="Referenced Sources"><ReferencedSourceList sources={data.origin.referenced_sources ?? []} /></Section>
            <Section title="Origin Identity Signals"><OriginSignalList signals={data.origin.origin_identity_signals} /></Section>
            <Section title="Origin Metadata Signals"><OriginSignalList signals={data.origin.origin_metadata_signals} /></Section>
            <Section title="Distribution Signals"><OriginSignalList signals={data.origin.distribution_signals} /></Section>
            <Section title="Evidence Trace">
              {data.origin.evidence_trace.length > 0 ? <pre className="overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{JSON.stringify(data.origin.evidence_trace, null, 2)}</pre> : <EmptyState message="No evidence trace returned." />}
            </Section>
          </div>
        )}

        {activeTab === "governance" && <GovernanceDetails governance={data.governance} />}

        {activeTab === "errors" && <ErrorsDetails errors={data.errors} />}
      </div>
    </div>
  );
}
