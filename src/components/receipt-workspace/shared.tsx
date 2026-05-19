import type { ReactNode } from "react";
import type { PipelineResponse } from "../../types/pipeline";

export type Tone = "good" | "review" | "bad" | "neutral";

type RuleUnitReferencePacket = {
  retrievalStatus?: string | null;
  sourceText?: string | null;
};

type RuleUnitWithReferences = {
  referenced_sources?: RuleUnitReferencePacket[] | null;
};

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function displayStatus(value: string | null | undefined): string {
  if (!value) return "Not returned";
  if (value === "fallback") return "Deterministic";
  if (value === "needs_review") return "Needs review";
  if (value === "not_attached") return "Not attached";
  if (value === "not_attempted") return "Not checked";
  if (value === "document packet") return "Document";
  if (value === "executed") return "Mapped";
  if (value === "skipped") return "Not attached";
  if (value === "match") return "Clear";
  return value.replaceAll("_", " ");
}

export function rawStatus(value: string | null | undefined): string {
  return value?.toLowerCase() ?? "";
}

export function hasUnresolvedReferencedSources(data: PipelineResponse): boolean {
  const units = safeArray(data.rule_units?.rule_units as RuleUnitWithReferences[] | undefined);

  return units.some((unit) =>
    safeArray(unit.referenced_sources).some(
      (source) =>
        rawStatus(source.retrievalStatus) === "not_attempted" || !source.sourceText?.trim(),
    ),
  );
}

export function hideAtomicReferences(
  value: string | null | undefined,
  replacement = "source-backed result",
): string {
  if (!value) return "";

  return value
    .replace(/\s*Supporting nodes?:\s*node-\d+(?:,\s*node-\d+)*\.?/gi, "")
    .replace(/node-\d+/gi, replacement)
    .replace(/source_node_ids?/gi, "source backing")
    .trim();
}

export function toneForStatus(status: string | null | undefined): Tone {
  const value = rawStatus(status);

  if (
    ["blocked", "error", "failed", "fatal", "contradiction", "unsupported"].some((token) =>
      value.includes(token),
    )
  ) {
    return "bad";
  }

  if (
    ["needs_review", "review", "repaired", "missing", "skipped", "warning"].some((token) =>
      value.includes(token),
    )
  ) {
    return "review";
  }

  if (
    [
      "fallback",
      "ok",
      "clean",
      "match",
      "ready",
      "complete",
      "executed",
      "assembled",
      "available",
      "detected",
      "resolved",
    ].some((token) => value.includes(token))
  ) {
    return "good";
  }

  return "neutral";
}

export function toneClass(tone: Tone): string {
  if (tone === "good") return "border-primary/25 bg-primary/10 text-primary";
  if (tone === "review") return "border-gold/35 bg-gold/10 text-gold-muted";
  if (tone === "bad") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border/70 bg-surface-raised/70 text-muted-foreground";
}

export function splitParagraphs(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function ruleTextById(data: PipelineResponse): Map<string, string> {
  const map = new Map<string, string>();
  for (const unit of safeArray(data.rule_units?.rule_units)) {
    const text = unit.source_text_combined || unit.primary_text || "";
    if (text) map.set(unit.rule_unit_id, text);
  }
  return map;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-sm">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
        {title}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-sm italic leading-6 text-muted-foreground">{children}</div>;
}

export function StatusPill({
  label,
  status,
}: {
  label: string;
  status: string | null | undefined;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass(toneForStatus(status))}`}
    >
      {label}: {displayStatus(status)}
    </span>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-border/50 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

export function SourceQuote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border/70 bg-surface-raised/60 p-3 text-sm leading-6 text-foreground">
      {children}
    </div>
  );
}
