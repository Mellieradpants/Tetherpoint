import type { PipelineResponse } from "../../types/pipeline";
import {
  EmptyState,
  Section,
  displayStatus,
  hideAtomicReferences,
  safeArray,
  toneClass,
} from "./shared";

type GovernanceCheck = {
  checkName?: string;
  status?: string;
  issue?: string | null;
  missingFields?: string[];
};

export function IssuesTab({ data }: { data: PipelineResponse }) {
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
