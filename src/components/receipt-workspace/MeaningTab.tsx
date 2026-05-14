import { useState } from "react";
import { translatePlainMeaning } from "../../lib/api-client";
import type { PipelineResponse } from "../../types/pipeline";
import { ExtendedMeaningPanel, hasExtendedMeaningReferences } from "./ExtendedMeaningPanel";
import {
  EmptyState,
  Section,
  SourceQuote,
  StatusPill,
  hideAtomicReferences,
  ruleTextById,
  safeArray,
  splitParagraphs,
} from "./shared";

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

export function MeaningTab({ data }: { data: PipelineResponse }) {
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
