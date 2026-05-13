import { useMemo, useState } from "react";
import { GovernanceTab } from "./receipt-workspace/GovernanceTab";
import { IssuesTab } from "./receipt-workspace/IssuesTab";
import { MeaningTab } from "./receipt-workspace/MeaningTab";
import { OriginTab } from "./receipt-workspace/OriginTab";
import { ResultActions } from "./receipt-workspace/ResultActions";
import { StatusPill, safeArray, toneClass } from "./receipt-workspace/shared";
import { SupportPathPanel } from "./receipt-workspace/SupportPathPanel";
import { VerificationTab } from "./receipt-workspace/VerificationTab";
import type { PipelineResponse } from "./Workspace";

export type { PipelineResponse } from "./Workspace";

type ResultTab = "meaning" | "origin" | "verification" | "governance" | "issues";

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

export function ReceiptWorkspace({ data }: { data: PipelineResponse }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("meaning");
  const issueCount = safeArray(data.errors).length + (data.governance?.issue_count ?? data.output?.governance_issue_count ?? 0);
  const tabs = useMemo<ResultTab[]>(
    () => issueCount > 0 ? ["meaning", "origin", "verification", "governance", "issues"] : ["meaning", "origin", "verification", "governance"],
    [issueCount]
  );
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
