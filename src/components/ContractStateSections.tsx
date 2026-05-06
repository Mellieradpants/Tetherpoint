import type { HumanReviewHandoff, SourceMetadataContract } from "../lib/api-client";
import type { PipelineResponse } from "./ReceiptWorkspace";

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function displayStatus(value: string | boolean | null | undefined): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (!value) return "Not returned";
  return value.replaceAll("_", " ");
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

function HumanReviewCard({ handoff }: { handoff: HumanReviewHandoff }) {
  const anchorsMissing = safeArray(handoff.anchors_missing);
  const sourceObjects = safeArray(handoff.source_objects);
  const dependencies = safeArray(handoff.dependencies);

  return (
    <div className="rounded-lg border border-gold/50 bg-gold/10 p-3">
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

export function ContractStateSections({ data }: { data: PipelineResponse }) {
  const humanReviewHandoffs = data.human_review_handoffs ?? [];
  const sourceMetadata = data.source_metadata ?? [];
  const hasHumanReviewHandoffs = humanReviewHandoffs.length > 0;
  const hasSourceMetadata = sourceMetadata.length > 0;

  if (!hasHumanReviewHandoffs && !hasSourceMetadata) return null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      {hasHumanReviewHandoffs && (
        <section className="rounded-xl border border-gold/50 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Human Review Handoff</div>
          <div className="space-y-3">
            {humanReviewHandoffs.map((handoff) => (
              <HumanReviewCard key={handoff.handoff_id} handoff={handoff} />
            ))}
          </div>
        </section>
      )}

      {hasSourceMetadata && (
        <section className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Source Metadata Contract</div>
          <div className="space-y-3">
            {sourceMetadata.map((source) => (
              <SourceMetadataCard key={source.source_id} source={source} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
