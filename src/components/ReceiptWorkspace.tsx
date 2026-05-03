import { useMemo, useState, type ReactNode } from "react";
import { resolveReference, translatePlainMeaning, type ResolveReferenceResponse } from "../lib/api-client";
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

type GovernanceRecord = {
  inputField?: string | null;
  extractedValue?: string | null;
  sourceAnchor?: string | null;
  sourceSystem?: string | null;
  documentType?: string | null;
  overallStatus?: string | null;
  activeIssues?: GovernanceCheck[];
};

type RuleUnitReferencePacket = {
  name: string;
  referenceType: string;
  matchedText: string;
  officialSourceUrl?: string | null;
  retrievalStatus: "not_attempted" | "manual_required" | "retrieved" | "failed";
  sourceText?: string;
  anchors?: string[];
  limits?: string[];
};

type RuleUnitWithReferenceMetadata = PipelineResponse["rule_units"]["rule_units"][number] & {
  requires_reference_resolution?: boolean;
  referenced_sources?: RuleUnitReferencePacket[];
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

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function displayStatus(value: string | null | undefined): string {
  if (!value) return "Not returned";
  if (value === "fallback") return "Deterministic";
  if (value === "needs_review") return "Needs review";
  return value.replaceAll("_", " ");
}

function rawStatus(value: string | null | undefined): string {
  return value?.toLowerCase() ?? "";
}

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

function uniqueReferencePackets(units: RuleUnitWithReferenceMetadata[]): RuleUnitReferencePacket[] {
  const seen: Set<string> = new Set();
  const packets: RuleUnitReferencePacket[] = [];

  for (const unit of units) {
    for (const packet of safeArray(unit.referenced_sources)) {
      const key = `${packet.name}|${packet.matchedText}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      packets.push(packet);
    }
  }

  return packets;
}

function referenceUnits(data: PipelineResponse): RuleUnitWithReferenceMetadata[] {
  return (safeArray(data.rule_units?.rule_units) as RuleUnitWithReferenceMetadata[]).filter(
    (unit) => Boolean(unit.requires_reference_resolution) && safeArray(unit.referenced_sources).length > 0
  );
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

function ruleTextById(data: PipelineResponse): Map<string, string> {
  const map = new Map<string, string>();
  for (const unit of safeArray(data.rule_units?.rule_units)) {
    const text = unit.source_text_combined || unit.primary_text || "";
    if (text) map.set(unit.rule_unit_id, text);
  }
  return map;
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

function ExtendedMeaningPanel({ data, plainMeaning }: { data: PipelineResponse; plainMeaning: string }) {
  const [referencedSourceText, setReferencedSourceText] = useState("");
  const [result, setResult] = useState<ResolveReferenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const units = referenceUnits(data);
  const referencePackets = uniqueReferencePackets(units);
  const referenceRoleBySource = new Map(
  (data.governance_gate?.reference_roles || []).map((role) => [
    role.source.toLowerCase(),
    role,
  ])
);
const practicalQuestions = data.governance_gate?.practical_questions || [];
const gateLimits = data.governance_gate?.limits || [];

  const referencedSources = referencePackets.map((packet) => packet.name);
  const currentText = units
    .map((unit) => unit.source_text_combined || unit.primary_text || "")
    .filter(Boolean)
    .join("\n\n") || data.input.raw_content;
  const sourceAnchors = [
    ...units.map((unit) => {
      const text = unit.source_text_combined || unit.primary_text || "";
      return text ? `${unit.rule_unit_id}: ${text}` : "";
    }),
    ...referencePackets.flatMap((packet) => safeArray(packet.anchors).map((anchor) => `${packet.name}: ${anchor}`)),
  ].filter(Boolean);

  const runResolver = async () => {
    setResolving(true);
    setError(null);
    setResult(null);

    try {
      const response = await resolveReference({
        current_text: currentText,
        plain_meaning: plainMeaning,
        referenced_sources: referencedSources,
        referenced_source_text: referencedSourceText,
        source_anchors: sourceAnchors,
      });
      setResult(response);
    } catch (resolverError) {
      setError(resolverError instanceof Error ? resolverError.message : "Extended meaning failed.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <Section title="Extended Meaning">
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Uses referenced source text you provide to show how outside references connect to the current rule.
        </p>
        {referencePackets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {referencePackets.map((packet) => (
              <span key={`${packet.name}-${packet.matchedText}`} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {packet.name}
              </span>
            ))}
          </div>
        )}
      {referencePackets.length > 0 && (
  <div className="rounded-xl border border-border/60 bg-background/40 p-3">
    <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
      Reference Packets
    </div>

    <div className="space-y-3">
      {referencePackets.map((packet) => {
        const role = referenceRoleBySource.get(packet.name.toLowerCase());

        return (
          <div
            key={`${packet.name}-${packet.matchedText || packet.referenceType}`}
            className="rounded-lg border border-border/50 bg-surface p-3"
          >
            <div className="text-sm font-semibold text-foreground">
              {packet.name}
            </div>

            {role?.role && (
              <div className="mt-1 text-xs text-muted-foreground">
                Role: {role.role}
              </div>
            )}

            {packet.matchedText && (
              <div className="mt-2 text-xs text-muted-foreground">
                Matched text: {packet.matchedText}
              </div>
            )}

            {packet.retrievalStatus && (
              <div className="mt-2 text-xs text-muted-foreground">
                Retrieval status: {packet.retrievalStatus}
              </div>
            )}

            {packet.officialSourceUrl && (
              <a
                href={packet.officialSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-primary underline underline-offset-2"
              >
                Open official source
              </a>
            )}

            {packet.limits && packet.limits.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Limits: {packet.limits.join("; ")}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {practicalQuestions.length > 0 && (
      <div className="mt-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Needed to resolve
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {practicalQuestions.slice(0, 5).map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>
    )}

 {gateLimits.length > 0 && (
      <div className="mt-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Limits
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {gateLimits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
)}



      <textarea
          value={referencedSourceText}
          onChange={(event) => setReferencedSourceText(event.target.value)}
          placeholder="Paste referenced act, section, definition, or official source text here."
          className="min-h-40 w-full rounded-lg border border-border bg-background/40 p-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={runResolver}
          disabled={resolving || !referencedSourceText.trim() || referencedSources.length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {resolving ? "Generating..." : "Generate Extended Meaning"}
        </button>
        {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {result && (
          <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-3">
            <StatusPill label="extended meaning" status={result.status} />
            {result.whoIsAffected && <DetailRow label="who is affected" value={result.whoIsAffected} />}
            {result.whatChanges && <DetailRow label="what changes" value={result.whatChanges} />}
            {result.whenItApplies && <DetailRow label="when it applies" value={result.whenItApplies} />}
            {result.whereInProcessItApplies && <DetailRow label="where in the process it applies" value={result.whereInProcessItApplies} />}
            {result.howProcessOrRequirementChanges && <DetailRow label="how the process or requirement changes" value={result.howProcessOrRequirementChanges} />}
            {result.whyReferencedSourceMatters && <DetailRow label="why the referenced source matters" value={result.whyReferencedSourceMatters} />}
            {safeArray(result.affectedActorEffects).length > 0 && (
              <DetailRow
                label="affected actor effects"
                value={safeArray(result.affectedActorEffects).map((effect, index) => <div key={`actor-effect-${index}`}>{effect}</div>)}
              />
            )}
            {safeArray(result.referencedSourceMappings).map((mapping, index) => (
              <div key={`${mapping.sourceName}-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-foreground">{mapping.sourceName}</div>
                  <StatusPill label="effect" status={mapping.effectType} />
                </div>
                {mapping.roleInCurrentRule && <DetailRow label="role in current rule" value={mapping.roleInCurrentRule} />}
                {mapping.specificTextUsed && (
                  <div className="mt-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Specific text used</div>
                    <SourceQuote>{mapping.specificTextUsed}</SourceQuote>
                  </div>
                )}
                {mapping.howItConnectsToCurrentRule && <DetailRow label="how it connects to the current rule" value={mapping.howItConnectsToCurrentRule} />}
                {mapping.plainLanguageEffect && <DetailRow label="plain-language effect" value={mapping.plainLanguageEffect} />}
              </div>
            ))}
            {safeArray(result.whatDoesNotFollowFromSuppliedText).length > 0 && (
              <DetailRow
                label="what does not follow from the supplied text"
                value={safeArray(result.whatDoesNotFollowFromSuppliedText).map((item, index) => <div key={`unsupported-${index}`}>{item}</div>)}
              />
            )}
            {safeArray(result.limits).length > 0 && (
              <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                {result.limits.map((limit, index) => <div key={`limit-${index}`}>Limit: {limit}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function PlainMeaningTab({ data }: { data: PipelineResponse }) {
  const plainMeaning = hideAtomicReferences(data.meaning?.overall_plain_meaning || data.meaning?.message || "");
  const paragraphs = splitParagraphs(plainMeaning);
  const sourceByRule = ruleTextById(data);
  const externalReferenceNeeded = referenceUnits(data).length > 0;
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

function OriginTab({ data }: { data: PipelineResponse }) {
  const origin = data.origin;
  const referencedSources = safeArray(origin?.referenced_sources);
  const signals = [
    ...safeArray(origin?.origin_identity_signals),
    ...safeArray(origin?.origin_metadata_signals),
    ...safeArray(origin?.distribution_signals),
  ];

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
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{displayStatus(source.reference_type)}</div>
                {source.matched_text && <div className="mt-3"><SourceQuote>{source.matched_text}</SourceQuote></div>}
                {source.why_it_matters && <p className="mt-2 text-sm leading-6 text-muted-foreground">{hideAtomicReferences(source.why_it_matters)}</p>}
                {source.official_source_url && <a className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" href={source.official_source_url} target="_blank" rel="noreferrer">Open official source</a>}
              </div>
            ))}
          </div>
        ) : <EmptyState>No referenced source was detected in this input.</EmptyState>}
      </Section>

      <Section title="Source Signals">
        {signals.length > 0 ? (
          <div className="space-y-3">
            {signals.map((signal, index) => <DetailRow key={`${signal.signal}-${index}`} label={signal.signal} value={hideAtomicReferences(signal.value)} />)}
          </div>
        ) : <EmptyState>Pasted text has no source metadata. Use official HTML, XML, JSON, or source metadata when you need stronger origin signals.</EmptyState>}
      </Section>
    </div>
  );
}

function VerificationTab({ data }: { data: PipelineResponse }) {
  const sourceByRule = ruleTextById(data);
  const results = safeArray(data.verification?.node_results);
  const visibleResults = results.filter((result) => (
    result.assertion_detected ||
    result.verification_path_available ||
    safeArray(result.expected_record_systems).length > 0
  ));
  const routed = results.filter((result) => safeArray(result.expected_record_systems).length > 0);

  return (
    <div className="space-y-4">
      <Section title="Verification Summary">
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailRow label="status" value={displayStatus(data.verification?.status)} />
          <DetailRow label="checked" value={`${results.length} backed result(s)`} />
          <DetailRow label="routed" value={`${routed.length} backed result(s)`} />
        </div>
      </Section>

      <Section title="Verification Routes">
        {visibleResults.length > 0 ? (
          <div className="space-y-3">
            {visibleResults.map((result, index) => {
              const systems = safeArray(result.expected_record_systems);
              const sourceText = sourceByRule.get(result.rule_unit_id || result.node_id);
              const notes = hideAtomicReferences(result.verification_notes);
              return (
                <div key={`verification-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <div className="flex flex-wrap gap-2">
                    {result.assertion_detected && <StatusPill label="assertion" status="detected" />}
                    {result.verification_path_available && <StatusPill label="path" status="available" />}
                  </div>
                  {result.assertion_type && <div className="mt-3 text-sm leading-6 text-muted-foreground">Assertion type: {displayStatus(result.assertion_type)}</div>}
                  {systems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {systems.map((system) => <span key={system} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{system}</span>)}
                    </div>
                  )}
                  {notes && <p className="mt-3 text-sm leading-6 text-muted-foreground">{notes}</p>}
                  {sourceText && <div className="mt-3"><SourceQuote>{sourceText}</SourceQuote></div>}
                </div>
              );
            })}
          </div>
        ) : <EmptyState>No verification routes were detected for this input.</EmptyState>}
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
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass(issueCount > 0 ? "review" : "good")}`}>{issueCount} issue(s)</span>
          <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{governance?.record_count ?? records.length} checked</span>
        </div>
        {issueCount === 0 && records.length > 0 && <p className="mt-4 text-sm leading-6 text-muted-foreground">Governance checked {records.length} source-backed record(s) and found no review issues.</p>}
        {governance?.principle && <p className="mt-4 text-sm leading-6 text-muted-foreground">{hideAtomicReferences(governance.principle)}</p>}
      </Section>

      {activeIssues.length > 0 && (
        <Section title="Review Items">
          <div className="space-y-3">
            {activeIssues.map((issue, index) => (
              <div key={`${issue.checkName}-${index}`} className="rounded-lg border border-gold/40 bg-gold/10 p-3">
                <div className="text-sm font-semibold text-foreground">{issue.checkName || "Governance check"}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-gold-muted">{displayStatus(issue.status)}</div>
                {issue.issue && <p className="mt-2 text-sm leading-6 text-muted-foreground">{hideAtomicReferences(issue.issue)}</p>}
                {safeArray(issue.missingFields).length > 0 && <p className="mt-2 text-sm leading-6 text-muted-foreground">Missing: {safeArray(issue.missingFields).join(", ")}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Records Checked">
        {records.length > 0 ? (
          <details className="rounded-lg border border-border/50 bg-background/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">View source-backed records used for the governance check</summary>
            <div className="mt-3 space-y-3">
              {records.map((record, index) => {
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
        ) : <EmptyState>No governance records were available to check.</EmptyState>}
      </Section>
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
