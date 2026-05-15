import { HumanReviewSummary } from "../ContractStateSections";
import type { PipelineResponse } from "../../types/pipeline";
import {
  safeArray,
  displayStatus,
  Section,
  StatusPill,
  EmptyState,
  SourceQuote,
  hideAtomicReferences,
  hasUnresolvedReferencedSources,
  toneClass,
} from "./shared";

type GovernanceCheck = {
  checkName?: string;
  status?: string;
  issue?: string | null;
  missingFields?: string[];
};

type GovernanceRecord = {
  inputField?: string | null;
  extractedValue?: string | null;
  sourceAnchor?: string | null;
  sourceSystem?: string | null;
  documentType?: string | null;
  overallStatus?: string | null;
  activeIssues?: GovernanceCheck[];
};

function normalizeGovernanceRecords(data: PipelineResponse): GovernanceRecord[] {
  return safeArray(data.governance?.results as GovernanceRecord[] | undefined);
}

export function GovernanceTab({ data }: { data: PipelineResponse }) {
  const governance = data.governance;
  const status = governance?.status ?? data.output?.governance_status;
  const issueCount = governance?.issue_count ?? data.output?.governance_issue_count ?? 0;
  const records = normalizeGovernanceRecords(data);
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const atomicReferenceLabel = hasUnresolvedReferences ? "source reference" : "source-backed result";
  const displayStatusValue = hasUnresolvedReferences ? "review_required" : status;
  const recordsChecked = hasUnresolvedReferences ? 0 : governance?.record_count ?? records.length;
  const displayRecords = hasUnresolvedReferences ? [] : records;
  const activeIssues = safeArray(governance?.activeIssues as GovernanceCheck[] | undefined);
  const humanReviewHandoffs = safeArray(data.human_review_handoffs);

  return (
    <div className="space-y-4">
      <Section title="Governance Summary">
        <div className="flex flex-wrap gap-2">
          <StatusPill label="governance" status={displayStatusValue} />
          {hasUnresolvedReferences && (
            <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass("review")}`}>unresolved dependencies</span>
          )}
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass(issueCount > 0 || hasUnresolvedReferences ? "review" : "good")}`}>{issueCount} issue(s)</span>
          <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{recordsChecked} checked</span>
          <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{humanReviewHandoffs.length} handoff(s)</span>
        </div>
        {hasUnresolvedReferences && <p className="mt-4 text-sm leading-6 text-muted-foreground">Governance review is required because referenced source text has not been retrieved.</p>}
        {!hasUnresolvedReferences && issueCount === 0 && records.length > 0 && <p className="mt-4 text-sm leading-6 text-muted-foreground">Governance checked {records.length} source-backed record(s) and found no review issues.</p>}
        {governance?.principle && <p className="mt-4 text-sm leading-6 text-muted-foreground">{hideAtomicReferences(governance.principle, atomicReferenceLabel)}</p>}
      </Section>

      {humanReviewHandoffs.length > 0 && <HumanReviewSummary handoffs={humanReviewHandoffs} />}

      {activeIssues.length > 0 && (
        <Section title="Review Items">
          <div className="space-y-3">
            {activeIssues.map((issue, index) => (
              <div key={`${issue.checkName}-${index}`} className="rounded-lg border border-gold/40 bg-gold/10 p-3">
                <div className="text-sm font-semibold text-foreground">{issue.checkName || "Governance check"}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-gold-muted">{displayStatus(issue.status)}</div>
                {issue.issue && <p className="mt-2 text-sm leading-6 text-muted-foreground">{hideAtomicReferences(issue.issue, atomicReferenceLabel)}</p>}
                {safeArray(issue.missingFields).length > 0 && <p className="mt-2 text-sm leading-6 text-muted-foreground">Missing: {safeArray(issue.missingFields).join(", ")}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Records Checked">
        {displayRecords.length > 0 ? (
          <details className="rounded-lg border border-border/50 bg-background/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">View source-backed records used for the governance check</summary>
            <div className="mt-3 space-y-3">
              {displayRecords.map((record, index) => {
                const issues = safeArray(record.activeIssues);
                return (
                  <div key={`governance-record-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label="checked record" status={record.overallStatus} />
                      {record.inputField && <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1 text-xs font-medium text-muted-foreground">{record.inputField}</span>}
                    </div>
                    {record.extractedValue && <div className="mt-3"><SourceQuote>{hideAtomicReferences(record.extractedValue)}</SourceQuote></div>}
                    {record.sourceAnchor && <div className="mt-2 text-xs leading-5 text-muted-foreground">Source backing: {hideAtomicReferences(record.sourceAnchor)}</div>}
                    {issues.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {issues.map((issue, issueIndex) => <div key={`${issue.checkName}-${issueIndex}`} className="text-sm leading-6 text-gold-muted">{issue.checkName || "Check"}: {hideAtomicReferences(issue.issue || displayStatus(issue.status))}</div>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ) : hasUnresolvedReferences ? <EmptyState>0 governance records checked because referenced source text has not been retrieved.</EmptyState> : <EmptyState>No governance records were available to check.</EmptyState>}
      </Section>
    </div>
  );
}
