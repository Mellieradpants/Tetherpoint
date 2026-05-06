import type { PipelineResponse } from "../Workspace";
import {
  safeArray,
  displayStatus,
  rawStatus,
} from "./shared";
export function OriginTab({ data }: { data: PipelineResponse }) {
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
