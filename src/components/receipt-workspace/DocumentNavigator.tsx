import { useEffect, useMemo, useState } from "react";
import type {
  DocumentFirstRuleUnitCandidate,
  DocumentFirstSourceAnchor,
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

type NavigatorReference = {
  name: string;
  referenceType?: string | null;
  detectedText?: string | null;
  retrievalStatus?: string | null;
  sourceText?: string | null;
};

type NavigatorBlock = {
  id: string;
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
  return text.length > 86 ? `${text.slice(0, 83)}...` : text;
}

function readableSignal(value: string): string {
  return displayStatus(value.replace(/_/g, " "));
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
  return anchor?.page_number ? `Page ${anchor.page_number}` : "Document";
}

function candidateByNodeId(candidates: DocumentFirstRuleUnitCandidate[]) {
  const map = new Map<string, DocumentFirstRuleUnitCandidate>();
  candidates.forEach((candidate) => {
    if (candidate.structural_node_id) map.set(candidate.structural_node_id, candidate);
  });
  return map;
}

function candidateSupport(candidate: DocumentFirstRuleUnitCandidate | null | undefined): string[] {
  if (!candidate) return [];
  return safeArray(candidate.signal_types).map(readableSignal).filter(present);
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
      const pageNumber = node.page_number ?? anchor?.page_number;

      return {
        id: node.structural_node_id,
        label: excerptLabel(text, `Section ${index + 1}`),
        navLabel: `Section ${index + 1}`,
        sublabel: anchorLabel(anchor),
        sourceText: text,
        pageNumber,
        blockId: node.block_id || anchor?.block_id,
        status: candidate?.assembly_status || data.document_first_v2?.status,
        nodeId: node.structural_node_id,
        references: [],
        support: candidateSupport(candidate),
        sourceNodeIds: [node.structural_node_id],
        order: node.order ?? index + 1,
      };
    });
}

function ruleUnitBlock(unit: RuleUnit, index: number): NavigatorBlock {
  const text = unit.source_text_combined || unit.primary_text || "";
  return {
    id: `rule-${unit.rule_unit_id || index}`,
    label: excerptLabel(unit.primary_text || unit.source_text_combined, `Section ${index + 1}`),
    navLabel: `Section ${index + 1}`,
    sublabel: unit.section_id ? `Section ${unit.section_id}` : "Mapped section",
    sourceText: text,
    sectionId: unit.section_id,
    status: unit.review_status || unit.assembly_status,
    ruleUnitId: unit.rule_unit_id,
    nodeId: unit.primary_node_id,
    references: safeArray(unit.referenced_sources).map(fromRuleReference),
    support: safeArray(unit.assembly_issues).map(readableSignal),
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
      label: excerptLabel(node.source_text || node.normalized_text, `Section ${index + 1}`),
      navLabel: `Section ${index + 1}`,
      sublabel: node.section_id ? `Section ${node.section_id}` : "Document section",
      sourceText: node.source_text || node.normalized_text || "",
      sectionId: node.section_id,
      status: node.validation_status,
      nodeId: node.node_id,
      references: [],
      support: safeArray(node.validation_errors).map(readableSignal),
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
      label: "Submitted document",
      navLabel: "Document",
      sublabel: "Original text",
      sourceText: text,
      status: data.input?.parse_status,
      references: [],
      support: safeArray(data.input?.parse_errors).map(readableSignal),
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
    return "not checked";
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
  return "not_checked";
}

function localLawMessage(data: PipelineResponse): string {
  const jurisdiction = data.jurisdiction_context;
  const state = jurisdiction?.user_selected_state || jurisdiction?.document_detected_state;

  if (!state) {
    return "State and local law have not been checked. Select a jurisdiction to make this review focus clearer.";
  }

  return `State selected: ${state}. State and local law have not been checked yet.`;
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

  if (!layers.meaning || paragraphs.length === 0) {
    return <EmptyState>No plain-language explanation is attached to this section yet.</EmptyState>;
  }

  if (layers.meaning.error || layers.meaning.message) {
    const statusMessage = layers.meaning.error || layers.meaning.message;
    return (
      <div className="space-y-3">
        <div className="space-y-3 text-sm leading-6 text-foreground">
          {paragraphs.map((paragraph, index) => (
            <p key={`selected-meaning-${index}`}>{paragraph}</p>
          ))}
        </div>
        <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
          {statusMessage}
        </div>
      </div>
    );
  }

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
    return <EmptyState>No referenced sources are attached to this section.</EmptyState>;

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
  selected,
  layers,
}: {
  selected: NavigatorBlock;
  layers: SelectedLayerContext;
}) {
  const selectedGovernanceStatus = layers.governanceIssues.length ? "needs_review" : "not_attached";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusPill label="meaning" status={layers.meaning ? "available" : "not attached"} />
        <StatusPill label="governance" status={selectedGovernanceStatus} />
        <StatusPill label="references" status={selected.references.length ? "detected" : "not attached"} />
      </div>

      <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("neutral")}`}>
        This status applies only to the selected section. Open Technical Trace for raw processing
        details.
      </div>
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
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-surface shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <span className="font-semibold">Page</span>
          <span className="rounded-md border border-border bg-surface-raised px-3 py-1.5 font-semibold">
            {selectedPage}
          </span>
          <span className="text-muted-foreground">of {pageCount}</span>
        </div>
        <span className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          Fit Width
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised/70 p-5">
        {pages.map((page) => {
          const pageActive = page.blocks.some((block) => block.id === selected.id);

          return (
            <article
              key={page.label}
              className={`mx-auto mb-6 max-w-3xl rounded-md border bg-white px-10 py-8 shadow-sm ${
                pageActive ? "border-primary/40" : "border-border/80"
              }`}
            >
              <div className="mb-5 border-b border-border/60 pb-3 text-xs font-semibold text-muted-foreground">
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
                      className={`w-full rounded-md p-4 text-left transition-colors ${
                        active
                          ? "bg-gold/25 shadow-[inset_4px_0_0_rgba(216,168,71,0.9)]"
                          : "bg-white hover:bg-surface-raised/50"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words font-serif text-[17px] leading-9 text-foreground">
                        {block.sourceText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex shrink-0 gap-3 overflow-x-auto border-t border-border/70 bg-surface px-4 py-3">
        {pages.map((page, index) => {
          const firstBlock = page.blocks[0];
          const active = page.blocks.some((block) => block.id === selected.id);
          return (
            <button
              key={`thumb-${page.label}`}
              type="button"
              onClick={() => firstBlock && onSelect(firstBlock.id)}
              className={`h-16 w-12 shrink-0 rounded-md border bg-white p-2 text-center text-[10px] shadow-sm transition-colors ${
                active ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <div className="mx-auto mb-1 h-8 w-6 rounded-sm bg-surface-raised" />
              {index + 1}
            </button>
          );
        })}
      </div>
    </section>
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
    <aside className="min-h-0 overflow-y-auto rounded-lg border border-border/70 bg-surface p-4 shadow-sm">
      <div className="mb-4 text-sm font-semibold text-muted-foreground">Navigation</div>

      <div className="space-y-3">
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
            Document outline
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
                    <span className="text-xs font-semibold text-muted-foreground">
                      Section {index + 1}
                    </span>
                    {block.pageNumber && (
                      <span className="text-xs text-muted-foreground">Page {block.pageNumber}</span>
                    )}
                  </div>
                  <div className="mt-2 break-words text-sm font-semibold leading-5 text-foreground">
                    {block.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-surface-raised/70 p-3">
          <div className="mb-2 text-sm font-semibold text-foreground">Document status</div>
          <div className="space-y-2 text-xs leading-5 text-muted-foreground">
            <div>Pages shown: {pages}</div>
            <div>Sections found: {blocks.length}</div>
            <div>State focus: {jurisdiction?.user_selected_state || "I don't know"}</div>
            <div>Text found and ready to review</div>
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
  const supportItems = selected.support.filter(present).slice(0, 4);
  const jurisdiction = data.jurisdiction_context;
  const [activeTab, setActiveTab] = useState<InspectorTab>("meaning");
  const referenceCount = selected.references.length;
  const localStatus = localLawStatus(data, selected);
  const selectedLocation = [
    selected.pageNumber ? `Page ${selected.pageNumber}` : "",
    selected.sectionId ? `Section ${selected.sectionId}` : "",
  ]
    .filter(present)
    .join(" / ");

  return (
    <aside className="min-h-0 overflow-y-auto rounded-lg border border-border/70 bg-surface shadow-sm">
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
              <div className="mb-2 text-sm font-semibold text-foreground">Plain meaning</div>
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
              <div className="mb-2 text-sm font-semibold text-foreground">What to check</div>
              <ul className="space-y-2 text-sm leading-6 text-foreground">
                <li>Use the source quote below to keep the explanation tied to the document.</li>
                <li>State and local law are not checked unless a source appears under References.</li>
              </ul>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">What the document says</div>
              <SourceQuote>{selected.sourceText}</SourceQuote>
            </div>
          </>
        )}

        {activeTab === "source" && (
          <>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Source details</div>
              <div className="space-y-2">
                <DetailRow label="document" value={sourceNameLabel(data)} />
                <DetailRow label="location" value={selectedLocation || selected.sublabel} />
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Original source text</div>
              <SourceQuote>{selected.sourceText}</SourceQuote>
            </div>
          </>
        )}

        {activeTab === "references" && (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">References detected</span>
                <span className="rounded-full bg-surface-raised px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {referenceCount}
                </span>
              </div>
              <ReferenceList selected={selected} />
            </div>

            <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
              State, local, and municipal sources appear here only when returned by the analysis.
              If none appear, treat state/local law as not checked.
            </div>
          </>
        )}

        {activeTab === "status" && (
          <>
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Selected section status</div>
              <StatusPanel selected={selected} layers={layers} />
            </div>

            <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground">State & local law</span>
                <StatusPill label="law check" status={localStatus} />
              </div>
              <p>{localLawMessage(data)}</p>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Jurisdiction</div>
              <div className="space-y-2">
                <DetailRow
                  label="selected state"
                  value={jurisdiction?.user_selected_state || "I don't know"}
                />
                <DetailRow
                  label="found in document"
                  value={jurisdiction?.document_detected_state || "Not found"}
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
                      label={issue.checkName || "review item"}
                      value={issue.issue || displayStatus(issue.status)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState>No governance flags are attached to this section.</EmptyState>
              )}
            </div>
          </>
        )}

        {activeTab !== "status" && (
          <div className={`rounded-lg border p-3 text-sm leading-6 ${toneClass("review")}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-foreground">State & local law</span>
              <StatusPill label="law check" status={localStatus} />
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
          Helpful output can be generated in {answerLanguageLabel(answerLanguage)}. Source text stays
          unchanged.
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
      <section className="h-full min-h-0 rounded-xl border border-border/60 bg-surface p-4">
        <EmptyState>No source document text was returned.</EmptyState>
      </section>
    );
  }

  const layers = resolveSelectedLayers(data, selected);

  return (
    <section className="h-full min-h-0">
      <div className="grid h-full min-h-[42rem] gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_23rem]">
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
