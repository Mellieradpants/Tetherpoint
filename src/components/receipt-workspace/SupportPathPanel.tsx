import type { PipelineResponse } from "../../types/pipeline";
import { EmptyState, Section, StatusPill, safeArray } from "./shared";

type SupportSourceAnchor = {
  anchor_id?: string | null;
  source_type?: string | null;
  document_id?: string | null;
  page_number?: number | null;
  block_id?: string | null;
  char_start?: number | null;
  char_end?: number | null;
  source_path?: string | null;
};

type SupportDocumentStructure = {
  document_id?: string | null;
  nodes?: unknown[] | null;
};

type SupportSemanticStructure = {
  document_id?: string | null;
  signals?: unknown[] | null;
  signal_count?: number | null;
};

type SupportSelectionV2 = {
  document_id?: string | null;
  selected_signals?: unknown[] | null;
  excluded_signals?: unknown[] | null;
  selected_count?: number | null;
  excluded_count?: number | null;
};

type SupportRuleUnitCandidate = {
  candidate_id?: string | null;
  document_id?: string | null;
  structural_node_id?: string | null;
  source_anchor?: SupportSourceAnchor | null;
  source_text?: string | null;
  selected_signal_ids?: string[] | null;
  signal_types?: string[] | null;
  anchor_texts?: string[] | null;
  assembly_status?: string | null;
  assembly_notes?: string[] | null;
};

type SupportRuleUnitCandidates = {
  document_id?: string | null;
  candidates?: SupportRuleUnitCandidate[] | null;
  candidate_count?: number | null;
  assembly_log?: string[] | null;
};

type DocumentFirstV2Result = {
  status?: "executed" | "skipped" | "error" | string | null;
  document_structure?: SupportDocumentStructure | null;
  semantic_structure?: SupportSemanticStructure | null;
  selection_v2?: SupportSelectionV2 | null;
  rule_unit_candidates?: SupportRuleUnitCandidates | null;
  error?: string | null;
};

type PipelineResponseWithDocumentFirst = PipelineResponse & {
  document_first_v2?: DocumentFirstV2Result | null;
};

function valueOrMissing(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not returned";
  return String(value);
}

function countFromSource(explicitCount: number | null | undefined, items: unknown[] | null | undefined): number {
  return typeof explicitCount === "number" ? explicitCount : safeArray(items).length;
}

function SupportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/35 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SupportDetail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="border-b border-border/40 py-2 last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{valueOrMissing(value)}</div>
    </div>
  );
}

function SupportChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

function DocumentFirstModeNotice() {
  return (
    <div className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm leading-6 text-gold-muted">
      Document-first inspection mode is running. Support objects are visible below. Meaning, Origin, Verification, and Governance are not connected to this document-first path yet.
    </div>
  );
}

export function SupportPathPanel({ data }: { data: PipelineResponse }) {
  const supportPath = (data as PipelineResponseWithDocumentFirst).document_first_v2;

  if (!supportPath) return null;

  if (supportPath.status === "skipped") {
    return (
      <Section title="Support Path">
        <EmptyState>Support Path not run for this input.</EmptyState>
      </Section>
    );
  }

  if (supportPath.status === "error") {
    return (
      <Section title="Support Path">
        <div className="space-y-3">
          <StatusPill label="document_first_v2" status={supportPath.status} />
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
            {supportPath.error || "Support Path returned an error without a message."}
          </div>
        </div>
      </Section>
    );
  }

  if (supportPath.status !== "executed") return null;

  const documentStructure = supportPath.document_structure;
  const semanticStructure = supportPath.semantic_structure;
  const selectionV2 = supportPath.selection_v2;
  const ruleUnitCandidates = supportPath.rule_unit_candidates;
  const candidates = safeArray(ruleUnitCandidates?.candidates);

  return (
    <Section title="Support Path">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusPill label="document_first_v2" status={supportPath.status} />
        </div>

        <DocumentFirstModeNotice />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SupportMetric label="Document nodes" value={safeArray(documentStructure?.nodes).length} />
          <SupportMetric label="Semantic signals" value={countFromSource(semanticStructure?.signal_count, semanticStructure?.signals)} />
          <SupportMetric label="Selected" value={countFromSource(selectionV2?.selected_count, selectionV2?.selected_signals)} />
          <SupportMetric label="Excluded" value={countFromSource(selectionV2?.excluded_count, selectionV2?.excluded_signals)} />
          <SupportMetric label="Candidates" value={countFromSource(ruleUnitCandidates?.candidate_count, candidates)} />
        </div>

        {candidates.length === 0 ? (
          <EmptyState>No rule-unit candidates returned.</EmptyState>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate, index) => {
              const sourceAnchor = candidate.source_anchor;
              const signalTypes = safeArray(candidate.signal_types);
              const anchorTexts = safeArray(candidate.anchor_texts);

              return (
                <div key={candidate.candidate_id || `candidate-${index}`} className="rounded-lg border border-border/50 bg-background/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Candidate ID</div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{valueOrMissing(candidate.candidate_id)}</div>
                    </div>
                    <StatusPill label="assembly" status={candidate.assembly_status} />
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Signal types</div>
                      <SupportChipList items={signalTypes} empty="No signal types returned." />
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Anchor texts</div>
                      <SupportChipList items={anchorTexts} empty="No anchor texts returned." />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Source text</div>
                    {candidate.source_text ? (
                      <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm leading-6 text-foreground">
                        {candidate.source_text}
                      </div>
                    ) : (
                      <EmptyState>No source text returned.</EmptyState>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-border/50 bg-background/20 p-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Source anchor</div>
                    <SupportDetail label="document ID" value={sourceAnchor?.document_id} />
                    <SupportDetail label="page number" value={sourceAnchor?.page_number} />
                    <SupportDetail label="block ID" value={sourceAnchor?.block_id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
