
import { VerificationTab } from "./receipt-workspace/VerificationTab";
import { safeArray, displayStatus, rawStatus, ruleTextById } from "./receipt-workspace/shared";
import { OriginTab } from "./receipt-workspace/OriginTab"; 
import { GovernanceTab } from "./receipt-workspace/GovernanceTab";
import { ExtendedMeaningPanel, hasExtendedMeaningReferences } from "./receipt-workspace/ExtendedMeaningPanel";
import { useMemo, useState, type ReactNode } from "react";
import { translatePlainMeaning } from "../lib/api-client";
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

const TRANSLATION_LANGUAGES = [
  { code: "es", label: "Spanish" },
  { code: "ht", label: "Haitian Creole" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "ar", label: "Arabic" },
  { code: "fa", label: "Persian / Farsi" },
  { code: "prs", label: "Dari" },
  { code: "ps", label: "Pashto" },
  { code: "ur", label: "Urdu" },
  { code: "hi", label: "Hindi" },
  { code: "pa", label: "Punjabi" },
  { code: "bn", label: "Bengali" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "yue", label: "Cantonese" },
  { code: "vi", label: "Vietnamese" },
  { code: "ko", label: "Korean" },
  { code: "tl", label: "Tagalog" },
  { code: "my", label: "Burmese" },
  { code: "ne", label: "Nepali" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "tr", label: "Turkish" },
  { code: "so", label: "Somali" },
  { code: "am", label: "Amharic" },
  { code: "ti", label: "Tigrinya" },
  { code: "sw", label: "Swahili" },
  { code: "rw", label: "Kinyarwanda" },
];

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

function splitParagraphs(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  return text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-border/50 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

function SourceQuote({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm leading-6 text-foreground">{children}</div>;
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
function PlainMeaningTranslation({ text }: { text: string }) {
  const [language, setLanguage] = useState(TRANSLATION_LANGUAGES[0].code);
  const [translatedText, setTranslatedText] = useState("");
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const translate = async () => {
    setTranslating(true);
    setTranslationError(null);
    setTranslatedText("");

    try {
      const result = await translatePlainMeaning({ text, language });
      setTranslatedText(result.translated_text);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <Section title="Translate Plain Meaning">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Target language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TRANSLATION_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={translate}
          disabled={translating || !text.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {translating ? "Translating..." : "Translate after meaning"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Translation runs only on the plain meaning returned by the Meaning step. It does not rerun analysis or change source-backed results.
      </p>
      {translationError && <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{translationError}</div>}
      {translatedText && <div className="mt-4"><SourceQuote>{translatedText}</SourceQuote></div>}
    </Section>
  );
}

function PlainMeaningTab({ data }: { data: PipelineResponse }) {
  const plainMeaning = hideAtomicReferences(data.meaning?.overall_plain_meaning || data.meaning?.message || "");
  const paragraphs = splitParagraphs(plainMeaning);
  const sourceByRule = ruleTextById(data);
  const externalReferenceNeeded = hasExtendedMeaningReferences(data);
  const meaningDetails = safeArray(data.meaning?.node_results);

  return (
    <div className="space-y-4">
      {externalReferenceNeeded && (
        <Section title="Reference Needed">
          <p className="text-sm leading-6 text-muted-foreground">
            This source text depends on outside referenced law or source material. The plain meaning below explains only the text that was supplied.
          </p>
        </Section>
      )}

      <Section title="Plain Meaning">
        {paragraphs.length > 0 ? (
          <div className="space-y-3 text-base leading-7 text-foreground">
            {paragraphs.map((paragraph, index) => <p key={`meaning-${index}`}>{paragraph}</p>)}
          </div>
        ) : <EmptyState>No plain meaning was returned for this analysis.</EmptyState>}
      </Section>

      {externalReferenceNeeded && plainMeaning && <ExtendedMeaningPanel data={data} plainMeaning={plainMeaning} />}

      {plainMeaning && <PlainMeaningTranslation text={plainMeaning} />}

      {meaningDetails.length > 0 && (
        <Section title="Details">
          <details className="rounded-lg border border-border/50 bg-background/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">View source text used for this result</summary>
            <div className="mt-3 space-y-3">
              {meaningDetails.map((result, index) => {
                const sourceText = sourceByRule.get(result.node_id) || result.source_text;
                return (
                  <div key={`meaning-source-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label="meaning detail" status={result.status} />
                    </div>
                    {result.plain_meaning && <p className="mt-3 text-sm leading-6 text-muted-foreground">{hideAtomicReferences(result.plain_meaning)}</p>}
                    {sourceText && <div className="mt-3"><SourceQuote>{sourceText}</SourceQuote></div>}
                    {(result.message || result.error) && <div className="mt-3 text-sm leading-6 text-gold-muted">{hideAtomicReferences(result.message || result.error)}</div>}
                  </div>
                );
              })}
            </div>
          </details>
        </Section>
      )}
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
  const tabs = useMemo<ResultTab[]>(() => issueCount > 0 ? ["meaning", "origin", "verification", "governance", "issues"] : ["meaning", "origin", "verification", "governance"], [issueCount]);
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

        <nav className={`grid gap-2 rounded-xl border border-border/60 bg-surface/60 p-2 ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
          {tabs.map((tab) => <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} issueCount={issueCount} />)}
        </nav>

        {activeTab === "meaning" && <PlainMeaningTab data={data} />}
        {activeTab === "origin" && <OriginTab data={data} />}
        {activeTab === "verification" && <VerificationTab data={data} />}
        {activeTab === "governance" && <GovernanceTab data={data} />}
        {activeTab === "issues" && <IssuesTab data={data} />}
      </div>
    </div>
  );
}

      
