import { useMemo, useState, type ReactNode } from "react";
import type { PipelineResponse } from "./Workspace";

export type { PipelineResponse } from "./Workspace";

type ResultTab = "meaning" | "origin" | "verification" | "governance";
type Tone = "good" | "review" | "bad" | "neutral";

type GovernanceCheck = {
  checkName?: string;
  status?: string;
  issue?: string | null;
  missingFields?: string[];
};

type GovernanceRecord = {
  extractedValue?: string;
  sourceSystem?: string;
  documentType?: string;
  overallStatus?: string;
  checks?: GovernanceCheck[];
  activeIssues?: GovernanceCheck[];
};

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function formatStatus(value: string | null | undefined): string {
  if (!value) return "Not returned";
  return value.replaceAll("_", " ");
}

function toneForStatus(status: string | null | undefined): Tone {
  const value = status?.toLowerCase() ?? "";
  if (["blocked", "error", "failed", "fatal", "contradiction"].some((token) => value.includes(token))) {
    return "bad";
  }
  if (["review", "fallback", "repaired", "missing", "skipped", "warning"].some((token) => value.includes(token))) {
    return "review";
  }
  if (["ok", "clean", "match", "ready", "complete", "executed", "assembled"].some((token) => value.includes(token))) {
    return "good";
  }
  return "neutral";
}

function toneClass(tone: Tone): string {
  if (tone === "good") return "border-primary/30 bg-primary/10 text-primary";
  if (tone === "review") return "border-gold/40 bg-gold/10 text-gold-muted";
  if (tone === "bad") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border/60 bg-background/30 text-muted-foreground";
}

function splitParagraphs(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-surface p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
        {title}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-sm italic leading-6 text-muted-foreground">{children}</div>;
}

function StatusPill({ label, status }: { label: string; status: string | null | undefined }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass(toneForStatus(status))}`}>
      {label}: {formatStatus(status)}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-border/50 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

function SourceQuote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm leading-6 text-foreground">
      {children}
    </div>
  );
}

function TabButton({ tab, active, onClick }: { tab: ResultTab; active: boolean; onClick: () => void }) {
  const labels: Record<ResultTab, string> = {
    meaning: "Plain Meaning",
    origin: "Origin",
    verification: "Verification",
    governance: "Governance",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-gold/40 bg-gold/10 text-foreground"
          : "border-border/60 bg-background/20 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {labels[tab]}
    </button>
  );
}

function ruleTextById(data: PipelineResponse): Map<string, string> {
  const map = new Map<string, string>();
  for (const unit of safeArray(data.rule_units?.rule_units)) {
    const text = unit.source_text_combined || unit.primary_text || "";
    if (text) map.set(unit.rule_unit_id, text);
  }
  return map;
}

function PlainMeaningTab({ data }: { data: PipelineResponse }) {
  const paragraphs = splitParagraphs(data.meaning?.overall_plain_meaning || data.meaning?.message);
  const sourceByRule = ruleTextById(data);

  return (
    <div className="space-y-4">
      <Section title="Plain Meaning">
        {paragraphs.length > 0 ? (
          <div className="space-y-3 text-base leading-7 text-foreground">
            {paragraphs.map((paragraph, index) => (
              <p key={`meaning-${index}`}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <EmptyState>No plain meaning was returned for this analysis.</EmptyState>
        )}
      </Section>

      <Section title="Backed By Source Text">
        {safeArray(data.meaning?.node_results).length > 0 ? (
          <div className="space-y-3">
            {safeArray(data.meaning.node_results).map((result, index) => {
              const sourceText = sourceByRule.get(result.node_id) || result.source_text;
              return (
                <div key={`meaning-source-${index}`} className="space-y-2">
                  <StatusPill label="meaning" status={result.status} />
                  {result.plain_meaning && <p className="text-sm leading-6 text-muted-foreground">{result.plain_meaning}</p>}
                  {sourceText && <SourceQuote>{sourceText}</SourceQuote>}
                  {(result.message || result.error) && (
                    <div className="text-sm leading-6 text-gold-muted">{result.message || result.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState>No source-backed meaning details were returned.</EmptyState>
        )}
      </Section>
    </div>
  );
}

function OriginTab({ data }: { data: PipelineResponse }) {
  const origin = data.origin;
  const referencedSources = safeArray(origin?.referenced_sources);
  const identitySignals = safeArray(origin?.origin_identity_signals);
  const metadataSignals = safeArray(origin?.origin_metadata_signals);
  const distributionSignals = safeArray(origin?.distribution_signals);
  const hasSignals = identitySignals.length + metadataSignals.length + distributionSignals.length > 0;

  return (
    <div className="space-y-4">
      <Section title="Origin Status">
        <div className="flex flex-wrap gap-2">
          <StatusPill label="origin" status={origin?.status} />
          <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {referencedSources.length} referenced source(s)
          </span>
        </div>
      </Section>

      <Section title="Referenced Sources">
        {referencedSources.length > 0 ? (
          <div className="space-y-3">
            {referencedSources.map((source, index) => (
              <div key={`${source.name}-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                <div className="text-sm font-semibold text-foreground">{source.name}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {source.reference_type} {source.source_system ? `from ${source.source_system}` : ""}
                </div>
                {source.matched_text && <SourceQuote>{source.matched_text}</SourceQuote>}
                {source.why_it_matters && <p className="mt-2 text-sm leading-6 text-muted-foreground">{source.why_it_matters}</p>}
                {source.official_source_url && (
                  <a className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" href={source.official_source_url} target="_blank" rel="noreferrer">
                    Open official source
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No referenced source was detected in this input.</EmptyState>
        )}
      </Section>

      <Section title="Source Signals">
        {hasSignals ? (
          <div className="space-y-3">
            {[...identitySignals, ...metadataSignals, ...distributionSignals].map((signal, index) => (
              <DetailRow key={`${signal.signal}-${index}`} label={signal.signal} value={signal.value} />
            ))}
          </div>
        ) : (
          <EmptyState>Pasted text has no source metadata. Use official HTML, XML, JSON, or source metadata when you need stronger origin signals.</EmptyState>
        )}
      </Section>
    </div>
  );
}

function VerificationTab({ data }: { data: PipelineResponse }) {
  const sourceByRule = ruleTextById(data);
  const results = safeArray(data.verification?.node_results);
  const routed = results.filter((result) => safeArray(result.expected_record_systems).length > 0);

  return (
    <div className="space-y-4">
      <Section title="Verification Summary">
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailRow label="status" value={formatStatus(data.verification?.status)} />
          <DetailRow label="checked" value={`${results.length} backed result(s)`} />
          <DetailRow label="routed" value={`${routed.length} backed result(s)`} />
        </div>
      </Section>

      <Section title="Verification Routes">
        {results.length > 0 ? (
          <div className="space-y-3">
            {results.map((result, index) => {
              const systems = safeArray(result.expected_record_systems);
              const sourceText = sourceByRule.get(result.rule_unit_id || result.node_id);
              return (
                <div key={`verification-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label="assertion" status={result.assertion_detected ? "detected" : "not detected"} />
                    <StatusPill label="path" status={result.verification_path_available ? "available" : "unavailable"} />
                  </div>
                  {result.assertion_type && (
                    <div className="mt-3 text-sm leading-6 text-muted-foreground">Assertion type: {formatStatus(result.assertion_type)}</div>
                  )}
                  {systems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {systems.map((system) => (
                        <span key={system} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {system}
                        </span>
                      ))}
                    </div>
                  )}
                  {result.verification_notes && <p className="mt-3 text-sm leading-6 text-muted-foreground">{result.verification_notes}</p>}
                  {sourceText && <div className="mt-3"><SourceQuote>{sourceText}</SourceQuote></div>}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState>No verification details were returned.</EmptyState>
        )}
      </Section>
    </div>
  );
}

function normalizeGovernanceRecords(data: PipelineResponse): GovernanceRecord[] {
  return safeArray(data.governance?.results as GovernanceRecord[] | undefined);
}

function GovernanceTab({ data }: { data: PipelineResponse }) {
  const governance = data.governance;
  const status = governance?.status ?? data.output?.governance_status;
  const issueCount = governance?.issue_count ?? data.output?.governance_issue_count ?? 0;
  const records = normalizeGovernanceRecords(data);
  const activeIssues = safeArray(governance?.activeIssues as GovernanceCheck[] | undefined);

  return (
    <div className="space-y-4">
      <Section title="Governance Summary">
        <div className="flex flex-wrap gap-2">
          <StatusPill label="governance" status={status} />
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass(issueCount > 0 ? "review" : "good")}`}>
            {issueCount} issue(s)
          </span>
          <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {governance?.record_count ?? records.length} checked
          </span>
        </div>
        {governance?.principle && <p className="mt-4 text-sm leading-6 text-muted-foreground">{governance.principle}</p>}
      </Section>

      <Section title="Review Items">
        {activeIssues.length > 0 ? (
          <div className="space-y-3">
            {activeIssues.map((issue, index) => (
              <div key={`${issue.checkName}-${index}`} className="rounded-lg border border-gold/40 bg-gold/10 p-3">
                <div className="text-sm font-semibold text-foreground">{issue.checkName || "Governance check"}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-gold-muted">{formatStatus(issue.status)}</div>
                {issue.issue && <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.issue}</p>}
                {safeArray(issue.missingFields).length > 0 && (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Missing: {safeArray(issue.missingFields).join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No governance review items were returned.</EmptyState>
        )}
      </Section>

      <Section title="Backed Governance Results">
        {records.length > 0 ? (
          <div className="space-y-3">
            {records.map((record, index) => {
              const issues = safeArray(record.activeIssues);
              return (
                <div key={`governance-record-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label="result" status={record.overallStatus} />
                    {record.sourceSystem && (
                      <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                        {formatStatus(record.sourceSystem)}
                      </span>
                    )}
                  </div>
                  {record.extractedValue && <div className="mt-3"><SourceQuote>{record.extractedValue}</SourceQuote></div>}
                  {issues.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {issues.map((issue, issueIndex) => (
                        <div key={`${issue.checkName}-${issueIndex}`} className="text-sm leading-6 text-gold-muted">
                          {issue.checkName || "Check"}: {issue.issue || formatStatus(issue.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState>No governance records were returned.</EmptyState>
        )}
      </Section>
    </div>
  );
}

export function ReceiptWorkspace({ data }: { data: PipelineResponse }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("meaning");
  const tabs = useMemo<ResultTab[]>(() => ["meaning", "origin", "verification", "governance"], []);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-12">
        <section className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
                Analysis result
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Source-backed review</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Review the plain meaning first, then check the source origin, verification route, and governance status before relying on the result.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill label="meaning" status={data.meaning?.status} />
              <StatusPill label="governance" status={data.governance?.status ?? data.output?.governance_status} />
            </div>
          </div>
        </section>

        {safeArray(data.errors).length > 0 && (
          <section className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            The analysis returned {data.errors.length} pipeline error(s). Review the visible tabs before relying on the result.
          </section>
        )}

        <nav className="flex gap-2 overflow-x-auto rounded-xl border border-border/60 bg-surface/60 p-2">
          {tabs.map((tab) => (
            <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
          ))}
        </nav>

        {activeTab === "meaning" && <PlainMeaningTab data={data} />}
        {activeTab === "origin" && <OriginTab data={data} />}
        {activeTab === "verification" && <VerificationTab data={data} />}
        {activeTab === "governance" && <GovernanceTab data={data} />}
      </div>
    </div>
  );
}
