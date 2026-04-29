import { useMemo, useState, type ReactNode } from "react";

interface StructureNode {
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

interface RuleUnitNodeRef {
  node_id: string;
  text: string;
  role: string;
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

interface MeaningNodeResult {
  node_id: string;
  source_text: string;
  status: string | null;
  error?: string | null;
  message?: string | null;
  raw_response?: string | null;
  lenses?: unknown[];
  detected_scopes?: string[];
  plain_meaning?: string | null;
  scope_details?: unknown[];
  missing_information?: string[];
}

interface MeaningData {
  status: string;
  message: string | null;
  node_results: MeaningNodeResult[];
  overall_plain_meaning?: string | null;
  summary_missing_information?: string[];
}

interface VerificationNode {
  node_id: string;
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

interface OriginData {
  status: string;
  origin_identity_signals: OriginSignal[];
  origin_metadata_signals: OriginSignal[];
  distribution_signals: OriginSignal[];
  evidence_trace: unknown[];
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
  meaning: MeaningData;
  origin: OriginData;
  verification: { status: string; node_results: VerificationNode[] };
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
  };
  errors: Array<{ layer: string; error: string; fatal?: boolean }>;
}

type DetailTab = "meaning" | "verification" | "origin";

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-sm leading-relaxed text-foreground">
        {value || "Not specified"}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
        {title}
      </div>
      <div className="rounded-2xl border border-border/60 bg-surface p-4 md:rounded-xl md:p-3">
        {children}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-sm italic text-muted-foreground">{message}</div>;
}

function OriginSignalList({ signals }: { signals: OriginSignal[] }) {
  if (signals.length === 0) return <EmptyState message="No origin signals in this section." />;

  return (
    <div>
      {signals.map((signal, index) => (
        <FieldRow
          key={`${signal.signal}-${signal.value}-${index}`}
          label={signal.signal}
          value={signal.category ? `${signal.value} (${signal.category})` : signal.value}
        />
      ))}
    </div>
  );
}

function NodeRefList({ label, items }: { label: string; items: RuleUnitNodeRef[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
        {label}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={`${label}-${item.node_id}`}
            className="rounded border border-border/40 bg-background/40 p-2 text-sm leading-relaxed text-muted-foreground"
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function chunkSentences(sentences: string[], size: number): string[] {
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += size) {
    paragraphs.push(sentences.slice(index, index + size).join(" "));
  }
  return paragraphs;
}

function splitParagraphs(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function RuleUnitMeaning({ meaning }: { meaning: MeaningNodeResult | undefined }) {
  if (!meaning) return <EmptyState message="No plain meaning returned for this rule unit." />;

  if (meaning.status !== "executed") {
    return <EmptyState message={meaning.message || meaning.error || "Plain meaning unavailable for this rule unit."} />;
  }

  return meaning.plain_meaning ? (
    <div className="text-sm leading-relaxed text-foreground">{meaning.plain_meaning}</div>
  ) : (
    <EmptyState message="Plain meaning was not returned for this rule unit." />
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

  // Public Meaning view: prefer the backend's document-level synthesis.
  // Fall back to grouped rule-unit sentences only if the summary is missing, so the UI remains usable.
  const overallPlainMeaning = useMemo(() => {
    const backendSummary = splitParagraphs(data.meaning.overall_plain_meaning);
    if (backendSummary.length > 0) return backendSummary;

    const sentences = ruleUnits
      .map((unit) => meaningMap.get(unit.rule_unit_id)?.plain_meaning?.trim())
      .filter((value): value is string => Boolean(value));

    return chunkSentences(sentences, 4);
  }, [data.meaning.overall_plain_meaning, meaningMap, ruleUnits]);

  // Keep review/debug notes out of the main explanation. They are available only when expanded.
  const meaningIssues = useMemo(() => {
    const summaryMissing = data.meaning.summary_missing_information || [];
    const ruleUnitIssues = data.meaning.node_results
      .filter((result) => result.status !== "executed" || (result.missing_information && result.missing_information.length > 0))
      .map((result) => ({
        id: result.node_id,
        message: result.message || result.error || result.missing_information?.join(", ") || "Meaning needs review",
      }));

    return [
      ...summaryMissing.map((message) => ({ id: "summary", message })),
      ...ruleUnitIssues,
    ];
  }, [data.meaning.node_results, data.meaning.summary_missing_information]);

  // Verification stays at the rule-unit level so routing follows coherent legal units, not atomic fragments.
  const verificationSummary = useMemo(() => {
    const routes = new Map<string, { assertionTypes: Set<string>; unitIds: Set<string>; evidence: string[] }>();
    const assertionTypes = new Set<string>();
    let detectedCount = 0;
    let routedCount = 0;

    for (const result of data.verification.node_results) {
      if (result.assertion_detected) detectedCount += 1;
      if (result.assertion_type) assertionTypes.add(result.assertion_type);
      if (result.expected_record_systems.length > 0) routedCount += 1;

      for (const system of result.expected_record_systems) {
        if (!routes.has(system)) {
          routes.set(system, { assertionTypes: new Set<string>(), unitIds: new Set<string>(), evidence: [] });
        }

        const route = routes.get(system)!;
        route.unitIds.add(result.node_id);
        if (result.assertion_type) route.assertionTypes.add(result.assertion_type);

        const unitText = ruleUnitById.get(result.node_id)?.source_text_combined?.trim();
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 text-[11px] text-muted-foreground">
        <span><span className="font-medium text-foreground">{data.structure.node_count}</span> nodes</span>
        <span className="text-border">·</span>
        <span><span className="font-medium text-foreground">{data.structure.section_count}</span> sections</span>
        <span className="text-border">·</span>
        <span><span className="font-medium text-foreground">{data.selection.selected_nodes.length}</span> selected</span>
        <span className="text-border">·</span>
        <span><span className="font-medium text-foreground">{data.selection.excluded_nodes.length}</span> excluded</span>
        <span className="text-border">·</span>
        <span><span className="font-medium text-foreground">{ruleUnits.length}</span> rule units</span>
        <div className="hidden flex-1 md:block" />
        <span>Meaning: <span className="font-medium text-primary">{data.meaning.status}</span></span>
        <span>Origin: <span className="font-medium text-foreground">{data.origin.status}</span></span>
        <span>Verification: <span className="font-medium text-foreground">{data.verification.status}</span></span>
        <span>Validation: <span className="font-medium text-foreground">{data.structure.validation_report.status}</span></span>
      </div>

      {data.errors.length > 0 && (
        <div className="mx-4 mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <strong>Errors</strong>
          <ul className="mt-1 list-inside list-disc text-xs">
            {data.errors.map((error, index) => <li key={`${error.layer}-${index}`}>{error.layer}: {error.error}</li>)}
          </ul>
        </div>
      )}

      <div className="border-b border-border bg-surface/30 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {(["meaning", "verification", "origin"] as DetailTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-gold/30 bg-gold/10 text-foreground"
                  : "border-border/60 bg-background/20 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "meaning" && (
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-border/60 bg-surface px-4 py-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
                Overall Plain Meaning
              </div>
              {overallPlainMeaning.length > 0 ? (
                <div className="space-y-3 text-sm leading-relaxed text-foreground">
                  {overallPlainMeaning.map((paragraph, index) => (
                    <p key={`overall-meaning-${index}`}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <EmptyState message="No overall plain meaning is available yet." />
              )}
              {meaningIssues.length > 0 && (
                <details className="mt-4 rounded-xl border border-border/40 bg-background/30 p-3">
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Meaning notes
                  </summary>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {meaningIssues.map((issue, index) => (
                      <div key={`meaning-issue-${issue.id}-${index}`}>{issue.id}: {issue.message}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Traceability remains accessible without making atomic/rule-unit structure the default reading path. */}
            <details className="rounded-xl border border-border/60 bg-surface px-4 py-4">
              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Rule unit breakdown
              </summary>
              <div className="mt-4 space-y-3">
                {ruleUnits.length === 0 ? (
                  <EmptyState message="No rule units available for Meaning." />
                ) : (
                  ruleUnits.map((unit, index) => {
                    const unitMeaning = meaningMap.get(unit.rule_unit_id);

                    return (
                      <div key={unit.rule_unit_id} className="rounded-xl border border-border/50 bg-background/40 px-4 py-4">
                        <div className="flex items-start gap-4">
                          <span className="pt-1 text-base font-medium text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-semibold leading-snug text-foreground">
                              {unit.primary_text || unit.source_text_combined || "Rule unit needs review"}
                            </div>

                            <NodeRefList label="Conditions" items={unit.conditions} />
                            <NodeRefList label="Exceptions" items={unit.exceptions} />
                            <NodeRefList label="Evidence Requirements" items={unit.evidence_requirements} />
                            <NodeRefList label="Consequences" items={unit.consequences} />
                            <NodeRefList label="Definitions" items={unit.definitions} />

                            {unit.assembly_issues.length > 0 && (
                              <div className="mt-3 rounded border border-border/40 bg-surface p-2 text-sm text-muted-foreground">
                                Needs review: {unit.assembly_issues.join(", ")}
                              </div>
                            )}

                            <div className="mt-4 rounded-xl border border-border/60 bg-surface p-3">
                              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Plain Meaning</div>
                              <RuleUnitMeaning meaning={unitMeaning} />
                            </div>

                            <details className="mt-3 rounded-xl border border-border/40 bg-surface p-3">
                              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Rule unit details
                              </summary>
                              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                <div>rule unit: {unit.rule_unit_id}</div>
                                <div>section: {unit.section_id}</div>
                                <div>primary node: {unit.primary_node_id || "none"}</div>
                                <div>assembly: {unit.assembly_status}</div>
                                <div>review: {unit.review_status}</div>
                                <div>meaning eligible: {String(unit.meaning_eligible)}</div>
                                <div>verification eligible: {String(unit.verification_eligible)}</div>
                                <div>source nodes: {unit.source_node_ids.join(", ") || "none"}</div>
                                <div>fragments: {unit.fragment_node_ids.join(", ") || "none"}</div>
                              </div>
                            </details>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </details>
          </div>
        )}

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
                  {verificationSummary.routes.map((route) => (
                    <div key={route.system} className="rounded-xl border border-border/50 bg-background/40 p-3">
                      <div className="text-sm font-semibold text-foreground">{route.system}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Triggered by {route.unitIds.length} rule unit(s)
                        {route.assertionTypes.length > 0 ? ` · ${route.assertionTypes.join(", ")}` : ""}
                      </div>
                      {route.evidence.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {route.evidence.map((snippet) => (
                            <div key={`${route.system}-${snippet}`} className="rounded border border-border/40 bg-surface p-2 text-sm leading-relaxed text-muted-foreground">
                              {snippet}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No document-level record systems were detected for this input." />
              )}
            </Section>

            <Section title="Assertion Types">
              {verificationSummary.assertionTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {verificationSummary.assertionTypes.map((type) => (
                    <span key={type} className="rounded bg-secondary px-3 py-2 text-sm font-medium text-foreground">{type}</span>
                  ))}
                </div>
              ) : (
                <EmptyState message="No assertion types detected." />
              )}
            </Section>
          </div>
        )}

        {activeTab === "origin" && (
          <div className="space-y-5 px-5 py-6 pb-12">
            <div className="text-sm font-mono text-muted-foreground">document</div>
            <Section title="Origin Identity Signals"><OriginSignalList signals={data.origin.origin_identity_signals} /></Section>
            <Section title="Origin Metadata Signals"><OriginSignalList signals={data.origin.origin_metadata_signals} /></Section>
            <Section title="Distribution Signals"><OriginSignalList signals={data.origin.distribution_signals} /></Section>
            <Section title="Evidence Trace">
              {data.origin.evidence_trace.length > 0 ? (
                <pre className="overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(data.origin.evidence_trace, null, 2)}
                </pre>
              ) : (
                <EmptyState message="No evidence trace returned." />
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
