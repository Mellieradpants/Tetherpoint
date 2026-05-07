import type { PipelineResponse } from "../Workspace";
import {
  safeArray,
  displayStatus,
  Section,
  DetailRow,
  EmptyState,
  SourceQuote,
  hideAtomicReferences,
  ruleTextById,
} from "./shared"; 

export function VerificationTab({ data }: { data: PipelineResponse }) {
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
