import { useEffect, useMemo, useState } from "react";
import type {
  DocumentFirstRuleUnitCandidate,
  DocumentFirstSourceAnchor,
  DocumentFirstStructureNode,
  MeaningNodeResult,
  PipelineResponse,
  RuleUnit,
  StructureNode,
} from "../../types/pipeline";
import {
  EmptyState,
  hasUnresolvedReferencedSources,
  hideAtomicReferences,
  safeArray,
  splitParagraphs,
} from "./shared";

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
  ruleUnitId?: string | null;
  nodeId?: string | null;
  sourceNodeIds: string[];
  order: number;
};

type TranslatedBlock = {
  block: NavigatorBlock;
  meaning?: MeaningNodeResult;
  text: string;
  missingInformation: string[];
};

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
      .join(" / ") || "Document passage"
  );
}

function candidateByNodeId(candidates: DocumentFirstRuleUnitCandidate[]) {
  const map = new Map<string, DocumentFirstRuleUnitCandidate>();
  candidates.forEach((candidate) => {
    if (candidate.structural_node_id) map.set(candidate.structural_node_id, candidate);
  });
  return map;
}

function documentFirstBlocks(data: PipelineResponse): NavigatorBlock[] {
  const nodes = safeArray(data.document_first_v2?.document_structure?.nodes);
  const candidates = safeArray(data.document_first_v2?.rule_unit_candidates?.candidates);
  const candidatesByNodeId = candidateByNodeId(candidates);

  return nodes
    .filter((node: DocumentFirstStructureNode) => {
      const text = node.source_text || node.normalized_text || "";
      return (
        Boolean(text.trim()) &&
        node.structural_type !== "document" &&
        node.structural_type !== "page"
      );
    })
    .map((node: DocumentFirstStructureNode, index: number) => {
      const candidate = candidatesByNodeId.get(node.structural_node_id);
      const anchor = node.source_anchor || candidate?.source_anchor;
      const text = node.source_text || node.normalized_text || "";
      const blockId = node.block_id || anchor?.block_id;
      const pageNumber = node.page_number ?? anchor?.page_number;
      const blockType = node.block_type || node.structural_type || "passage";

      return {
        id: node.structural_node_id,
        kind: candidate ? "candidate" : "document_block",
        label: excerptLabel(text, `Passage ${index + 1}`),
        navLabel: `${blockType.replaceAll("_", " ")} ${index + 1}`,
        sublabel: anchorLabel(anchor),
        sourceText: text,
        pageNumber,
        blockId,
        nodeId: node.structural_node_id,
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
    label: excerptLabel(unit.primary_text || unit.source_text_combined, `Passage ${index + 1}`),
    navLabel: `Passage ${index + 1}`,
    sublabel: unit.section_id ? `Section ${unit.section_id}` : "Mapped passage",
    sourceText: text,
    sectionId: unit.section_id,
    ruleUnitId: unit.rule_unit_id,
    nodeId: unit.primary_node_id,
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
    .filter((node: StructureNode) => (node.source_text || node.normalized_text || "").trim())
    .map((node: StructureNode, index: number) => ({
      id: `structure-${node.node_id || index}`,
      kind: "structure_node",
      label: excerptLabel(node.source_text || node.normalized_text, `Passage ${index + 1}`),
      navLabel: `Passage ${index + 1}`,
      sublabel: node.section_id ? `Section ${node.section_id}` : "Document passage",
      sourceText: node.source_text || node.normalized_text || "",
      sectionId: node.section_id,
      nodeId: node.node_id,
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
      label: "Submitted document",
      navLabel: "Document",
      sublabel: "Original source",
      sourceText: text,
      sourceNodeIds: [],
      order: 1,
    },
  ];
}

function buildDocumentBlocks(data: PipelineResponse): NavigatorBlock[] {
  const documentFirst = documentFirstBlocks(data);
  if (documentFirst.length > 0) return documentFirst;

  const rules = safeArray(data.rule_units?.rule_units)
    .filter((unit: RuleUnit) => (unit.source_text_combined || unit.primary_text || "").trim())
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

function selectedIds(block: NavigatorBlock): string[] {
  return [block.ruleUnitId, block.nodeId, ...block.sourceNodeIds].filter(present);
}

function meaningForBlock(data: PipelineResponse, block: NavigatorBlock): MeaningNodeResult | undefined {
  const ids = selectedIds(block);

  return safeArray(data.meaning?.node_results).find(
    (result) =>
      includesSelectedId(ids, result.node_id) || sameSourceText(result.source_text, block.sourceText),
  );
}

function meaningText(data: PipelineResponse, block: NavigatorBlock): string {
  const meaning = meaningForBlock(data, block);
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const atomicReferenceLabel = hasUnresolvedReferences
    ? "source reference"
    : "source-backed result";
  return hideAtomicReferences(meaning?.plain_meaning || "", atomicReferenceLabel);
}

function buildTranslatedBlocks(data: PipelineResponse, blocks: NavigatorBlock[]): TranslatedBlock[] {
  return blocks.map((block) => {
    const meaning = meaningForBlock(data, block);
    return {
      block,
      meaning,
      text: meaningText(data, block),
      missingInformation: safeArray(meaning?.missing_information),
    };
  });
}

function DocumentIntro({ data, itemCount }: { data: PipelineResponse; itemCount: number }) {
  return (
    <section className="rounded-xl border border-border/70 bg-surface p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-primary">
            Meaning Diff Document Navigator
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Translate the meaning
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Read the original document beside a plain-language meaning version. The source text stays
            unchanged; the translated side explains what the selected wording means.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm leading-6 text-muted-foreground lg:min-w-64">
          <div className="font-semibold text-foreground">{sourceNameLabel(data)}</div>
          <div>{itemCount} passage{itemCount === 1 ? "" : "s"} available</div>
        </div>
      </div>
    </section>
  );
}

function DocumentMap({
  blocks,
  selected,
  query,
  onQueryChange,
  onSelect,
}: {
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

  return (
    <section className="rounded-xl border border-border/70 bg-surface p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
            Document map
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Choose a passage to keep the original wording and plain meaning aligned.
          </p>
        </div>
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
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {visibleBlocks.map((block, index) => {
          const active = block.id === selected.id;
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelect(block.id)}
              aria-pressed={active}
              className={`min-w-52 rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-primary/50 bg-accent/65"
                  : "border-border/60 bg-surface-raised/60 hover:border-border"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {block.navLabel || `Passage ${index + 1}`}
              </div>
              <div className="mt-2 text-sm font-medium leading-5 text-foreground">
                {block.label}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{block.sublabel}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function OriginalDocument({
  pages,
  selected,
  onSelect,
}: {
  pages: Array<{ label: string; blocks: NavigatorBlock[] }>;
  selected: NavigatorBlock;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-surface p-4 shadow-md lg:min-h-[42rem]">
      <div className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
          Original document
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Exact document wording. Select any passage to align the meaning document.
        </p>
      </div>

      <div className="max-h-[74vh] space-y-6 overflow-y-auto rounded-lg bg-surface-raised/70 p-4 pr-2">
        {pages.map((page) => (
          <section
            key={page.label}
            className="mx-auto max-w-3xl space-y-3 rounded-md border border-border/80 bg-white px-5 py-5 shadow-sm"
          >
            <div className="sticky top-0 z-10 border-b border-border/60 bg-white/95 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {page.label}
            </div>
            <div className="space-y-3">
              {page.blocks.map((block) => {
                const active = block.id === selected.id;
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => onSelect(block.id)}
                    aria-pressed={active}
                    className={`w-full rounded-md border p-4 text-left transition-colors ${
                      active
                        ? "border-primary/60 bg-accent/55 shadow-[0_0_0_2px_rgba(43,129,157,0.14)]"
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
                    <div className="whitespace-pre-wrap break-words font-serif text-[15px] leading-8 text-foreground">
                      {block.sourceText}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function MeaningPassage({
  translated,
  active,
  onSelect,
}: {
  translated: TranslatedBlock;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const paragraphs = splitParagraphs(translated.text);
  const statusMessage = translated.meaning?.error || translated.meaning?.message || "";

  return (
    <button
      type="button"
      onClick={() => onSelect(translated.block.id)}
      aria-pressed={active}
      className={`w-full rounded-md border p-4 text-left transition-colors ${
        active
          ? "border-primary/60 bg-accent/50 shadow-[0_0_0_2px_rgba(43,129,157,0.14)]"
          : "border-border/60 bg-white hover:border-border hover:bg-surface-raised/45"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border/70 bg-surface-raised px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {translated.block.sublabel}
        </span>
        {translated.block.sectionId && (
          <span className="rounded-full border border-border/70 bg-surface-raised px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Section {translated.block.sectionId}
          </span>
        )}
      </div>

      {paragraphs.length > 0 ? (
        <div className="space-y-3 text-sm leading-7 text-foreground">
          {paragraphs.map((paragraph, index) => (
            <p key={`${translated.block.id}-meaning-${index}`}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <EmptyState>No plain meaning is attached to this passage yet.</EmptyState>
      )}

      {statusMessage && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{statusMessage}</p>
      )}

      {translated.missingInformation.length > 0 && (
        <div className="mt-3 rounded-md border border-border/60 bg-surface-raised/60 p-3 text-xs leading-5 text-muted-foreground">
          Missing context: {translated.missingInformation.join(", ")}
        </div>
      )}
    </button>
  );
}

function TranslatedMeaningDocument({
  translatedBlocks,
  selected,
  onSelect,
}: {
  translatedBlocks: TranslatedBlock[];
  selected: NavigatorBlock;
  onSelect: (id: string) => void;
}) {
  const groups = new Map<string, { label: string; blocks: TranslatedBlock[] }>();

  translatedBlocks.forEach((translated) => {
    const key = pageKey(translated.block);
    if (!groups.has(key)) groups.set(key, { label: pageLabel(translated.block), blocks: [] });
    groups.get(key)?.blocks.push(translated);
  });

  const pages = Array.from(groups.values()).map((group) => ({
    ...group,
    blocks: group.blocks.sort((left, right) => left.block.order - right.block.order),
  }));

  return (
    <section className="rounded-xl border border-border/70 bg-surface p-4 shadow-md lg:min-h-[42rem]">
      <div className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
          Translated meaning document
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Plain-language meaning for the same passages, kept beside the original.
        </p>
      </div>

      <div className="max-h-[74vh] space-y-6 overflow-y-auto rounded-lg bg-surface-raised/70 p-4 pr-2">
        {pages.map((page) => (
          <section
            key={page.label}
            className="mx-auto max-w-3xl space-y-3 rounded-md border border-border/80 bg-white px-5 py-5 shadow-sm"
          >
            <div className="sticky top-0 z-10 border-b border-border/60 bg-white/95 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {page.label}
            </div>
            <div className="space-y-3">
              {page.blocks.map((translated) => (
                <MeaningPassage
                  key={translated.block.id}
                  translated={translated}
                  active={translated.block.id === selected.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
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
  const translatedBlocks = useMemo(() => buildTranslatedBlocks(data, blocks), [data, blocks]);
  const [selectedId, setSelectedId] = useState(blocks[0]?.id || "");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!blocks.some((block) => block.id === selectedId)) setSelectedId(blocks[0]?.id || "");
  }, [blocks, selectedId]);

  const selected = blocks.find((block) => block.id === selectedId) || blocks[0];
  void answerLanguage;

  if (!selected) {
    return (
      <section className="space-y-4">
        <DocumentIntro data={data} itemCount={0} />
        <section className="rounded-xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
            Original document
          </div>
          <EmptyState>No source document text was returned.</EmptyState>
        </section>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <DocumentIntro data={data} itemCount={blocks.length} />
      <DocumentMap
        blocks={blocks}
        selected={selected}
        query={query}
        onQueryChange={setQuery}
        onSelect={setSelectedId}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <OriginalDocument pages={pages} selected={selected} onSelect={setSelectedId} />
        <TranslatedMeaningDocument
          translatedBlocks={translatedBlocks}
          selected={selected}
          onSelect={setSelectedId}
        />
      </div>
    </section>
  );
}
