import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type {
  DocumentFirstRuleUnitCandidate,
  DocumentFirstSourceAnchor,
  DocumentFirstStructureNode,
  MeaningNodeResult,
  PipelineResponse,
  RuleUnit,
  RuleUnitReferencedSource,
  StructureNode,
  VerificationNode,
} from "../../types/pipeline";
import { ANSWER_LANGUAGE_OPTIONS } from "./answer-language";
import {
  EmptyState,
  hasUnresolvedReferencedSources,
  hideAtomicReferences,
  safeArray,
  splitParagraphs,
} from "./shared";

type NavigatorBlock = {
  id: string;
  label: string;
  sectionLabel: string;
  sourceText: string;
  pageNumber?: number | null;
  sectionId?: string | null;
  ruleUnitId?: string | null;
  nodeId?: string | null;
  sourceNodeIds: string[];
  order: number;
};

type MeaningPacket = {
  block: NavigatorBlock;
  meaning?: MeaningNodeResult;
  verification?: VerificationNode;
  text: string;
  missingInformation: string[];
  references: RuleUnitReferencedSource[];
};

function present(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function normalizedText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

function sameSourceText(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizedText(left);
  const b = normalizedText(right);
  return Boolean(a && b && a === b);
}

function excerptLabel(value: string | null | undefined, fallback: string): string {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 112 ? `${text.slice(0, 109)}...` : text;
}

function sourceNameLabel(data: PipelineResponse): string {
  const candidate = safeArray(data.document_first_v2?.rule_unit_candidates?.candidates).find((item) => item.document_id?.trim());
  const structureNode = safeArray(data.document_first_v2?.document_structure?.nodes).find((node) => node.document_id?.trim());
  const originSignal = [
    ...safeArray(data.origin?.origin_identity_signals),
    ...safeArray(data.origin?.origin_metadata_signals),
  ].find((signal) => signal.value?.trim());

  return candidate?.document_id || structureNode?.document_id || originSignal?.value || "Submitted document";
}

function anchorLabel(anchor: DocumentFirstSourceAnchor | null | undefined): string {
  return [anchor?.page_number ? `Page ${anchor.page_number}` : "", anchor?.block_id ? `Block ${anchor.block_id}` : ""]
    .filter(present)
    .join(" / ") || "Document passage";
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
      return Boolean(text.trim()) && node.structural_type !== "document" && node.structural_type !== "page";
    })
    .map((node: DocumentFirstStructureNode, index: number) => {
      const candidate = candidatesByNodeId.get(node.structural_node_id);
      const anchor = node.source_anchor || candidate?.source_anchor;
      const text = node.source_text || node.normalized_text || "";
      const sectionId = node.block_id || anchor?.block_id || String(index + 1);

      return {
        id: node.structural_node_id,
        label: excerptLabel(text, `Section ${index + 1}`),
        sectionLabel: `Section ${sectionId}`,
        sourceText: text,
        pageNumber: node.page_number ?? anchor?.page_number,
        sectionId,
        nodeId: node.structural_node_id,
        sourceNodeIds: [node.structural_node_id],
        order: node.order ?? index + 1,
      };
    });
}

function ruleUnitBlock(unit: RuleUnit, index: number): NavigatorBlock {
  const text = unit.source_text_combined || unit.primary_text || "";
  const sectionId = unit.section_id || String(index + 1);

  return {
    id: `rule-${unit.rule_unit_id || index}`,
    label: excerptLabel(text, `Section ${index + 1}`),
    sectionLabel: `Section ${sectionId}`,
    sourceText: text,
    sectionId,
    ruleUnitId: unit.rule_unit_id,
    nodeId: unit.primary_node_id,
    sourceNodeIds: [unit.primary_node_id, ...safeArray(unit.source_node_ids), ...safeArray(unit.fragment_node_ids)].filter(present),
    order: index + 1,
  };
}

function legacyStructureBlocks(data: PipelineResponse): NavigatorBlock[] {
  return safeArray(data.structure?.nodes)
    .filter((node: StructureNode) => (node.source_text || node.normalized_text || "").trim())
    .map((node: StructureNode, index: number) => {
      const sectionId = node.section_id || String(index + 1);
      return {
        id: `structure-${node.node_id || index}`,
        label: excerptLabel(node.source_text || node.normalized_text, `Section ${index + 1}`),
        sectionLabel: `Section ${sectionId}`,
        sourceText: node.source_text || node.normalized_text || "",
        sectionId,
        nodeId: node.node_id,
        sourceNodeIds: [node.node_id].filter(present),
        order: index + 1,
      };
    });
}

function rawDocumentBlock(data: PipelineResponse): NavigatorBlock[] {
  const text = data.input?.raw_content || "";
  if (!text.trim()) return [];
  return [{ id: "raw-document", label: "Submitted document", sectionLabel: "Document", sourceText: text, sourceNodeIds: [], order: 1 }];
}

function buildDocumentBlocks(data: PipelineResponse): NavigatorBlock[] {
  const documentFirst = documentFirstBlocks(data);
  if (documentFirst.length > 0) return documentFirst;
  const rules = safeArray(data.rule_units?.rule_units).filter((unit: RuleUnit) => (unit.source_text_combined || unit.primary_text || "").trim()).map(ruleUnitBlock);
  if (rules.length > 0) return rules;
  const structure = legacyStructureBlocks(data);
  if (structure.length > 0) return structure;
  return rawDocumentBlock(data);
}

function blockIds(block: NavigatorBlock): string[] {
  return [block.ruleUnitId, block.nodeId, ...block.sourceNodeIds].filter(present);
}

function meaningForBlock(data: PipelineResponse, block: NavigatorBlock): MeaningNodeResult | undefined {
  const ids = blockIds(block);
  return safeArray(data.meaning?.node_results).find((result) => ids.includes(result.node_id) || sameSourceText(result.source_text, block.sourceText));
}

function verificationForBlock(data: PipelineResponse, block: NavigatorBlock): VerificationNode | undefined {
  const ids = blockIds(block);
  return safeArray(data.verification?.node_results).find(
    (result) => ids.includes(result.node_id) || (result.rule_unit_id ? ids.includes(result.rule_unit_id) : false) || safeArray(result.source_node_ids).some((id) => ids.includes(id)),
  );
}

function ruleUnitMatchesBlock(unit: RuleUnit, block: NavigatorBlock): boolean {
  const ids = blockIds(block);
  const unitIds = [unit.rule_unit_id, unit.primary_node_id, ...safeArray(unit.source_node_ids), ...safeArray(unit.fragment_node_ids)].filter(present);
  const blockText = normalizedText(block.sourceText);
  const unitText = normalizedText(unit.source_text_combined || unit.primary_text || "");
  return unitIds.some((id) => ids.includes(id)) || Boolean(blockText && unitText && (unitText.includes(blockText) || blockText.includes(unitText)));
}

function referencePacketsForBlock(data: PipelineResponse, block: NavigatorBlock): RuleUnitReferencedSource[] {
  const packets: RuleUnitReferencedSource[] = [];
  const seen = new Set<string>();
  safeArray(data.rule_units?.rule_units)
    .filter((unit) => ruleUnitMatchesBlock(unit, block))
    .forEach((unit) => {
      safeArray(unit.referenced_sources).forEach((packet) => {
        const key = `${packet.name}|${packet.matchedText}|${packet.officialSourceUrl || ""}`.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        packets.push(packet);
      });
    });
  return packets;
}

function packetForBlock(data: PipelineResponse, block: NavigatorBlock): MeaningPacket {
  const meaning = meaningForBlock(data, block);
  const hasUnresolvedReferences = hasUnresolvedReferencedSources(data);
  const referenceLabel = hasUnresolvedReferences ? "source reference" : "source-backed result";
  return {
    block,
    meaning,
    verification: verificationForBlock(data, block),
    text: hideAtomicReferences(meaning?.plain_meaning || "", referenceLabel),
    missingInformation: safeArray(meaning?.missing_information),
    references: referencePacketsForBlock(data, block),
  };
}

function languageLabel(language: string): string {
  return ANSWER_LANGUAGE_OPTIONS.find((option) => option.code === language)?.label || "English";
}

function handleSelectableKeyDown(event: KeyboardEvent<HTMLElement>, onSelect: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelect();
}

function NavigatorHeader({
  data,
  answerLanguage,
  onAnswerLanguageChange,
}: {
  data: PipelineResponse;
  answerLanguage: string;
  onAnswerLanguageChange: (language: string) => void;
}) {
  const jurisdiction = data.jurisdiction_context?.user_selected_state || "I don't know";
  const sourceType = data.document_first_v2?.status === "executed" ? "Document packet" : data.input?.content_type || "source text";

  return (
    <section className="sticky top-0 z-30 rounded-b-[2rem] border-b border-border/70 bg-white/95 px-5 py-4 shadow-xl backdrop-blur">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Meaning Diff</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">meaning-navigator</h2>
          </div>
          <select
            value={answerLanguage}
            onChange={(event) => onAnswerLanguageChange(event.target.value)}
            aria-label="Answer language"
            className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ANSWER_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 text-xs text-muted-foreground">
          <span className="shrink-0 rounded-full border border-border/70 bg-surface px-3 py-1">{sourceType}</span>
          <span className="shrink-0 rounded-full border border-border/70 bg-surface px-3 py-1">{sourceNameLabel(data)}</span>
          <span className="shrink-0 rounded-full border border-border/70 bg-surface px-3 py-1">Jurisdiction: {jurisdiction}</span>
          <span className="shrink-0 rounded-full border border-border/70 bg-surface px-3 py-1">Language: {languageLabel(answerLanguage)}</span>
        </div>
      </div>
    </section>
  );
}

function SectionCard({ block, active, onSelect }: { block: NavigatorBlock; active: boolean; onSelect: (id: string) => void }) {
  const title = block.sectionId ? `Section ${block.sectionId}` : block.sectionLabel;
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(block.id)}
      onKeyDown={(event) => handleSelectableKeyDown(event, () => onSelect(block.id))}
      aria-pressed={active}
      className={`cursor-pointer rounded-2xl border bg-[#f7f2ea] px-6 py-7 shadow-sm transition-all ${active ? "border-[#9a6b35] shadow-[0_0_0_2px_rgba(154,107,53,0.08)]" : "border-transparent hover:border-[#c99a5a]/60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-[#9a6b35]">{title}</div>
        <div className="text-[#9a6b35]">*</div>
      </div>
      <div className="mt-5 whitespace-pre-wrap break-words font-serif text-[1.65rem] leading-[1.85] text-[#3d3934] md:text-[2rem]">{block.sourceText}</div>
    </article>
  );
}

function DocumentReader({
  blocks,
  selectedId,
  onSelect,
  query,
  onQueryChange,
}: {
  blocks: NavigatorBlock[];
  selectedId: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const visibleBlocks = normalizedText(query)
    ? blocks.filter((block) => normalizedText(`${block.label} ${block.sectionLabel} ${block.sourceText}`).includes(normalizedText(query)))
    : blocks;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-32">
      <div className="mb-6 rounded-2xl border border-border/70 bg-white/70 p-4 shadow-sm backdrop-blur">
        <label className="block text-sm font-medium text-foreground">
          <span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Search document</span>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search source text" className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring" />
        </label>
      </div>
      <div className="space-y-6">
        {visibleBlocks.map((block) => <SectionCard key={block.id} block={block} active={block.id === selectedId} onSelect={onSelect} />)}
      </div>
    </main>
  );
}

function InlineSources({ references }: { references: RuleUnitReferencedSource[] }) {
  if (references.length === 0) return null;
  const linked = references.filter((source) => source.officialSourceUrl?.trim());
  const unlinked = references.filter((source) => !source.officialSourceUrl?.trim());
  return (
    <p className="mt-5 text-base leading-7 text-[#6b6258]">
      {linked.length > 0 && <span>This can be verified here: {linked.map((source, index) => <span key={`${source.name}-${index}`}>{index > 0 && ", "}<a href={source.officialSourceUrl || undefined} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="font-semibold text-[#2f6f4e] underline decoration-dotted underline-offset-4">{source.name}</a></span>)}.</span>}
      {unlinked.length > 0 && <span className={linked.length > 0 ? "ml-1" : ""}>Official link not mapped yet for {unlinked.map((source) => source.name).join(", ")}.</span>}
    </p>
  );
}

function MeaningDrawer({ packet, answerLanguage, onClose }: { packet: MeaningPacket; answerLanguage: string; onClose: () => void }) {
  const paragraphs = splitParagraphs(packet.text);
  const statusMessage = packet.meaning?.error || packet.meaning?.message || "";
  const routes = safeArray(packet.verification?.expected_record_systems);
  const verifyNote = packet.verification?.verification_notes;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30 backdrop-blur-[1px]">
      <section className="max-h-[78vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#fbfaf8] shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-[#e6ded5] bg-[#fbfaf8]/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto mb-4 h-2 w-24 rounded-full bg-[#d8d0c6]" />
          <div className="flex items-center justify-between gap-4">
            <div className="font-mono text-base font-semibold uppercase tracking-[0.22em] text-[#b87b3c]">{packet.block.sectionLabel}</div>
            <button type="button" onClick={onClose} className="rounded-full bg-[#eee9e3] px-4 py-2 text-xl font-semibold text-[#8a8178] transition-colors hover:bg-[#e4ddd5]" aria-label="Close meaning drawer">x</button>
          </div>
        </div>
        <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
          <section className="rounded-2xl border border-[#e0bf7e] bg-white px-6 py-7 shadow-sm">
            <div className="mb-5 font-mono text-base font-semibold uppercase tracking-[0.22em] text-[#b87b3c]">Plain meaning</div>
            {paragraphs.length > 0 ? <div className="space-y-4 font-serif text-[1.65rem] leading-[1.8] text-[#2f2c28] md:text-[2rem]">{paragraphs.map((paragraph, index) => <p key={`${packet.block.id}-meaning-${index}`}>{paragraph}</p>)}</div> : <EmptyState>No plain meaning is attached to this passage yet.</EmptyState>}
            <InlineSources references={packet.references} />
            <p className="mt-5 text-sm leading-6 text-[#8a8178]">Display language: {languageLabel(answerLanguage)}.</p>
          </section>
          {statusMessage && <div className="rounded-xl border border-[#e0bf7e] bg-[#fff8e7] p-4 text-sm leading-6 text-[#7a5b2a]">{statusMessage}</div>}
          {packet.missingInformation.length > 0 && <div className="rounded-xl border border-[#e0bf7e] bg-[#fff8e7] p-4 text-sm leading-6 text-[#7a5b2a]">Missing context: {packet.missingInformation.join(", ")}</div>}
          <div className="font-mono text-sm uppercase tracking-[0.24em] text-[#b5aca2]">Traceability stack</div>
          <div className="border-t border-[#dfd8cf] pt-6">
            <div className="font-mono text-lg font-semibold uppercase tracking-[0.22em] text-[#5572a8]">Origin</div>
            <div className="mt-4 grid gap-3 text-base leading-7 md:grid-cols-[9rem_1fr]"><div className="font-mono uppercase tracking-[0.18em] text-[#a49a90]">Source</div><div className="text-[#3d3934]">{packet.block.sectionLabel}</div><div className="font-mono uppercase tracking-[0.18em] text-[#a49a90]">Anchor</div><div className="text-[#3d3934]">{packet.block.pageNumber ? `Page ${packet.block.pageNumber}` : "Selected passage"}</div></div>
          </div>
          <div className="border-t border-[#d8e4dc] pt-6">
            <div className="font-mono text-lg font-semibold uppercase tracking-[0.22em] text-[#2f6f4e]">Verification</div>
            <div className="mt-4 grid gap-3 text-base leading-7 md:grid-cols-[9rem_1fr]"><div className="font-mono uppercase tracking-[0.18em] text-[#a49a90]">Status</div><div className="text-[#3d3934]">{packet.verification?.verification_path_available ? "Available" : packet.references.length ? "Source path detected" : "Not mapped yet"}</div>{routes.length > 0 && <><div className="font-mono uppercase tracking-[0.18em] text-[#a49a90]">Route</div><div className="text-[#3d3934]">{routes.join(", ")}</div></>}{verifyNote && <><div className="font-mono uppercase tracking-[0.18em] text-[#a49a90]">Note</div><div className="text-[#3d3934]">{verifyNote}</div></>}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DocumentNavigator({ data, answerLanguage, onAnswerLanguageChange }: { data: PipelineResponse; answerLanguage: string; onAnswerLanguageChange: (language: string) => void }) {
  const blocks = useMemo(() => buildDocumentBlocks(data), [data]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (selectedId && !blocks.some((block) => block.id === selectedId)) setSelectedId("");
  }, [blocks, selectedId]);

  const selected = blocks.find((block) => block.id === selectedId);
  const packet = selected ? packetForBlock(data, selected) : null;

  return (
    <section className="min-h-full bg-[#f7f2ea]">
      <NavigatorHeader data={data} answerLanguage={answerLanguage} onAnswerLanguageChange={onAnswerLanguageChange} />
      {blocks.length > 0 ? <DocumentReader blocks={blocks} selectedId={selectedId} onSelect={setSelectedId} query={query} onQueryChange={setQuery} /> : <div className="mx-auto max-w-5xl px-4 py-8"><section className="rounded-2xl border border-border/60 bg-white p-6"><EmptyState>No source document text was returned.</EmptyState></section></div>}
      {packet && <MeaningDrawer packet={packet} answerLanguage={answerLanguage} onClose={() => setSelectedId("")} />}
    </section>
  );
}
