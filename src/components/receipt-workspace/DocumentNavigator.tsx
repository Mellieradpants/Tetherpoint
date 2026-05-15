import { useEffect, useMemo, useState } from "react";
import type { PipelineResponse, RuleUnitReferencedSource } from "../../types/pipeline";
import {
  DetailRow,
  EmptyState,
  SourceQuote,
  StatusPill,
  displayStatus,
  hasUnresolvedReferencedSources,
  hideAtomicReferences,
  rawStatus,
  safeArray,
  splitParagraphs,
  toneClass,
} from "./shared";

type SupportSourceAnchor = {
  document_id?: string | null;
  page_number?: number | null;
  block_id?: string | null;
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

type PipelineResponseWithDocumentFirst = PipelineResponse & {
  document_first_v2?: {
    status?: string | null;
    rule_unit_candidates?: {
      candidates?: SupportRuleUnitCandidate[] | null;
      candidate_count?: number | null;
    } | null;
  } | null;
};

type NavigatorReference = {
  name: string;
  referenceType?: string | null;
  detectedText?: string | null;
  retrievalStatus?: string | null;
  sourceText?: string | null;
};

type NavigatorItem = {
  id: string;
  kind: "candidate" | "rule_unit";
  label: string;
  sublabel: string;
  sourceText: string;
  status?: string | null;
  ruleUnitId?: string | null;
  nodeId?: string | null;
  references: NavigatorReference[];
  support: string[];
};

function fromRuleReference(reference: RuleUnitReferencedSource): NavigatorReference {
  return {
    name: reference.name,
    referenceType: reference.referenceType,
    detectedText: reference.matchedText,
    retrievalStatus: reference.retrievalStatus,
    sourceText: reference.sourceText,
  };
}

function present(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function buildNavigatorItems(data: PipelineResponse): NavigatorItem[] {
  const supportPath = (data as PipelineResponseWithDocumentFirst).document_first_v2;
  const candidates = safeArray(supportPath?.rule_unit_candidates?.candidates).filter((candidate) => candidate.source_text?.trim());

  if (supportPath?.status === "executed" && candidates.length > 0) {
    return candidates.map((candidate, index) => {
      const sourceAnchor = candidate.source_anchor;
      const support = [
        ...safeArray(candidate.signal_types),
        ...safeArray(candidate.assembly_notes),
        sourceAnchor?.block_id ? `Block ${sourceAnchor.block_id}` : "",
      ].filter(present);

      return {
        id: `candidate-${candidate.candidate_id || index}`,
        kind: "candidate",
        label: candidate.candidate_id || `Candidate ${index + 1}`,
        sublabel: sourceAnchor?.document_id || candidate.document_id || "Document-first candidate",
        sourceText: candidate.source_text || "",
        status: candidate.assembly_status,
        nodeId: candidate.structural_node_id,
        references: [],
        support,
      };
    });
  }

  return safeArray(data.rule_units?.rule_units)
    .filter((unit) => (unit.source_text_combined || unit.primary_text || "").trim())
    .map((unit, index) => ({
      id: `rule-${unit.rule_unit_id || index}`,
      kind: "rule_unit",
      label: unit.rule_unit_id || `Rule unit ${index + 1}`,
      sublabel: unit.section_id || "Rule unit",
      sourceText: unit.source_text_combined || unit.primary_text || "",
      status: unit.review_status || unit.assembly_status,
      ruleUnitId: unit.rule_unit_id,
      nodeId: unit.primary_node_id,
      references: safeArray(unit.referenced_sources).map(fromRuleReference),
      support: [
        ...safeArray(unit.assembly_issues),
        unit.meaning_eligible ? "Meaning available" : "Meaning needs review",
        unit.verification_eligible ? "Verification path available" : "Verification not available",
      ],
    }));
}

function referenceStatus(reference: NavigatorReference, hasUnresolvedReferences: boolean): string {
  if (hasUnresolvedReferences && (rawStatus(reference.retrievalStatus) === "not_attempted" || !reference.sourceText?.trim())) {
    return "detected / not checked";
  }

  return displayStatus(reference.retrievalStatus || "detected");
}

function SelectedMeaning({ data, selected }: { data: PipelineResponse; selected: NavigatorItem }) {
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const atomicReferenceLabel = hasUnresolvedReferences ? "source reference" : "source-backed result";
  const nodeMeaning = safeArray(data.meaning?.node_results).find((result) => (
    result.node_id === selected.ruleUnitId || result.node_id === selected.nodeId
  ));
  const meaningText = nodeMeaning?.plain_meaning || (selected.kind === "candidate" ? "" : data.meaning?.overall_plain_meaning) || data.meaning?.message || "";
  const paragraphs = splitParagraphs(hideAtomicReferences(meaningText, atomicReferenceLabel));

  if (paragraphs.length === 0) return <EmptyState>No plain meaning is attached to this selection yet.</EmptyState>;

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground">
      {paragraphs.map((paragraph, index) => <p key={`selected-meaning-${index}`}>{paragraph}</p>)}
    </div>
  );
}

function StatusPanel({ data, selected }: { data: PipelineResponse; selected: NavigatorItem }) {
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const governanceStatus = hasUnresolvedReferences ? "review_required" : data.governance?.status ?? data.output?.governance_status;
  const verificationResult = safeArray(data.verification?.node_results).find((result) => (
    result.rule_unit_id === selected.ruleUnitId || result.node_id === selected.ruleUnitId || result.node_id === selected.nodeId
  ));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill label={selected.kind === "candidate" ? "candidate" : "rule unit"} status={selected.status} />
        <StatusPill label="meaning" status={data.meaning?.status} />
        {verificationResult?.verification_path_available && <StatusPill label="path" status="available" />}
        <StatusPill label="governance" status={governanceStatus} />
      </div>

      {hasUnresolvedReferences && (
        <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
          Referenced sources are detected and not checked. Governance needs review until referenced source text is retrieved.
        </div>
      )}

      {verificationResult && (
        <div className="space-y-2">
          {verificationResult.assertion_type && <DetailRow label="assertion" value={displayStatus(verificationResult.assertion_type)} />}
          {safeArray(verificationResult.expected_record_systems).length > 0 && (
            <DetailRow label="record route" value={safeArray(verificationResult.expected_record_systems).join(", ")} />
          )}
          {verificationResult.verification_notes && <DetailRow label="verification note" value={hideAtomicReferences(verificationResult.verification_notes, hasUnresolvedReferences ? "source reference" : "source-backed result")} />}
        </div>
      )}
    </div>
  );
}

function ReferenceList({ data, selected }: { data: PipelineResponse; selected: NavigatorItem }) {
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const references = selected.references.length > 0
    ? selected.references
    : safeArray(data.origin?.referenced_sources).map((source) => ({
      name: source.name,
      referenceType: source.reference_type,
      detectedText: source.matched_text,
      retrievalStatus: hasUnresolvedReferences ? "not_attempted" : source.status,
    }));

  if (references.length === 0) return <EmptyState>No referenced sources are attached to this selection.</EmptyState>;

  return (
    <div className="space-y-3">
      {references.map((reference, index) => (
        <div key={`${reference.name}-${index}`} className="rounded-lg border border-border/50 bg-background/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">{reference.name}</div>
              {reference.referenceType && <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{displayStatus(reference.referenceType)}</div>}
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${toneClass(hasUnresolvedReferences ? "review" : "neutral")}`}>
              {referenceStatus(reference, hasUnresolvedReferences)}
            </span>
          </div>
          {reference.detectedText && <div className="mt-3 text-sm leading-6 text-muted-foreground">Detected text: {reference.detectedText}</div>}
          {reference.sourceText && <div className="mt-3"><SourceQuote>{reference.sourceText}</SourceQuote></div>}
        </div>
      ))}
    </div>
  );
}

export function DocumentNavigator({ data }: { data: PipelineResponse }) {
  const items = useMemo(() => buildNavigatorItems(data), [data]);
  const [selectedId, setSelectedId] = useState(items[0]?.id || "");

  useEffect(() => {
    if (!items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id || "");
  }, [items, selectedId]);

  const selected = items.find((item) => item.id === selectedId) || items[0];
  const supportItems = selected ? selected.support.filter(present).slice(0, 6) : [];

  if (!selected) {
    return (
      <section className="rounded-xl border border-border/60 bg-surface p-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Document Map</div>
        <EmptyState>No selectable sections, passages, rule units, or document-first candidates were returned.</EmptyState>
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      <div className="rounded-xl border border-border/60 bg-surface p-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Document Map</div>
        <div className="space-y-2">
          {items.map((item, index) => {
            const active = item.id === selected.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? "border-gold/50 bg-gold/10" : "border-border/50 bg-background/30 hover:border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{item.kind === "candidate" ? "Candidate" : "Rule"} {index + 1}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{displayStatus(item.status)}</span>
                </div>
                <div className="mt-2 break-words text-sm font-semibold leading-5 text-foreground">{item.label}</div>
                <div className="mt-1 break-words text-xs leading-5 text-muted-foreground">{item.sublabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-surface p-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Source Text / Selected Passage</div>
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusPill label={selected.kind === "candidate" ? "candidate" : "rule unit"} status={selected.status} />
        </div>
        <SourceQuote>{selected.sourceText}</SourceQuote>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Plain Meaning</div>
          <SelectedMeaning data={data} selected={selected} />
        </div>

        <div className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Source / References / Status</div>
          <div className="space-y-4">
            <StatusPanel data={data} selected={selected} />

            {supportItems.length > 0 && (
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Source support</div>
                <div className="flex flex-wrap gap-2">
                  {supportItems.map((item, index) => (
                    <span key={`${item}-${index}`} className="rounded-full border border-border/60 bg-background/30 px-2.5 py-1 text-xs text-muted-foreground">{item}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">References</div>
              <ReferenceList data={data} selected={selected} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
