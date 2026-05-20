import { useMemo, useState } from "react";
import { GovernanceTab } from "./receipt-workspace/GovernanceTab";
import { IssuesTab } from "./receipt-workspace/IssuesTab";
import { ANSWER_LANGUAGE_OPTIONS } from "./receipt-workspace/answer-language";
import { MeaningTab } from "./receipt-workspace/MeaningTab";
import { OriginTab } from "./receipt-workspace/OriginTab";
import { ResultActions } from "./receipt-workspace/ResultActions";
import { DocumentNavigator } from "./receipt-workspace/DocumentNavigator";
import {
  StatusPill,
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

const WORKSPACE_TABS = ["Document", "Ask", "Compare", "References", "Timeline"] as const;

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
    <div className="bg-background md:h-full md:overflow-y-auto">
      <div className="mx-auto max-w-[96rem] space-y-4 px-4 py-4 pb-12">
        <section className="rounded-lg border border-border/70 bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                Tetherpoint
              </div>
              <h2 className="mt-1 truncate text-xl font-semibold text-foreground">
                Document Navigator
              </h2>
            </div>

            <nav className="flex min-w-0 flex-1 flex-wrap justify-center gap-1 px-2">
              {WORKSPACE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={tab === "Document"}
                  className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    tab === "Document"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                  {tab !== "Document" && (
                    <span className="ml-2 text-[10px] font-medium text-muted-foreground">soon</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <label className="block min-w-56 text-sm font-medium text-foreground">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Answer language
                </span>
                <select
                  value={answerLanguage}
                  onChange={(event) => setAnswerLanguage(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {ANSWER_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <ResultActions data={data} />
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Keep the document in the center. Select a page or section to see attached meaning,
              source support, jurisdiction, local-law review status, and next checks beside it.
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusPill label="meaning" status={data.meaning?.status} />
              <StatusPill label="governance" status={governanceStatus} />
            </div>
          </div>
        </section>

        {safeArray(data.errors).length > 0 && (
          <section
            className={`rounded-lg border p-4 text-sm leading-6 ${toneClass(hasFatalError ? "bad" : "review")}`}
          >
            The analysis returned {data.errors.length} pipeline issue(s). Open the technical trace
            for details.
          </section>
        )}

        <DocumentNavigator data={data} answerLanguage={answerLanguage} />

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
      </div>
    </div>
  );
}
