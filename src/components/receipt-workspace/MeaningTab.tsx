import { useState } from "react";
import { translatePlainMeaning } from "../../lib/api-client";
import type { PipelineResponse } from "../../types/pipeline";
import { ANSWER_LANGUAGE_OPTIONS } from "./answer-language";
import { ExtendedMeaningPanel, hasExtendedMeaningReferences } from "./ExtendedMeaningPanel";
import {
  EmptyState,
  Section,
  SourceQuote,
  StatusPill,
  hideAtomicReferences,
  hasUnresolvedReferencedSources,
  ruleTextById,
  safeArray,
  splitParagraphs,
} from "./shared";

export function PlainMeaningTranslation({
  text,
  hasUnresolvedReferences,
  embedded = false,
  language,
  onLanguageChange,
  showLanguageControl = true,
}: {
  text: string;
  hasUnresolvedReferences: boolean;
  embedded?: boolean;
  language?: string;
  onLanguageChange?: (language: string) => void;
  showLanguageControl?: boolean;
}) {
  const [localLanguage, setLocalLanguage] = useState(ANSWER_LANGUAGE_OPTIONS[0].code);
  const [translatedText, setTranslatedText] = useState("");
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const selectedLanguage = language ?? localLanguage;

  const setSelectedLanguage = (value: string) => {
    onLanguageChange?.(value);
    if (language === undefined) setLocalLanguage(value);
    setTranslatedText("");
    setTranslationError(null);
  };

  const translate = async () => {
    setTranslating(true);
    setTranslationError(null);
    setTranslatedText("");

    try {
      const result = await translatePlainMeaning({ text, language: selectedLanguage });
      setTranslatedText(result.translated_text);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      setTranslating(false);
    }
  };

  const content = (
    <>
      <div className="flex flex-wrap items-end gap-3">
        {showLanguageControl && (
          <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Target language
            </span>
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ANSWER_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={translate}
          disabled={translating || !text.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {translating ? "Translating..." : "Apply answer language"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Translation runs only on the plain meaning returned by the Meaning step. It does not rerun
        analysis or change {hasUnresolvedReferences ? "source references" : "source-backed results"}
        .
      </p>
      {translationError && (
        <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {translationError}
        </div>
      )}
      {translatedText && (
        <div className="mt-4">
          <SourceQuote>{translatedText}</SourceQuote>
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return <Section title="Translate Plain Meaning">{content}</Section>;
}

export function MeaningTab({
  data,
  answerLanguage,
}: {
  data: PipelineResponse;
  answerLanguage?: string;
}) {
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const atomicReferenceLabel = hasUnresolvedReferences
    ? "source reference"
    : "source-backed result";
  const plainMeaning = hideAtomicReferences(
    data.meaning?.overall_plain_meaning || data.meaning?.message || "",
    atomicReferenceLabel,
  );
  const paragraphs = splitParagraphs(plainMeaning);
  const sourceByRule = ruleTextById(data);
  const externalReferenceNeeded = hasExtendedMeaningReferences(data);
  const meaningDetails = safeArray(data.meaning?.node_results);

  return (
    <div className="space-y-4">
      {externalReferenceNeeded && (
        <Section title="Reference Needed">
          <p className="text-sm leading-6 text-muted-foreground">
            {hasUnresolvedReferences
              ? "Meaning is limited to supplied source text. Referenced source text has not been retrieved into Tetherpoint."
              : "This source text depends on outside referenced law or source material. The plain meaning below explains only the text that was supplied."}
          </p>
        </Section>
      )}

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

      {externalReferenceNeeded &&
        plainMeaning &&
        (hasUnresolvedReferences ? (
          <Section title="Extended Meaning">
            <EmptyState>Unavailable until referenced source text is retrieved.</EmptyState>
          </Section>
        ) : (
          <ExtendedMeaningPanel data={data} plainMeaning={plainMeaning} />
        ))}

      {plainMeaning && (
        <PlainMeaningTranslation
          text={plainMeaning}
          hasUnresolvedReferences={hasUnresolvedReferences}
          language={answerLanguage}
          showLanguageControl={!answerLanguage}
        />
      )}

      {meaningDetails.length > 0 && (
        <Section title="Details">
          <details className="rounded-lg border border-border/50 bg-background/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              View source text used for this result
            </summary>
            <div className="mt-3 space-y-3">
              {meaningDetails.map((result, index) => {
                const sourceText = sourceByRule.get(result.node_id) || result.source_text;
                return (
                  <div
                    key={`meaning-source-${index}`}
                    className="rounded-lg border border-border/50 bg-background/40 p-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label="meaning detail" status={result.status} />
                    </div>
                    {result.plain_meaning && (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {hideAtomicReferences(result.plain_meaning, atomicReferenceLabel)}
                      </p>
                    )}
                    {sourceText && (
                      <div className="mt-3">
                        <SourceQuote>{sourceText}</SourceQuote>
                      </div>
                    )}
                    {(result.message || result.error) && (
                      <div className="mt-3 text-sm leading-6 text-gold-muted">
                        {hideAtomicReferences(result.message || result.error, atomicReferenceLabel)}
                      </div>
                    )}
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
