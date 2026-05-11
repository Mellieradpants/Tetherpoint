import { VerificationTab } from "./receipt-workspace/VerificationTab";
import { safeArray, displayStatus, rawStatus } from "./receipt-workspace/shared";
import { OriginTab } from "./receipt-workspace/OriginTab"; 
import { GovernanceTab } from "./receipt-workspace/GovernanceTab";
import { MeaningTab } from "./receipt-workspace/MeaningTab";
import { useMemo, useState, type ReactNode } from "react";
import type { PipelineResponse } from "./Workspace";

export type { PipelineResponse } from "./Workspace";

type ResultTab = "meaning" | "origin" | "verification" | "governance" | "issues";
type Tone = "good" | "review" | "bad" | "neutral";

type GovernanceCheck = {
  checkName?: string;
  status?: string;
  issue?: string | null;
  missingFields?: string[];
};

type SupportSourceAnchor = {
  anchor_id?: string | null;
  source_type?: string | null;
  document_id?: string | null;
  page_number?: number | null;
  block_id?: string | null;
  char_start?: number | null;
  char_end?: number | null;
  source_path?: string | null;
};

type SupportDocumentStructure = {
  document_id?: string | null;
  nodes?: unknown[] | null;
};

type SupportSemanticStructure = {
  document_id?: string | null;
  signals?: unknown[] | null;
  signal_count?: number | null;
};

type SupportSelectionV2 = {
  document_id?: string | null;
  selected_signals?: unknown[] | null;
  excluded_signals?: unknown[] | null;
  selected_count?: number | null;
  excluded_count?: number | null;
};

type SupportRuleUnitCandidate = {
  candidate_id?: string | null;
  document_id?: string | null;
  structural_node_id?: string | null;
  source_anchor?: SupportSourceAnchor | null;
  source_text?: string | null;
  selected_signal_ids?: string[] | null;
  signal_types?: string[] | null;
  anchor_texts?: string[] | null;
  assembly_status?: string | null;
  assembly_notes?: string[] | null;
};

type SupportRuleUnitCandidates = {
  document_id?: string | null;
  candidates?: SupportRuleUnitCandidate[] | null;
  candidate_count?: number | null;
  assembly_log?: string[] | null;
};

type DocumentFirstV2Result = {
  status?: "executed" | "skipped" | "error" | string | null;
  document_structure?: SupportDocumentStructure | null;
  semantic_structure?: SupportSemanticStructure | null;
  selection_v2?: SupportSelectionV2 | null;
  rule_unit_candidates?: SupportRuleUnitCandidates | null;
  error?: string | null;
};

type PipelineResponseWithDocumentFirst = PipelineResponse & {
  document_first_v2?: DocumentFirstV2Result | null;
};

function hideAtomicReferences(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/\s*Supporting nodes?:\s*node-\d+(?:,\s*node-\d+)*\.?/gi, "")
    .replace(/node-\d+/gi, "source-backed result")
    .replace(/source_node_ids?/gi, "source backing")
    .trim();
}

function toneForStatus(status: string | null | undefined): Tone {
  const value = rawStatus(status);
  if (["blocked", "error", "failed", "fatal", "contradiction", "unsupported"].some((token) => value.includes(token))) return "bad";
  if (["needs_review", "review", "repaired", "missing", "skipped", "warning"].some((token) => value.includes(token))) return "review";
  if (["fallback", "ok", "clean", "match", "ready", "complete", "executed", "assembled", "available", "detected", "resolved"].some((token) => value.includes(token))) return "good";
  return "neutral";
}

function toneClass(tone: Tone): string {
  if (tone === "good") return "border-primary/30 bg-primary/10 text-primary";
  if (tone === "review") return "border-gold/40 bg-gold/10 text-gold-muted";
  if (tone === "bad") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border/60 bg-background/30 text-muted-foreground";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-surface p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">{title}</div>
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
      {label}: {displayStatus(status)}
    </span>
  );
}

function valueOrMissing(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not returned";
  return String(value);
}

function countFromSource(explicitCount: number | null | undefined, items: unknown[] | null | undefined): number {
  return typeof explicitCount === "number" ? explicitCount : safeArray(items).length;
}

function SupportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/35 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SupportDetail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="border-b border-border/40 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{valueOrMissing(value)}</div>
    </div>
  );
}

function SupportChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;

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

function SupportPathPanel({ data }: { data: PipelineResponse }) {
  const supportPath = (data as PipelineResponseWithDocumentFirst).document_first_v2;

  if (!supportPath) return null;

  if (supportPath.status === "skipped") {
    return (
      <Section title="Support Path">
        <EmptyState>Support Path not run for this input.</EmptyState>
      </Section>
    );
  }

  if (supportPath.status === "error") {
    return (
      <Section title="Support Path">
        <div className="space-y-3">
          <StatusPill label="document_first_v2" status={supportPath.status} />
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
            {supportPath.error || "Support Path returned an error without a message."}
          </div>
        </div>
      </Section>
    );
  }

  if (supportPath.status !== "executed") return null;

  const documentStructure = supportPath.document_structure;
  const semanticStructure = supportPath.semantic_structure;
  const selectionV2 = supportPath.selection_v2;
  const ruleUnitCandidates = supportPath.rule_unit_candidates;
  const candidates = safeArray(ruleUnitCandidates?.candidates);

  return (
    <Section title="Support Path">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusPill label="document_first_v2" status={supportPath.status} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SupportMetric label="Document nodes" value={safeArray(documentStructure?.nodes).length} />
          <SupportMetric label="Semantic signals" value={countFromSource(semanticStructure?.signal_count, semanticStructure?.signals)} />
          <SupportMetric label="Selected" value={countFromSource(selectionV2?.selected_count, selectionV2?.selected_signals)} />
          <SupportMetric label="Excluded" value={countFromSource(selectionV2?.excluded_count, selectionV2?.excluded_signals)} />
          <SupportMetric label="Candidates" value={countFromSource(ruleUnitCandidates?.candidate_count, candidates)} />
        </div>

        {candidates.length === 0 ? (
          <EmptyState>No rule-unit candidates returned.</EmptyState>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate, index) => {
              const sourceAnchor = candidate.source_anchor;
              const signalTypes = safeArray(candidate.signal_types);
              const anchorTexts = safeArray(candidate.anchor_texts);

              return (
                <div key={candidate.candidate_id || `candidate-${index}`} className="rounded-lg border border-border/50 bg-background/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Candidate ID</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{valueOrMissing(candidate.candidate_id)}</div>
                    </div>
                    <StatusPill label="assembly" status={candidate.assembly_status} />
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Signal types</div>
                      <SupportChipList items={signalTypes} empty="No signal types returned." />
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Anchor texts</div>
                      <SupportChipList items={anchorTexts} empty="No anchor texts returned." />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Source text</div>
                    {candidate.source_text ? (
                      <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm leading-6 text-foreground">
                        {candidate.source_text}
                      </div>
                    ) : (
                      <EmptyState>No source text returned.</EmptyState>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-border/50 bg-background/20 p-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Source anchor</div>
                    <SupportDetail label="document ID" value={sourceAnchor?.document_id} />
                    <SupportDetail label="page number" value={sourceAnchor?.page_number} />
                    <SupportDetail label="block ID" value={sourceAnchor?.block_id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}

function TabButton({ tab, active, onClick, issueCount = 0 }: { tab: ResultTab; active: boolean; onClick: () => void; issueCount?: number }) {
  const labels: Record<ResultTab, string> = {
    meaning: "Meaning",
    origin: "Origin",
    verification: "Verify",
    governance: "Govern",
    issues: "Issues",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 flex-1 rounded-full border px-2.5 py-2 text-center text-xs font-semibold leading-none transition-colors sm:flex-none sm:px-4 sm:text-sm ${active ? "border-gold/40 bg-gold/10 text-foreground" : "border-border/60 bg-background/20 text-muted-foreground hover:border-border hover:text-foreground"}`}
    >
      <span className="block truncate whitespace-nowrap">{labels[tab]}{tab === "issues" && issueCount > 0 ? ` ${issueCount}` : ""}</span>
    </button>
  );
}

function buildResultText(data: PipelineResponse) {
  const governanceStatus = data.governance?.status ?? data.output?.governance_status;
  const governanceIssues = data.governance?.issue_count ?? data.output?.governance_issue_count ?? 0;
  const plainMeaning = hideAtomicReferences(data.meaning?.overall_plain_meaning || data.meaning?.message || "No plain meaning returned.");
  const systems = new Set<string>();

  for (const result of safeArray(data.verification?.node_results)) {
    for (const system of safeArray(result.expected_record_systems)) systems.add(system);
  }

  return [
    "Tetherpoint Result",
    "",
    "Plain Meaning",
    plainMeaning,
    "",
    "Origin",
    `Status: ${displayStatus(data.origin?.status)}`,
    "",
    "Verification",
    systems.size > 0 ? `Record systems: ${Array.from(systems).join(", ")}` : "No verification record systems returned.",
    "",
    "Governance",
    `Status: ${displayStatus(governanceStatus)}`,
    `Issue count: ${governanceIssues}`,
  ].join("\n");
}

function exportText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ResultActions({ data }: { data: PipelineResponse }) {
  const [status, setStatus] = useState<string | null>(null);
  const resultText = buildResultText(data);

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setStatus("Result copied.");
    } catch {
      setStatus("Copy failed. Use export instead.");
    }
  };

  const exportResult = () => {
    exportText("tetherpoint-result.txt", resultText);
    setStatus("Result exported.");
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copyResult} className="rounded-md border border-border/60 bg-background/30 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40">
          Copy result
        </button>
        <button type="button" onClick={exportResult} className="rounded-md border border-border/60 bg-background/30 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40">
          Export result
        </button>
      </div>
      {status && <div className="text-xs text-muted-foreground">{status}</div>}
    </div>
  );
}
function IssuesTab({ data }: { data: PipelineResponse }) {
  const errors = safeArray(data.errors);
  const governanceIssues = safeArray(data.governance?.activeIssues as GovernanceCheck[] | undefined);

  return (
    <div className="space-y-4">
      <Section title="Pipeline Issues">
        {errors.length > 0 ? (
          <div className="space-y-3">
            {errors.map((error, index) => (
              <div key={`${error.layer}-${index}`} className={`rounded-lg border p-3 ${toneClass(error.fatal ? "bad" : "review")}`}>
                <div className="text-sm font-semibold text-foreground">{error.layer}</div>
                <div className="mt-1 text-xs uppercase tracking-widest">{error.fatal ? "Fatal" : "Needs review"}</div>
                <p className="mt-2 text-sm leading-6">{error.error}</p>
              </div>
            ))}
          </div>
        ) : <EmptyState>No pipeline issues were returned.</EmptyState>}
      </Section>

      <Section title="Governance Issues">
        {governanceIssues.length > 0 ? (
          <div className="space-y-3">
            {governanceIssues.map((issue, index) => (
              <div key={`${issue.checkName}-${index}`} className="rounded-lg border border-gold/40 bg-gold/10 p-3">
                <div className="text-sm font-semibold text-foreground">{issue.checkName || "Governance check"}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-gold-muted">{displayStatus(issue.status)}</div>
                {issue.issue && <p className="mt-2 text-sm leading-6 text-muted-foreground">{hideAtomicReferences(issue.issue)}</p>}
              </div>
            ))}
          </div>
        ) : <EmptyState>No governance issues were returned.</EmptyState>}
      </Section>
    </div>
  );
}

export function ReceiptWorkspace({ data }: { data: PipelineResponse }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("meaning");
  const issueCount = safeArray(data.errors).length + (data.governance?.issue_count ?? data.output?.governance_issue_count ?? 0);
  const tabs = useMemo<ResultTab[]>((() => issueCount > 0 ? ["meaning", "origin", "verification", "governance", "issues"] : ["meaning", "origin", "verification", "governance"]), [issueCount]);
  const hasFatalError = safeArray(data.errors).some((error) => error.fatal);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-12">
        <section className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Analysis result</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Source-backed review</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review the plain meaning first, then check the source origin, verification route, and governance status before relying on the result.</p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <StatusPill label="meaning" status={data.meaning?.status} />
                <StatusPill label="governance" status={data.governance?.status ?? data.output?.governance_status} />
              </div>
              <ResultActions data={data} />
            </div>
          </div>
        </section>

        {safeArray(data.errors).length > 0 && (
          <section className={`rounded-xl border p-4 text-sm leading-6 ${toneClass(hasFatalError ? "bad" : "review")}`}>
            The analysis returned {data.errors.length} pipeline issue(s). Open the Issues tab for details.
          </section>
        )}

        <SupportPathPanel data={data} />

        <nav className={`grid gap-2 rounded-xl border border-border/60 bg-surface/60 p-2 ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
          {tabs.map((tab) => <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} issueCount={issueCount} />)}
        </nav>

        {activeTab === "meaning" && <MeaningTab data={data} />}
        {activeTab === "origin" && <OriginTab data={data} />}
        {activeTab === "verification" && <VerificationTab data={data} />}
        {activeTab === "governance" && <GovernanceTab data={data} />}
        {activeTab === "issues" && <IssuesTab data={data} />}
      </div>
    </div>
  );
}
