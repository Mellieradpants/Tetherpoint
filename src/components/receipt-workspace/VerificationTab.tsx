import type { PipelineResponse } from "../../types/pipeline";
import {
  safeArray,
  displayStatus,
  Section,
  StatusPill,
  DetailRow,
  EmptyState,
  SourceQuote,
  hideAtomicReferences,
  ruleTextById,
  hasUnresolvedReferencedSources,
} from "./shared"; 

export function VerificationTab({ data }: { data: PipelineResponse }) {
  const sourceByRule = ruleTextById(data);
  const results = safeArray(data.verification?.node_results);
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const atomicReferenceLabel = hasUnresolvedReferences ? "source reference" : "source-backed result";
  const visibleResults = results.filter((result) => (
    result.assertion_detected ||
    result.verification_path_available ||
    safeArray(result.expected_record_systems).length > 0
  ));
  const routed = results.filter((result) => safeArray(result.expected_record_systems).length > 0);
  const checkedLabel = hasUnresolvedReferences ? "0 checked result(s)" : `${results.length} backed result(s)`;
  const routedLabel = hasUnresolvedReferences
    ? routed.length > 0 ? `${routed.length} path(s) available / not executed` : "not executed"
    : `${routed.length} backed result(s)`;

  return (
    <div className="space-y-4">
      <Section title="Verification Summary">
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailRow label="status" value={displayStatus(data.verification?.status)} />
          <DetailRow label="checked" value={checkedLabel} />
          <DetailRow label="routed" value={routedLabel} />
        </div>
      </Section>

      <Section title="Verification Routes">
        {visibleResults.length > 0 ? (
          <div className="space-y-3">
            {visibleResults.map((result, index) => {
              const systems = safeArray(result.expected_record_systems);
              const sourceText = sourceByRule.get(result.rule_unit_id || result.node_id);
              const notes = hideAtomicReferences(result.verification_notes, atomicReferenceLabel);
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
