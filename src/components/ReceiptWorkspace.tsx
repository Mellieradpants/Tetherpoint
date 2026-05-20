import { useMemo, useState } from "react";
import { GovernanceTab } from "./receipt-workspace/GovernanceTab";
import { IssuesTab } from "./receipt-workspace/IssuesTab";
import { MeaningTab } from "./receipt-workspace/MeaningTab";
import { OriginTab } from "./receipt-workspace/OriginTab";
import { ResultActions } from "./receipt-workspace/ResultActions";
import { DocumentNavigator } from "./receipt-workspace/DocumentNavigator";
import {
  hasUnresolvedReferencedSources,
  safeArray,
  toneClass,
} from "./receipt-workspace/shared";
import { SupportPathPanel } from "./receipt-workspace/SupportPathPanel";
import { VerificationTab } from "./receipt-workspace/VerificationTab";
import { DOCUMENT_NAVIGATOR_ZONES } from "./receipt-workspace/document-navigator-shell-contract";
import type { PipelineResponse } from "../types/pipeline";

export type { PipelineResponse } from "../types/pipeline";

type ResultTab = "meaning" | "origin" | "verification" | "governance" | "issues";

function TabButton({
  tab,
  active,
  onClick,
  issueCount = 0,
}: {
  tab: ResultTab;
  active: boolean;
  onClick: () => void;
  issueCount?: number;
}) {
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
      <span className="block truncate whitespace-nowrap">
        {labels[tab]}
        {tab === "issues" && issueCount > 0 ? ` ${issueCount}` : ""}
      </span>
    </button>
  );
}

export function ReceiptWorkspace({ data }: { data: PipelineResponse }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("meaning");
  const [answerLanguage, setAnswerLanguage] = useState("en");
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const issueCount =
    safeArray(data.errors).length +
    (data.governance?.issue_count ?? data.output?.governance_issue_count ?? 0);
  const tabs = useMemo<ResultTab[]>(
    () =>
      issueCount > 0
        ? ["meaning", "origin", "verification", "governance", "issues"]
        : ["meaning", "origin", "verification", "governance"],
    [issueCount],
  );
  const hasFatalError = safeArray(data.errors).some((error) => error.fatal);
  const governanceStatus = hasUnresolvedReferences
    ? "review_required"
    : (data.governance?.status ?? data.output?.governance_status);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-[92rem] space-y-4 px-4 py-4 pb-12">
        {safeArray(data.errors).length > 0 && (
          <section
            className={`rounded-lg border p-4 text-sm leading-6 ${toneClass(hasFatalError ? "bad" : "review")}`}
          >
            The analysis returned {data.errors.length} pipeline issue(s). Open the technical trace
            for details.
          </section>
        )}

        <DocumentNavigator
          data={data}
          answerLanguage={answerLanguage}
          onAnswerLanguageChange={setAnswerLanguage}
        />

        <details className="rounded-lg border border-border/70 bg-surface/70 p-3 text-sm shadow-sm">
          <summary className="cursor-pointer px-1 text-sm font-semibold text-foreground">
            {DOCUMENT_NAVIGATOR_ZONES.technical_trace.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Raw IDs, route details, and diagnostic output
            </span>
          </summary>
          <div className="mt-4 space-y-4">
            <SupportPathPanel data={data} />

            <nav
              className={`grid gap-2 rounded-xl border border-border/60 bg-surface/60 p-2 ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}
            >
              {tabs.map((tab) => (
                <TabButton
                  key={tab}
                  tab={tab}
                  active={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  issueCount={issueCount}
                />
              ))}
            </nav>

            {activeTab === "meaning" && <MeaningTab data={data} answerLanguage={answerLanguage} />}
            {activeTab === "origin" && <OriginTab data={data} />}
            {activeTab === "verification" && <VerificationTab data={data} />}
            {activeTab === "governance" && <GovernanceTab data={data} />}
            {activeTab === "issues" && <IssuesTab data={data} />}
          </div>
        </details>

        <div className="flex justify-end">
          <ResultActions data={data} />
        </div>
        <span className="sr-only">Governance status: {governanceStatus}</span>
      </div>
    </div>
  );
}
