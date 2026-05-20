import { useEffect, useMemo, useState } from "react";
import type {
  DocumentFirstRuleUnitCandidate,
  DocumentFirstSourceAnchor,
  DocumentFirstStructureNode,
  GovernanceCheckResult,
  MeaningNodeResult,
  PipelineResponse,
  RuleUnit,
  RuleUnitReferencedSource,
  VerificationNode,
} from "../../types/pipeline";
import { ANSWER_LANGUAGE_OPTIONS } from "./answer-language";
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

type NavigatorReference = {
  name: string;
  referenceType?: string | null;
  detectedText?: string | null;
  retrievalStatus?: string | null;
  sourceText?: string | null;
};

type NavigatorBlock = {
  id: string;
  kind: "document_block" | "candidate" | "rule_unit" | "structure_node" | "raw_document";
  label: string;
  navLabel: string;
  sublabel: string;
  sourceText: string;
  pageNumber?: number | null;
  blockId?: string | null;
  sectionId?: string | null;
  status?: string | null;
  ruleUnitId?: string | null;
  nodeId?: string | null;
  references: NavigatorReference[];
  support: string[];
  sourceNodeIds: string[];
  order: number;
};

type SelectedLayerContext = {
  meaning?: MeaningNodeResult;
  verification?: VerificationNode;
  governanceIssues: GovernanceCheckResult[];
};

type InspectorTab = "meaning" | "source" | "references" | "status";

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

function fromRuleReference(reference: RuleUnitReferencedSource): NavigatorReference {
  return {
    name: reference.name,
    referenceType: reference.referenceType,
    detectedText: reference.matchedText,
    retrievalStatus: reference.retrievalStatus,
    sourceText: reference.sourceText,
  };
}

function sourceTypeLabel(data: PipelineResponse): string {
  if (data.document_first_v2?.status === "executed") return "document packet";
  return data.input?.content_type || "source text";
}

function sourceNameLabel(data: PipelineResponse): string {
  const candidate = safeArray(data.document_first_v2?.rule_unit_candidates?.candidates).find(
    (item) => item.document_id?.trim(),
  );
  const structureNode = safeArray(data.document_first_v2?.document_structure?.nodes).find((node) =>
    node.document_id?.trim(),
  );
  const originSignal = [
    ...safeArray(data.origin?.origin_identity_signals),
    ...safeArray(data.origin?.origin_metadata_signals),
  ].find((signal) => signal.value?.trim());

  return (
    candidate?.document_id ||
    structureNode?.document_id ||
    originSignal?.value ||
    "Submitted document"
  );
}

function anchorLabel(anchor: DocumentFirstSourceAnchor | null | undefined): string {
  return (
    [
      anchor?.page_number ? `Page ${anchor.page_number}` : "",
      anchor?.block_id ? `Block ${anchor.block_id}` : "",
    ]
      .filter(present)
      .join(" / ") || "Document block"
  );
}

function statusForDocumentFirst(data: PipelineResponse): string {
  const supportPath = data.document_first_v2;
  if (!supportPath) return "not returned";
  if (supportPath.status === "executed") return "mapped";
  return supportPath.status || "not returned";
}

function sourceMappingStatus(data: PipelineResponse): string {
  const candidates = safeArray(data.document_first_v2?.rule_unit_candidates?.candidates);
  if (data.document_first_v2?.status === "executed") {
    return candidates.length ? `${candidates.length} attached passage(s)` : "document mapped";
  }
  if (safeArray(data.rule_units?.rule_units).length) return "mapped sections";
  if (safeArray(data.structure?.nodes).length) return "mapped text";
  return "source text";
}

function candidateByNodeId(candidates: DocumentFirstRuleUnitCandidate[]) {
  const map = new Map<string, DocumentFirstRuleUnitCandidate>();
  candidates.forEach((candidate) => {
    if (candidate.structural_node_id) map.set(candidate.structural_node_id, candidate);
  });
  return map;
}

function candidateSupport(
  candidate: DocumentFirstRuleUnitCandidate | null | undefined,
  anchor: DocumentFirstSourceAnchor | null | undefined,
): string[] {
  if (!candidate) return [];
  return [
    ...safeArray(candidate.signal_types),
    ...safeArray(candidate.assembly_notes),
    anchor?.block_id ? `Block ${anchor.block_id}` : "",
  ].filter(present);
}

function documentFirstBlocks(data: PipelineResponse): NavigatorBlock[] {
  const nodes = safeArray(data.document_first_v2?.document_structure?.nodes);
  const candidates = safeArray(data.document_first_v2?.rule_unit_candidates?.candidates);
  const candidatesByNodeId = candidateByNodeId(candidates);

  return nodes
    .filter((node) => {
      const text = node.source_text || node.normalized_text || "";
      return (
        Boolean(text.trim()) &&
        node.structural_type !== "document" &&
        node.structural_type !== "page"
      );
    })
    .map((node, index) => {
      const candidate = candidatesByNodeId.get(node.structural_node_id);
      const anchor = node.source_anchor || candidate?.source_anchor;
      const text = node.source_text || node.normalized_text || "";
      const blockId = node.block_id || anchor?.block_id;
      const pageNumber = node.page_number ?? anchor?.page_number;
      const blockType = node.block_type || node.structural_type || "block";

      return {
        id: node.structural_node_id,
        kind: candidate ? "candidate" : "document_block",
        label: excerptLabel(text, `Document block ${index + 1}`),
        navLabel: `${displayStatus(blockType)} ${index + 1}`,
        sublabel: anchorLabel(anchor),
        sourceText: text,
        pageNumber,
        blockId,
        status: candidate?.assembly_status || data.document_first_v2?.status,
        nodeId: node.structural_node_id,
        references: [],
        support: candidateSupport(candidate, anchor),
        sourceNodeIds: [node.structural_node_id],
        order: node.order ?? index + 1,
      };
    });
}

function ruleUnitBlock(unit: RuleUnit, index: number): NavigatorBlock {
  const text = unit.source_text_combined || unit.primary_text || "";
  return {
    id: `rule-${unit.rule_unit_id || index}`,
    kind: "rule_unit",
    label: excerptLabel(unit.primary_text || unit.source_text_combined, `Rule ${index + 1}`),
    navLabel: `Section ${index + 1}`,
    sublabel: unit.section_id ? `Section ${unit.section_id}` : "Mapped passage",
    sourceText: text,
    sectionId: unit.section_id,
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
    order: index + 1,
  };
}

function legacyStructureBlocks(data: PipelineResponse): NavigatorBlock[] {
  return safeArray(data.structure?.nodes)
    .filter((node) => (node.source_text || node.normalized_text || "").trim())
    .map((node, index) => ({
      id: `structure-${node.node_id || index}`,
      kind: "structure_node",
      label: excerptLabel(node.source_text || node.normalized_text, `Section ${index + 1}`),
      navLabel: `Section ${index + 1}`,
      sublabel: node.section_id ? `Section ${node.section_id}` : "Structure node",
      sourceText: node.source_text || node.normalized_text || "",
      sectionId: node.section_id,
      status: node.validation_status,
      nodeId: node.node_id,
      references: [],
      support: safeArray(node.validation_errors),
      sourceNodeIds: [node.node_id].filter(present),
      order: index + 1,
    }));
}

function rawDocumentBlock(data: PipelineResponse): NavigatorBlock[] {
  const text = data.input?.raw_content || "";
  if (!text.trim()) return [];

  return [
    {
      id: "raw-document",
      kind: "raw_document",
      label: "Submitted source document",
      navLabel: "Document",
      sublabel: "Raw source",
      sourceText: text,
      status: data.input?.parse_status,
      references: [],
      support: safeArray(data.input?.parse_errors),
      sourceNodeIds: [],
      order: 1,
    },
  ];
}

function buildDocumentBlocks(data: PipelineResponse): NavigatorBlock[] {
  const documentFirst = documentFirstBlocks(data);
  if (documentFirst.length > 0) return documentFirst;

  const rules = safeArray(data.rule_units?.rule_units)
    .filter((unit) => (unit.source_text_combined || unit.primary_text || "").trim())
    .map(ruleUnitBlock);
  if (rules.length > 0) return rules;

  const structure = legacyStructureBlocks(data);
  if (structure.length > 0) return structure;

  return rawDocumentBlock(data);
}

function pageKey(block: NavigatorBlock): string {
  return block.pageNumber ? `page-${block.pageNumber}` : "document";
}

function pageLabel(block: NavigatorBlock): string {
  return block.pageNumber ? `Page ${block.pageNumber}` : "Document";
}

function groupBlocksByPage(blocks: NavigatorBlock[]) {
  const groups = new Map<string, { label: string; blocks: NavigatorBlock[] }>();

  blocks.forEach((block) => {
    const key = pageKey(block);
    if (!groups.has(key)) groups.set(key, { label: pageLabel(block), blocks: [] });
    groups.get(key)?.blocks.push(block);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    blocks: group.blocks.sort((left, right) => left.order - right.order),
  }));
}

function resolveSelectedLayers(
  data: PipelineResponse,
  selected: NavigatorBlock,
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
      includesSelectedId(selectedIds, result.node_id) ||
      safeArray(result.source_node_ids).some((id) => selectedIds.includes(id)),
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

function hasSelectedUnresolvedReferences(selected: NavigatorBlock): boolean {
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

function answerLanguageLabel(language: string): string {
  return ANSWER_LANGUAGE_OPTIONS.find((option) => option.code === language)?.label || "English";
}

function selectedPageLabel(selected: NavigatorBlock): string {
  return selected.pageNumber ? `Page ${selected.pageNumber}` : "Document";
}

function blockElementId(id: string): string {
  return `document-block-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function localLawStatus(data: PipelineResponse, selected: NavigatorBlock): string {
  const jurisdiction = data.jurisdiction_context;
  const references = selected.references.map((reference) =>
    `${reference.name} ${reference.referenceType || ""}`.toLowerCase(),
  );
  const hasLocalReference = references.some(
    (reference) =>
      reference.includes("state") ||
      reference.includes("local") ||
      reference.includes("municipal") ||
      reference.includes("ordinance"),
  );

  if (hasLocalReference && hasSelectedUnresolvedReferences(selected)) return "needs_review";
  if (!jurisdiction?.user_selected_state && !jurisdiction?.document_detected_state)
    return "not_checked";
  if (
    ["conflict", "unclear", "needs_review", "missing"].includes(jurisdiction.jurisdiction_status)
  ) {
    return "needs_review";
  }
  return "not_checked";
}

function localLawMessage(data: PipelineResponse): string {
  const jurisdiction = data.jurisdiction_context;
  const state = jurisdiction?.user_selected_state || jurisdiction?.document_detected_state;

  if (!state) {
    return "Choose a jurisdiction to focus state and local-law review for this selected section.";
  }

  return `Focus local-law review on ${state}. State and local sources are shown as review items when the analysis returns them; this is not a legal check.`;
}

function WholeDocumentOverview({ data, itemCount }: { data: PipelineResponse; itemCount: number }) {
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const jurisdiction = data.jurisdiction_context;
  const governanceStatus = hasUnresolvedReferences
    ? "review_required"
    : (data.governance?.status ?? data.output?.governance_status);

  return (
    <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-sm">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
        {DOCUMENT_NAVIGATOR_ZONES.whole_document_overview.label}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="text-lg font-semibold text-foreground">{sourceNameLabel(data)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill label="source type" status={sourceTypeLabel(data)} />
            <StatusPill label="source mapping" status={sourceMappingStatus(data)} />
            <StatusPill label="governance" status={governanceStatus} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DetailRow label="document blocks" value={itemCount} />
          <DetailRow
            label="jurisdiction"
            value={jurisdiction?.user_selected_state || "I don't know"}
          />
          <DetailRow label="processing" value={displayStatus(statusForDocumentFirst(data))} />
        </div>
      </div>
    </section>
  );
}

function SelectedMeaning({
  data,
  layers,
}: {
  data: PipelineResponse;
  layers: SelectedLayerContext;
}) {
  const meaningText = selectedMeaningText(data, layers);
  const paragraphs = splitParagraphs(meaningText);

  if (!layers.meaning) {
    return (
      <EmptyState>
        Meaning is not attached to this selected passage yet. Technical Trace keeps the raw
        processing details.
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

function ReferenceList({ selected }: { selected: NavigatorBlock }) {
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

function StatusPanel({
  data,
  selected,
  layers,
}: {
  data: PipelineResponse;
  selected: NavigatorBlock;
  layers: SelectedLayerContext;
}) {
  const hasUnresolvedReferences = hasSelectedUnresolvedReferences(selected);
  const selectedGovernanceStatus = layers.governanceIssues.length ? "needs_review" : "not_attached";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill label="selection" status={selected.status || selected.kind} />
        <StatusPill label="meaning" status={layers.meaning?.status || "not_attached"} />
        {layers.verification?.verification_path_available && (
          <StatusPill label="path" status="available" />
        )}
        <StatusPill label="governance" status={selectedGovernanceStatus} />
      </div>

      {hasUnresolvedReferences && (
        <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
          Referenced sources are detected and not checked. Governance needs review until referenced
          source text is retrieved.
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

function SourceDocumentViewer({
  pages,
  selected,
  onSelect,
}: {
  pages: Array<{ label: string; blocks: NavigatorBlock[] }>;
  selected: NavigatorBlock;
  onSelect: (id: string) => void;
}) {
  const selectedPage = selected.pageNumber ?? pages[0]?.blocks[0]?.pageNumber ?? 1;
  const pageCount = pages.length || 1;

  useEffect(() => {
    document.getElementById(blockElementId(selected.id))?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [selected.id]);

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-surface shadow-md lg:min-h-[44rem]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <span className="font-semibold">Page</span>
          <span className="rounded-md border border-border bg-surface-raised px-3 py-1.5 font-semibold">
            {selectedPage}
          </span>
          <span className="text-muted-foreground">of {pageCount}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            Fit Width
          </span>
          {selected.sublabel && <StatusPill label="active" status={selected.sublabel} />}
        </div>
      </div>

      <div className="bg-surface-raised/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
        Original source text is shown unchanged. Select a block to inspect meaning, source support,
        jurisdiction, local-law focus, and status.
      </div>

      <div className="max-h-[68vh] space-y-6 overflow-y-auto bg-surface-raised/70 p-4 pr-2">
        {pages.map((page) => {
          const pageActive = page.blocks.some((block) => block.id === selected.id);

          return (
            <section
              key={page.label}
              className={`mx-auto max-w-3xl space-y-4 rounded-md border bg-white px-8 py-7 shadow-sm ${
                pageActive ? "border-primary/40" : "border-border/80"
              }`}
            >
              <div className="border-b border-border/60 pb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {page.label}
              </div>
              <div className="space-y-4">
                {page.blocks.map((block) => {
                  const active = block.id === selected.id;
                  return (
                    <button
                      key={block.id}
                      id={blockElementId(block.id)}
                      type="button"
                      onClick={() => onSelect(block.id)}
                      aria-pressed={active}
                      className={`w-full rounded-md border p-4 text-left transition-colors ${
                        active
                          ? "border-gold/70 bg-gold/20 shadow-[0_0_0_2px_rgba(216,168,71,0.18)]"
                          : "border-transparent bg-white hover:border-border hover:bg-surface-raised/45"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border/70 bg-surface-raised px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {block.sublabel}
                        </span>
                        {block.sectionId && (
                          <span className="rounded-full border border-border/70 bg-surface-raised px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Section {block.sectionId}
                          </span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap break-words font-serif text-[17px] leading-9 text-foreground">
                        {block.sourceText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex gap-3 overflow-x-auto border-t border-border/70 bg-surface px-4 py-3">
        {pages.map((page, index) => {
          const firstBlock = page.blocks[0];
          const active = page.blocks.some((block) => block.id === selected.id);
          return (
            <button
              key={`thumb-${page.label}`}
              type="button"
              onClick={() => firstBlock && onSelect(firstBlock.id)}
              className={`h-20 w-16 shrink-0 rounded-md border bg-white p-2 text-center text-[10px] shadow-sm transition-colors ${
                active ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <div className="mx-auto mb-2 h-10 w-8 rounded-sm bg-surface-raised" />
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DocumentNavigation({
  data,
  blocks,
  selected,
  query,
  onQueryChange,
  onSelect,
}: {
  data: PipelineResponse;
  blocks: NavigatorBlock[];
  selected: NavigatorBlock;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const normalizedQuery = normalizedText(query);
  const visibleBlocks = normalizedQuery
    ? blocks.filter((block) =>
        normalizedText(`${block.label} ${block.sublabel} ${block.sourceText}`).includes(
          normalizedQuery,
        ),
      )
    : blocks;
  const pages = new Set(blocks.map(pageKey)).size;
  const jurisdiction = data.jurisdiction_context;

  return (
    <aside className="rounded-lg border border-border/70 bg-surface p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="mb-4 text-sm font-semibold text-muted-foreground">Navigation</div>

      <div className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-semibold text-foreground hover:bg-surface-raised"
        >
          Document Overview
          <span className="text-xs text-primary">Ready</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-semibold text-foreground hover:bg-surface-raised"
        >
          Pages
          <span className="text-xs text-muted-foreground">{pages}</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-semibold text-foreground hover:bg-surface-raised"
        >
          Sections
          <span className="text-xs text-muted-foreground">{blocks.length}</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="pages" value={pages} />
          <DetailRow label="blocks" value={blocks.length} />
        </div>
        <DetailRow
          label="jurisdiction"
          value={jurisdiction?.user_selected_state || "I don't know"}
        />
        <DetailRow label="source mapping" value={sourceMappingStatus(data)} />

        <label className="block text-sm font-medium text-foreground">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Search document
          </span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search source text"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Document Outline
          </div>
          <div className="space-y-2">
            {visibleBlocks.map((block, index) => {
              const active = block.id === selected.id;
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => onSelect(block.id)}
                  aria-pressed={active}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-primary/45 bg-accent/60"
                      : "border-border/60 bg-surface-raised/60 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {block.navLabel || `Block ${index + 1}`}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {displayStatus(block.status)}
                    </span>
                  </div>
                  <div className="mt-2 break-words text-sm font-semibold leading-5 text-foreground">
                    {block.label}
                  </div>
                  <div className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                    {block.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-surface-raised/70 p-3">
          <div className="mb-2 text-sm font-semibold text-foreground">Document Status</div>
          <div className="space-y-2 text-xs leading-5 text-muted-foreground">
            <div>All returned pages processed</div>
            <div>Text layer: Extracted</div>
            <div>Source mapping: {sourceMappingStatus(data)}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AttachedLayersInspector({
  data,
  selected,
  layers,
  answerLanguage,
}: {
  data: PipelineResponse;
  selected: NavigatorBlock;
  layers: SelectedLayerContext;
  answerLanguage: string;
}) {
  const meaningText = selectedMeaningText(data, layers);
  const supportItems = selected.support.filter(present).slice(0, 6);
  const jurisdiction = data.jurisdiction_context;
  const [activeTab, setActiveTab] = useState<InspectorTab>("meaning");
  const referenceCount = selected.references.length;
  const localStatus = localLawStatus(data, selected);
  const selectedLocation = [
    selectedPageLabel(selected),
    selected.blockId ? `Block ${selected.blockId}` : "",
    selected.sectionId ? `Section ${selected.sectionId}` : "",
  ]
    .filter(present)
    .join(" / ");

  return (
    <aside className="overflow-hidden rounded-lg border border-border/70 bg-surface shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="grid grid-cols-4 border-b border-border/70 bg-surface">
        {(["meaning", "source", "references", "status"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={`border-b-2 px-2 py-3 text-xs font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {tab === "references" && referenceCount > 0 ? ` (${referenceCount})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-4">
        {activeTab === "meaning" && (
          <>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Plain Meaning</div>
              <SelectedMeaning data={data} layers={layers} />
              {meaningText && (
                <div className="mt-3">
                  <PlainMeaningTranslation
                    text={meaningText}
                    hasUnresolvedReferences={hasSelectedUnresolvedReferences(selected)}
                    language={answerLanguage}
                    showLanguageControl={false}
                    embedded
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-primary/20 bg-accent/45 p-3">
              <div className="mb-2 text-sm font-semibold text-foreground">
                What this means for you
              </div>
              <ul className="space-y-2 text-sm leading-6 text-foreground">
                <li>Read this selected section together with its source details.</li>
                <li>Check local-law status before relying on any requirement or deadline.</li>
              </ul>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">
                What the document says
              </div>
              <SourceQuote>{selected.sourceText}</SourceQuote>
            </div>
          </>
        )}

        {activeTab === "source" && (
          <>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Source Details</div>
              <div className="space-y-2">
                <DetailRow label="document" value={sourceNameLabel(data)} />
                <DetailRow label="location" value={selectedLocation || selected.sublabel} />
                <DetailRow label="block" value={selected.blockId || "Not returned"} />
                <DetailRow label="section" value={selected.sectionId || "Not returned"} />
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Original Source Text</div>
              <SourceQuote>{selected.sourceText}</SourceQuote>
            </div>
          </>
        )}

        {activeTab === "references" && (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">References Detected</span>
                <span className="rounded-full bg-surface-raised px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {referenceCount}
                </span>
              </div>
              <ReferenceList selected={selected} />
            </div>

            <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
              State, local, and municipal sources are surfaced here when the analysis returns them.
              If they are not returned, treat local-law review as not checked.
            </div>
          </>
        )}

        {activeTab === "status" && (
          <>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Status</div>
              <StatusPanel data={data} selected={selected} layers={layers} />
            </div>

            <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground">State & local law focus</span>
                <StatusPill label="local law" status={localStatus} />
              </div>
              <p>{localLawMessage(data)}</p>
              <p className="mt-2">
                Possible next check: ask whether this selected section is affected by state or local
                law for the chosen jurisdiction.
              </p>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Jurisdiction</div>
              <div className="space-y-2">
                <DetailRow
                  label="selected context"
                  value={jurisdiction?.user_selected_state || "I don't know"}
                />
                <DetailRow
                  label="detected context"
                  value={jurisdiction?.document_detected_state || "Not returned"}
                />
                <DetailRow
                  label="status"
                  value={
                    jurisdiction?.jurisdiction_status
                      ? displayStatus(jurisdiction.jurisdiction_status)
                      : "Not returned"
                  }
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Governance</div>
              {layers.governanceIssues.length > 0 ? (
                <div className="space-y-2">
                  {layers.governanceIssues.map((issue, index) => (
                    <DetailRow
                      key={`selected-governance-${index}`}
                      label={issue.checkName || "governance issue"}
                      value={issue.issue || displayStatus(issue.status)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState>
                  No governance flags are attached to this selected passage yet.
                </EmptyState>
              )}
            </div>
          </>
        )}

        {activeTab !== "status" && (
          <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-foreground">State & local law focus</span>
              <StatusPill label="local law" status={localStatus} />
            </div>
            <p>{localLawMessage(data)}</p>
          </div>
        )}

        {supportItems.length > 0 && activeTab !== "source" && (
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

        <div className={`rounded-md border p-3 text-sm leading-6 ${toneClass("neutral")}`}>
          Possible next checks can be generated in {answerLanguageLabel(answerLanguage)} from the
          selected passage and its attached status. They are not legal advice.
        </div>
      </div>
    </aside>
  );
}

export function DocumentNavigator({
  data,
  answerLanguage,
}: {
  data: PipelineResponse;
  answerLanguage: string;
}) {
  const blocks = useMemo(() => buildDocumentBlocks(data), [data]);
  const pages = useMemo(() => groupBlocksByPage(blocks), [blocks]);
  const [selectedId, setSelectedId] = useState(blocks[0]?.id || "");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!blocks.some((block) => block.id === selectedId)) setSelectedId(blocks[0]?.id || "");
  }, [blocks, selectedId]);

  const selected = blocks.find((block) => block.id === selectedId) || blocks[0];

  if (!selected) {
    return (
      <div className="space-y-4">
        <WholeDocumentOverview data={data} itemCount={0} />
        <section className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
            {DOCUMENT_NAVIGATOR_ZONES.source_document_viewer.label}
          </div>
          <EmptyState>No source document text was returned.</EmptyState>
        </section>
      </div>
    );
  }

  const layers = resolveSelectedLayers(data, selected);

  return (
    <section className="space-y-4">
      <WholeDocumentOverview data={data} itemCount={blocks.length} />

      <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1.55fr)_21rem]">
        <DocumentNavigation
          data={data}
          blocks={blocks}
          selected={selected}
          query={query}
          onQueryChange={setQuery}
          onSelect={setSelectedId}
        />
        <SourceDocumentViewer pages={pages} selected={selected} onSelect={setSelectedId} />
        <AttachedLayersInspector
          data={data}
          selected={selected}
          layers={layers}
          answerLanguage={answerLanguage}
        />
      </div>
    </section>
  );
}
