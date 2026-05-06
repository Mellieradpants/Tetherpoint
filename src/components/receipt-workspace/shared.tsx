import type { ReactNode } from "react";

export type Tone = "good" | "review" | "bad" | "neutral";

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function displayStatus(value: string | null | undefined): string {
  if (!value) return "Not returned";
  if (value === "fallback") return "Deterministic";
  if (value === "needs_review") return "Needs review";
  return value.replaceAll("_", " ");
}

export function rawStatus(value: string | null | undefined): string {
  return value?.toLowerCase() ?? "";
}

export function hideAtomicReferences(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replace(/\s*Supporting nodes?:\s*node-\d+(?:,\s*node-\d+)*\.?/gi, "")
    .replace(/node-\d+/gi, "source-backed result")
    .replace(/source_node_ids?/gi, "source backing")
    .trim();
}

export function toneForStatus(status: string | null | undefined): Tone {
  const value = rawStatus(status);

  if (["blocked", "error", "failed", "fatal", "contradiction", "unsupported"].some((token) => value.includes(token))) {
    return "bad";
  }

  if (["needs_review", "review", "repaired", "missing", "skipped", "warning"].some((token) => value.includes(token))) {
    return "review";
  }

  if (["fallback", "ok", "clean", "match", "ready", "complete", "executed", "assembled", "available", "detected", "resolved"].some((token) => value.includes(token))) {
    return "good";
  }

  return "neutral";
}

export function toneClass(tone: Tone): string {
  if (tone === "good") return "border-primary/30 bg-primary/10 text-primary";
  if (tone === "review") return "border-gold/40 bg-gold/10 text-gold-muted";
  if (tone === "bad") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border/60 bg-background/30 text-muted-foreground";
}

export function splitParagraphs(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return [];
  return text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-surface p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">{title}</div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-sm italic leading-6 text-muted-foreground">{children}</div>;
}

export function StatusPill({ label, status }: { label: string; status: string | null | undefined }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass(toneForStatus(status))}`}>
      {label}: {displayStatus(status)}
    </span>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-border/50 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

export function SourceQuote({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm leading-6 text-foreground">{children}</div>;
}
