import type { ReactNode } from "react";
import type { HumanReviewHandoff, SourceMetadataContract } from "../lib/api-client";
import type { PipelineResponse } from "./ReceiptWorkspace";

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueItems(items: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      items
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    )
  );
}

function countBy(items: string[]): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});
}

function displayStatus(value: string | boolean | null | undefined): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (!value) return "Not returned";
  return value.replaceAll("_", " ");
}

function joinLimited(items: string[], limit = 3): string {
  if (items.length === 0) return "None returned";
  const visible = items.slice(0, limit).join(", ");
  const remaining = items.length - limit;
  return remaining > 0 ? `${visible} +${remaining} more` : visible;
}

function formatCountMap(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "None returned";
  return entries.map(([label, count]) => `${displayStatus(label)}: ${count}`).join(" · ");
}

function getHighestSeverity(handoffs: HumanReviewHandoff[]): string {
  const rank: Record<string, number> = {
    blocked: 4,
    review_required: 3,
    alert: 2,
    degraded: 1,
  };

  return handoffs.reduce((highest, handoff) => {
    return (rank[handoff.severity] ?? 0) > (rank[highest] ?? 0) ? handoff.severity : highest;
  }, handoffs[0]?.severity ?? "alert");
}

function TextList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span key={`${label}-${item}-${index}`} className="rounded-full border border-border/60 bg-background/35 px-2.5 py-1 text-xs text-muted-foreground">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ContractRow({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="border-b border-border/40 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{displayStatus(value)}</div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/35 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium leading-6 text-foreground">{value}</div>
    </div>
  );
}

function DetailsBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="mt-3 rounded-lg border border-border/50 bg-background/25 p-3">
      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function CompactDisclosure({ tone, title, badge, subtitle, children }: { tone: "review" | "source"; title: string; badge: string; subtitle: string; children: ReactNode }) {
  const toneClass = tone === "review" ? "border-gold/50 bg-gold/10 text-gold-muted" : "border-border/60 bg-background/30 text-muted-foreground";

  return (
    <details className={`rounded-xl border bg-surface ${tone === "review" ? "border-gold/45" : "border-border/60"}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 marker:hidden">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">{title}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</div>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${toneClass}`}>
          {badge}
        </span>
      </summary>
      <div className="border-t border-border/50 px-4 py-4">{children}</div>
    </details>
  );
}

function HumanReviewCard({ handoff }: { handoff: HumanReviewHandoff }) {
  const anchorsMissing = safeArray(handoff.anchors_missing);
  const sourceObjects = safeArray(handoff.source_objects);
  const dependencies = safeArray(handoff.dependencies);

  return (
    <div className="rounded-lg border border-gold/40 bg-gold/10 p-3">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-gold/50 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gold-muted">
          severity: {displayStatus(handoff.severity)}
        </span>
        <span className="rounded-full border border-gold/50 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gold-muted">
          type: {displayStatus(handoff.handoff_type)}
        </span>
        <span className="rounded-full border border-gold/50 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gold-muted">
          can proceed: {displayStatus(handoff.can_proceed)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ContractRow label="reason" value={handoff.reason} />
        <ContractRow label="human question" value={handoff.human_question} />
      </div>

      <TextList label="anchors missing" items={anchorsMissing} />
      <TextList label="source objects" items={sourceObjects} />
      <TextList label="dependencies" items={dependencies} />
    </div>
  );
}

function SourceMetadataCard({ source }: { source: SourceMetadataContract }) {
  const limits = safeArray(source.limits);
  const relatedRuleUnitIds = safeArray(source.related_rule_unit_ids);

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{source.source_name}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{displayStatus(source.source_role)}</div>
        </div>
        <span className="rounded-full border border-border/60 bg-background/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {displayStatus(source.resolution_state)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ContractRow label="source system" value={source.source_system} />
        {source.source_url && (
          <div className="border-b border-border/40 py-2 last:border-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">source url</div>
            <a className="mt-1 inline-block break-all text-sm font-medium text-primary underline-offset-4 hover:underline" href={source.source_url} target="_blank" rel="noreferrer">
              {source.source_url}
            </a>
          </div>
        )}
      </div>

      {source.matched_text && (
        <div className="mt-3 rounded-lg border border-border/50 bg-surface/60 p-3 text-sm leading-6 text-foreground">
          {source.matched_text}
        </div>
      )}

      <TextList label="limits" items={limits} />
      <TextList label="related rule units" items={relatedRuleUnitIds} />
    </div>
  );
}

function HumanReviewSummary({ handoffs }: { handoffs: HumanReviewHandoff[] }) {
  const highestSeverity = getHighestSeverity(handoffs);
  const canProceed = handoffs.every((handoff) => handoff.can_proceed);
  const handoffTypes = uniqueItems(handoffs.map((handoff) => handoff.handoff_type));
  const questions = uniqueItems(handoffs.map((handoff) => handoff.human_question));
  const reasons = uniqueItems(handoffs.map((handoff) => handoff.reason));
  const anchorsMissing = uniqueItems(handoffs.flatMap((handoff) => safeArray(handoff.anchors_missing)));
  const sourceObjects = uniqueItems(handoffs.flatMap((handoff) => safeArray(handoff.source_objects)));
  const dependencies = uniqueItems(handoffs.flatMap((handoff) => safeArray(handoff.dependencies)));
  const unresolvedItems = uniqueItems([...anchorsMissing, ...dependencies, ...sourceObjects]);

  return (
    <CompactDisclosure
      tone="review"
      title="Human Review Handoff"
      badge={`${displayStatus(highestSeverity)} · ${handoffs.length}`}
      subtitle={`${handoffs.length} active review signal${handoffs.length === 1 ? "" : "s"}. Can proceed: ${canProceed ? "yes" : "no"}.`}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryMetric label="can proceed" value={canProceed ? "yes" : "no"} />
        <SummaryMetric label="handoff types" value={joinLimited(handoffTypes)} />
        <SummaryMetric label="unresolved items" value={unresolvedItems.length} />
      </div>

      {questions.length > 0 && (
        <div className="mt-3 rounded-lg border border-gold/30 bg-gold/10 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-muted">Human question</div>
          <ul className="space-y-2 text-sm leading-6 text-foreground">
            {questions.slice(0, 3).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SummaryMetric label="reason" value={joinLimited(reasons, 2)} />
        <SummaryMetric label="needed to resolve" value={joinLimited(unresolvedItems, 4)} />
      </div>

      <DetailsBlock label={`View ${handoffs.length} handoff record${handoffs.length === 1 ? "" : "s"}`}>
        {handoffs.map((handoff) => (
          <HumanReviewCard key={handoff.handoff_id} handoff={handoff} />
        ))}
      </DetailsBlock>
    </CompactDisclosure>
  );
}

function SourceMetadataSummary({ sources }: { sources: SourceMetadataContract[] }) {
  const sourceNames = uniqueItems(sources.map((source) => source.source_name));
  const sourceSystems = uniqueItems(sources.map((source) => source.source_system));
  const resolutionCounts = countBy(sources.map((source) => source.resolution_state ?? "unknown"));
  const unresolvedCount = sources.filter((source) => {
    const state = source.resolution_state;
    return state !== "found" && state !== "partial";
  }).length;
  const reviewCount = sources.filter((source) => source.review_state === "needs_review" || source.review_state === "blocked").length;

  return (
    <CompactDisclosure
      tone="source"
      title="Source Metadata Contract"
      badge={`${unresolvedCount} unresolved`}
      subtitle={`${sources.length} source record${sources.length === 1 ? "" : "s"}. ${joinLimited(sourceNames, 2)}.`}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryMetric label="source records" value={sources.length} />
        <SummaryMetric label="review state" value={reviewCount > 0 ? `${reviewCount} need review` : "ready"} />
        <SummaryMetric label="resolution states" value={formatCountMap(resolutionCounts)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SummaryMetric label="sources" value={joinLimited(sourceNames, 4)} />
        <SummaryMetric label="source systems" value={joinLimited(sourceSystems, 3)} />
      </div>

      <DetailsBlock label={`View ${sources.length} source metadata record${sources.length === 1 ? "" : "s"}`}>
        {sources.map((source) => (
          <SourceMetadataCard key={source.source_id} source={source} />
        ))}
      </DetailsBlock>
    </CompactDisclosure>
  );
}

export function ContractStateSections({ data }: { data: PipelineResponse }) {
  const humanReviewHandoffs = data.human_review_handoffs ?? [];
  const sourceMetadata = data.source_metadata ?? [];
  const hasHumanReviewHandoffs = humanReviewHandoffs.length > 0;
  const hasSourceMetadata = sourceMetadata.length > 0;

  if (!hasHumanReviewHandoffs && !hasSourceMetadata) return null;

  return (
    <div className="mx-auto w-full max-w-5xl shrink-0 space-y-2 px-4 py-2">
      {hasHumanReviewHandoffs && <HumanReviewSummary handoffs={humanReviewHandoffs} />}
      {hasSourceMetadata && <SourceMetadataSummary sources={sourceMetadata} />}
    </div>
  );
}
