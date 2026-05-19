import { useEffect, useMemo, useState } from "react";
import type {
  GovernanceCheckResult,
  MeaningNodeResult,
  PipelineResponse,
  RuleUnitReferencedSource,
  VerificationNode,
} from "../../types/pipeline";
import { PlainMeaningTranslation } from "./MeaningTab";
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
import { DOCUMENT_NAVIGATOR_ZONES } from "./document-navigator-shell-contract";

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
  sourceNodeIds: string[];
};

type SelectedLayerContext = {
  meaning?: MeaningNodeResult;
  verification?: VerificationNode;
  governanceIssues: GovernanceCheckResult[];
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

function normalizedText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

function sameSourceText(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizedText(left);
  const normalizedRight = normalizedText(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function includesSelectedId(ids: string[], candidate: string | null | undefined): boolean {
  return Boolean(candidate && ids.includes(candidate));
}

function excerptLabel(value: string | null | undefined, fallback: string): string {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 92 ? `${text.slice(0, 89)}...` : text;
}

function sourceTypeLabel(data: PipelineResponse): string {
  const supportPath = (data as PipelineResponseWithDocumentFirst).document_first_v2;
  if (supportPath?.status === "executed") return "document packet";
  return data.input?.content_type || "source text";
}

function sourceNameLabel(data: PipelineResponse): string {
  const supportPath = (data as PipelineResponseWithDocumentFirst).document_first_v2;
  const candidate = safeArray(supportPath?.rule_unit_candidates?.candidates).find((item) =>
    item.document_id?.trim(),
  );
  const originSignal = [
    ...safeArray(data.origin?.origin_identity_signals),
    ...safeArray(data.origin?.origin_metadata_signals),
  ].find((signal) => signal.value?.trim());

  return candidate?.document_id || originSignal?.value || "Submitted document";
}

function sourceDocumentText(data: PipelineResponse): string {
  if (data.input?.raw_content?.trim()) return data.input.raw_content;

  const nodeText = safeArray(data.structure?.nodes)
    .map((node) => node.source_text || node.normalized_text)
    .filter(present)
    .join("\n\n");

  return nodeText;
}

function buildNavigatorItems(data: PipelineResponse): NavigatorItem[] {
  const supportPath = (data as PipelineResponseWithDocumentFirst).document_first_v2;
  const candidates = safeArray(supportPath?.rule_unit_candidates?.candidates).filter((candidate) =>
    candidate.source_text?.trim(),
  );

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
        label: excerptLabel(candidate.source_text, `Document passage ${index + 1}`),
        sublabel:
          [
            sourceAnchor?.page_number ? `Page ${sourceAnchor.page_number}` : "",
            sourceAnchor?.block_id ? `Block ${sourceAnchor.block_id}` : "",
          ]
            .filter(present)
            .join(" / ") || "Document-first passage",
        sourceText: candidate.source_text || "",
        status: candidate.assembly_status,
        nodeId: candidate.structural_node_id,
        references: [],
        support,
        sourceNodeIds: candidate.structural_node_id ? [candidate.structural_node_id] : [],
      };
    });
  }

  return safeArray(data.rule_units?.rule_units)
    .filter((unit) => (unit.source_text_combined || unit.primary_text || "").trim())
    .map((unit, index) => ({
      id: `rule-${unit.rule_unit_id || index}`,
      kind: "rule_unit",
      label: excerptLabel(unit.primary_text || unit.source_text_combined, `Rule ${index + 1}`),
      sublabel: unit.section_id ? `Section ${unit.section_id}` : "Rule unit",
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
      sourceNodeIds: [
        unit.primary_node_id,
        ...safeArray(unit.source_node_ids),
        ...safeArray(unit.fragment_node_ids),
      ].filter(present),
    }));
}

function resolveSelectedLayers(
  data: PipelineResponse,
  selected: NavigatorItem,
): SelectedLayerContext {
  const selectedIds = [selected.ruleUnitId, selected.nodeId, ...selected.sourceNodeIds].filter(
    present,
  );

  const meaning = safeArray(data.meaning?.node_results).find(
    (result) =>
      includesSelectedId(selectedIds, result.node_id) ||
      sameSourceText(result.source_text, selected.sourceText),
  );
  const verification = safeArray(data.verification?.node_results).find(
    (result) =>
      includesSelectedId(selectedIds, result.rule_unit_id) ||
      includesSelectedId(selectedIds, result.node_id),
  );
  const governanceIssues = safeArray(data.governance?.activeIssues).filter((issue) => {
    const issueText = [
      issue.checkName,
      issue.status,
      issue.issue,
      ...safeArray(issue.missingFields),
    ]
      .join(" ")
      .toLowerCase();

    return selectedIds.some((id) => issueText.includes(id.toLowerCase()));
  });

  return { meaning, verification, governanceIssues };
}

function referenceStatus(reference: NavigatorReference, hasUnresolvedReferences: boolean): string {
  if (
    hasUnresolvedReferences &&
    (rawStatus(reference.retrievalStatus) === "not_attempted" || !reference.sourceText?.trim())
  ) {
    return "detected / not checked";
  }

  return displayStatus(reference.retrievalStatus || "detected");
}

function hasSelectedUnresolvedReferences(selected: NavigatorItem): boolean {
  return selected.references.some(
    (reference) =>
      rawStatus(reference.retrievalStatus) === "not_attempted" || !reference.sourceText?.trim(),
  );
}

function selectedMeaningText(data: PipelineResponse, layers: SelectedLayerContext): string {
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const atomicReferenceLabel = hasUnresolvedReferences
    ? "source reference"
    : "source-backed result";
  return hideAtomicReferences(layers.meaning?.plain_meaning || "", atomicReferenceLabel);
}

function SelectedMeaning({
  data,
  selected,
  layers,
}: {
  data: PipelineResponse;
  selected: NavigatorItem;
  layers: SelectedLayerContext;
}) {
  const meaningText = selectedMeaningText(data, layers);
  const paragraphs = splitParagraphs(meaningText);

  if (!layers.meaning) {
    return (
      <EmptyState>
        Meaning skipped for this selected passage or not attached yet. See Technical Trace for
        backend details.
      </EmptyState>
    );
  }

  if (layers.meaning.error || layers.meaning.message) {
    const statusMessage = layers.meaning.error || layers.meaning.message;
    return (
      <div className="space-y-3">
        {paragraphs.length > 0 ? (
          <div className="space-y-3 text-sm leading-6 text-foreground">
            {paragraphs.map((paragraph, index) => (
              <p key={`selected-meaning-${index}`}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <EmptyState>No plain meaning is attached to this selected passage yet.</EmptyState>
        )}
        <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
          {statusMessage}
        </div>
      </div>
    );
  }

  if (paragraphs.length === 0)
    return <EmptyState>No plain meaning is attached to this selected passage yet.</EmptyState>;

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground">
      {paragraphs.map((paragraph, index) => (
        <p key={`selected-meaning-${index}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function StatusPanel({
  data,
  selected,
  layers,
}: {
  data: PipelineResponse;
  selected: NavigatorItem;
  layers: SelectedLayerContext;
}) {
  const hasUnresolvedReferences = hasSelectedUnresolvedReferences(selected);
  const governanceStatus = layers.governanceIssues.length
    ? "needs_review"
    : hasUnresolvedReferences
      ? "review_required"
      : (data.governance?.status ?? data.output?.governance_status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill
          label={selected.kind === "candidate" ? "candidate" : "rule unit"}
          status={selected.status}
        />
        <StatusPill label="meaning" status={layers.meaning?.status || "not_attached"} />
        {layers.verification?.verification_path_available && (
          <StatusPill label="path" status="available" />
        )}
        <StatusPill label="governance" status={governanceStatus} />
      </div>

      {hasUnresolvedReferences && (
        <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
          Referenced sources are detected and not checked. Governance needs review until referenced
          source text is retrieved.
        </div>
      )}

      {layers.governanceIssues.length > 0 && (
        <div className="space-y-2">
          {layers.governanceIssues.map((issue, index) => (
            <DetailRow
              key={`selected-governance-${index}`}
              label={issue.checkName || "governance issue"}
              value={issue.issue || displayStatus(issue.status)}
            />
          ))}
        </div>
      )}

      {layers.verification && (
        <div className="space-y-2">
          {layers.verification.assertion_type && (
            <DetailRow
              label="assertion"
              value={displayStatus(layers.verification.assertion_type)}
            />
          )}
          {safeArray(layers.verification.expected_record_systems).length > 0 && (
            <DetailRow
              label="record route"
              value={safeArray(layers.verification.expected_record_systems).join(", ")}
            />
          )}
          {layers.verification.verification_notes && (
            <DetailRow
              label="verification note"
              value={hideAtomicReferences(
                layers.verification.verification_notes,
                hasUnresolvedReferences ? "source reference" : "source-backed result",
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

function WholeDocumentOverview({ data, itemCount }: { data: PipelineResponse; itemCount: number }) {
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const jurisdiction = data.jurisdiction_context;
  const governanceStatus = hasUnresolvedReferences
    ? "review_required"
    : (data.governance?.status ?? data.output?.governance_status);
  const unresolvedCount =
    safeArray(data.origin?.referenced_sources).length +
    safeArray(data.governance?.activeIssues).length;
  const sourceText = sourceDocumentText(data);

  return (
    <section className="rounded-xl border border-border/60 bg-surface p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
        {DOCUMENT_NAVIGATOR_ZONES.whole_document_overview.label}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="text-lg font-semibold text-foreground">{sourceNameLabel(data)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill label="source type" status={sourceTypeLabel(data)} />
            <StatusPill
              label="overall"
              status={safeArray(data.errors).length ? "needs_review" : "ready"}
            />
            <StatusPill label="governance" status={governanceStatus} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DetailRow label="mapped items" value={itemCount} />
          <DetailRow
            label="jurisdiction"
            value={jurisdiction?.user_selected_state || "I don't know"}
          />
          <DetailRow
            label="jurisdiction status"
            value={
              jurisdiction?.jurisdiction_status
                ? displayStatus(jurisdiction.jurisdiction_status)
                : "Not returned"
            }
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div
          className={`rounded-lg border p-3 text-sm leading-6 ${toneClass(hasUnresolvedReferences || unresolvedCount > 0 ? "review" : "neutral")}`}
        >
          {hasUnresolvedReferences || unresolvedCount > 0
            ? "Unresolved references or governance checks are available in the attached layers for review."
            : "No unresolved references or governance issues are surfaced for the overview."}
        </div>
        <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-sm leading-6 text-muted-foreground">
          Federal, state, and local source relevance belongs in the attached layers when future
          checks are added.
        </div>
      </div>

      {sourceText && (
        <details className="mt-4 rounded-lg border border-border/60 bg-background/30 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            View submitted source document
          </summary>
          <div className="mt-3 max-h-96 overflow-auto">
            <SourceQuote>{sourceText}</SourceQuote>
          </div>
        </details>
      )}
    </section>
  );
}

function ReferenceList({ selected }: { selected: NavigatorItem }) {
  const hasUnresolvedReferences = hasSelectedUnresolvedReferences(selected);
  const references = selected.references;

  if (references.length === 0)
    return <EmptyState>No referenced sources are attached to this selection.</EmptyState>;

  return (
    <div className="space-y-3">
      {references.map((reference, index) => (
        <div
          key={`${reference.name}-${index}`}
          className="rounded-lg border border-border/50 bg-background/30 p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">{reference.name}</div>
              {reference.referenceType && (
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {displayStatus(reference.referenceType)}
                </div>
              )}
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${toneClass(hasUnresolvedReferences ? "review" : "neutral")}`}
            >
              {referenceStatus(reference, hasUnresolvedReferences)}
            </span>
          </div>
          {reference.detectedText && (
            <div className="mt-3 text-sm leading-6 text-muted-foreground">
              Detected text: {reference.detectedText}
            </div>
          )}
          {reference.sourceText && (
            <div className="mt-3">
              <SourceQuote>{reference.sourceText}</SourceQuote>
            </div>
          )}
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
      <div className="space-y-4">
        <WholeDocumentOverview data={data} itemCount={0} />
        <section className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
            {DOCUMENT_NAVIGATOR_ZONES.document_map.label}
          </div>
          <EmptyState>
            No selectable sections, passages, rule units, or document-first candidates were
            returned.
          </EmptyState>
        </section>
      </div>
    );
  }

  const layers = resolveSelectedLayers(data, selected);
  const meaningText = selectedMeaningText(data, layers);

  return (
    <section className="space-y-4">
      <WholeDocumentOverview data={data} itemCount={items.length} />

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <div className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
            {DOCUMENT_NAVIGATOR_ZONES.document_map.label}
          </div>
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
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {item.kind === "candidate" ? "Candidate" : "Rule"} {index + 1}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {displayStatus(item.status)}
                    </span>
                  </div>
                  <div className="mt-2 break-words text-sm font-semibold leading-5 text-foreground">
                    {item.label}
                  </div>
                  <div className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                    {item.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
            {DOCUMENT_NAVIGATOR_ZONES.selected_passage.label}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusPill
              label={selected.kind === "candidate" ? "candidate" : "rule unit"}
              status={selected.status}
            />
            {selected.sublabel && <StatusPill label="location" status={selected.sublabel} />}
          </div>
          <SourceQuote>{selected.sourceText}</SourceQuote>
        </div>

        <div>
          <div className="rounded-xl border border-border/60 bg-surface p-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
              {DOCUMENT_NAVIGATOR_ZONES.attached_layers_panel.label}
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Plain Meaning
                </div>
                <SelectedMeaning data={data} selected={selected} layers={layers} />
              </div>

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Translation
                </div>
                {meaningText ? (
                  <PlainMeaningTranslation
                    text={meaningText}
                    hasUnresolvedReferences={hasSelectedUnresolvedReferences(selected)}
                    embedded
                  />
                ) : (
                  <EmptyState>
                    Translation is available after plain meaning is attached to this selected
                    passage.
                  </EmptyState>
                )}
              </div>

              <StatusPanel data={data} selected={selected} layers={layers} />

              {supportItems.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Source support
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {supportItems.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className="rounded-full border border-border/60 bg-background/30 px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  References
                </div>
                <ReferenceList selected={selected} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
