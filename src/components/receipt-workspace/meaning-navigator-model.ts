import type {
  DocumentFirstRuleUnitCandidate,
  DocumentFirstSourceAnchor,
  DocumentFirstStructureNode,
  MeaningNodeResult,
  PipelineResponse,
  RuleUnit,
  RuleUnitReferencedSource,
  SourceMetadataContract,
  StructureNode,
  VerificationNode,
} from "../../types/pipeline";
import { hasUnresolvedReferencedSources, hideAtomicReferences, safeArray } from "./shared";

export type VerificationStatus = "verified" | "partial" | "unverified";

export type NavigatorBlock = {
  id: string;
  label: string;
  raw: string;
  pageNumber?: number | null;
  sectionId?: string | null;
  ruleUnitId?: string | null;
  nodeId?: string | null;
  sourceNodeIds: string[];
  order: number;
};

export type DocSection = {
  id: string;
  label: string;
  raw: string;
  meaning: string;
  origin: { source: string; url?: string | null; statute: string };
  verification: { status: VerificationStatus; crossRef: string; note: string };
  governance: { procedural: string; safeguards: string; flags: string[] };
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

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return values.filter(present).filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatStatus(value: string | null | undefined): string {
  if (!value) return "Not returned";
  return value.replaceAll("_", " ");
}

export function sourceNameLabel(data: PipelineResponse): string {
  const packetNode = safeArray(data.document_first_v2?.rule_unit_candidates?.candidates).find((item) => item.document_id?.trim());
  const structureNode = safeArray(data.document_first_v2?.document_structure?.nodes).find((node) => node.document_id?.trim());
  const metadata = safeArray(data.source_metadata).find((source) => source.source_name?.trim());
  const originSignal = [...safeArray(data.origin?.origin_identity_signals), ...safeArray(data.origin?.origin_metadata_signals)].find((signal) => signal.value?.trim());
  return packetNode?.document_id || structureNode?.document_id || metadata?.source_name || originSignal?.value || "Submitted document";
}

function sourceUrlForData(data: PipelineResponse): string | null {
  return safeArray(data.origin?.referenced_sources).find((source) => source.official_source_url)?.official_source_url || safeArray(data.source_metadata).find((source) => source.source_url)?.source_url || null;
}

function anchorLabel(anchor: DocumentFirstSourceAnchor | null | undefined): string {
  return [anchor?.page_number ? `Page ${anchor.page_number}` : "", anchor?.block_id ? `Block ${anchor.block_id}` : ""].filter(present).join(" / ") || "Selected passage";
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
  const candidatesById = candidateByNodeId(safeArray(data.document_first_v2?.rule_unit_candidates?.candidates));
  return nodes
    .filter((node: DocumentFirstStructureNode) => Boolean((node.source_text || node.normalized_text || "").trim()) && node.structural_type !== "document" && node.structural_type !== "page")
    .map((node: DocumentFirstStructureNode, index: number) => {
      const anchor = node.source_anchor || candidatesById.get(node.structural_node_id)?.source_anchor;
      const sectionId = node.block_id || anchor?.block_id || String(index + 1);
      return {
        id: node.structural_node_id,
        label: `Section ${sectionId}`,
        raw: node.source_text || node.normalized_text || "",
        pageNumber: node.page_number ?? anchor?.page_number,
        sectionId,
        nodeId: node.structural_node_id,
        sourceNodeIds: [node.structural_node_id],
        order: node.order ?? index + 1,
      };
    });
}

function ruleUnitBlock(unit: RuleUnit, index: number): NavigatorBlock {
  const sectionId = unit.section_id || String(index + 1);
  return {
    id: `rule-${unit.rule_unit_id || index}`,
    label: `Section ${sectionId}`,
    raw: unit.source_text_combined || unit.primary_text || "",
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
        label: `Section ${sectionId}`,
        raw: node.source_text || node.normalized_text || "",
        sectionId,
        nodeId: node.node_id,
        sourceNodeIds: [node.node_id].filter(present),
        order: index + 1,
      };
    });
}

function rawDocumentBlock(data: PipelineResponse): NavigatorBlock[] {
  const text = data.input?.raw_content || "";
  return text.trim() ? [{ id: "raw-document", label: "Document", raw: text, sourceNodeIds: [], order: 1 }] : [];
}

function buildDocumentBlocks(data: PipelineResponse): NavigatorBlock[] {
  const documentFirst = documentFirstBlocks(data);
  if (documentFirst.length) return documentFirst;
  const rules = safeArray(data.rule_units?.rule_units).filter((unit: RuleUnit) => (unit.source_text_combined || unit.primary_text || "").trim()).map(ruleUnitBlock);
  if (rules.length) return rules;
  const structure = legacyStructureBlocks(data);
  return structure.length ? structure : rawDocumentBlock(data);
}

function blockIds(block: NavigatorBlock): string[] {
  return [block.ruleUnitId, block.nodeId, ...block.sourceNodeIds].filter(present);
}

function meaningForBlock(data: PipelineResponse, block: NavigatorBlock): MeaningNodeResult | undefined {
  const ids = blockIds(block);
  return safeArray(data.meaning?.node_results).find((result) => ids.includes(result.node_id) || sameSourceText(result.source_text, block.raw));
}

function verificationForBlock(data: PipelineResponse, block: NavigatorBlock): VerificationNode | undefined {
  const ids = blockIds(block);
  return safeArray(data.verification?.node_results).find((result) => ids.includes(result.node_id) || (result.rule_unit_id ? ids.includes(result.rule_unit_id) : false) || safeArray(result.source_node_ids).some((id) => ids.includes(id)));
}

function matchingRuleUnits(data: PipelineResponse, block: NavigatorBlock): RuleUnit[] {
  const ids = blockIds(block);
  const blockText = normalizedText(block.raw);
  return safeArray(data.rule_units?.rule_units).filter((unit) => {
    const unitIds = [unit.rule_unit_id, unit.primary_node_id, ...safeArray(unit.source_node_ids), ...safeArray(unit.fragment_node_ids)].filter(present);
    const unitText = normalizedText(unit.source_text_combined || unit.primary_text || "");
    return unitIds.some((id) => ids.includes(id)) || Boolean(blockText && unitText && (unitText.includes(blockText) || blockText.includes(unitText)));
  });
}

function referencesForBlock(data: PipelineResponse, block: NavigatorBlock): RuleUnitReferencedSource[] {
  const packets: RuleUnitReferencedSource[] = [];
  const seen = new Set<string>();
  matchingRuleUnits(data, block).forEach((unit) => {
    safeArray(unit.referenced_sources).forEach((packet) => {
      const key = `${packet.name}|${packet.matchedText}|${packet.officialSourceUrl || ""}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        packets.push(packet);
      }
    });
  });
  return packets;
}

function metadataForBlock(data: PipelineResponse, block: NavigatorBlock): SourceMetadataContract[] {
  const ids = blockIds(block);
  return safeArray(data.source_metadata).filter((source) => safeArray(source.related_node_ids).some((id) => ids.includes(id)) || safeArray(source.related_rule_unit_ids).some((id) => ids.includes(id)) || sameSourceText(source.matched_text, block.raw) || sameSourceText(source.source_text, block.raw));
}

function handoffFlagsForBlock(data: PipelineResponse, block: NavigatorBlock): string[] {
  const ids = blockIds(block);
  return safeArray(data.human_review_handoffs)
    .filter((handoff) => safeArray(handoff.affected_output_ids).some((id) => ids.includes(id)) || safeArray(handoff.source_objects).some((id) => ids.includes(id)))
    .flatMap((handoff) => [handoff.reason, handoff.human_question]);
}

function verificationStatus(verification: VerificationNode | undefined, references: RuleUnitReferencedSource[], metadata: SourceMetadataContract[]): VerificationStatus {
  if (verification?.verification_path_available || references.some((reference) => reference.officialSourceUrl?.trim()) || metadata.some((source) => source.resolution_state === "found" && source.source_url?.trim())) return "verified";
  if (verification || references.length > 0 || metadata.length > 0) return "partial";
  return "unverified";
}

function sectionFromBlock(data: PipelineResponse, block: NavigatorBlock): DocSection {
  const meaning = meaningForBlock(data, block);
  const verification = verificationForBlock(data, block);
  const references = referencesForBlock(data, block);
  const metadata = metadataForBlock(data, block);
  const units = matchingRuleUnits(data, block);
  const referenceLabel = hasUnresolvedReferencedSources(data) ? "source reference" : "source-backed result";
  const plainMeaning = hideAtomicReferences(meaning?.plain_meaning || meaning?.message || data.meaning?.overall_plain_meaning || "No plain meaning is attached to this section yet.", referenceLabel);

  const firstReference = references.find((reference) => reference.officialSourceUrl?.trim()) || references[0];
  const firstMetadata = metadata.find((source) => source.source_url?.trim()) || metadata[0];
  const sourceUrl = firstReference?.officialSourceUrl || firstMetadata?.source_url || sourceUrlForData(data);
  const sourceName = firstReference?.name || firstMetadata?.source_name || sourceNameLabel(data);
  const routes = unique([...(verification?.expected_record_systems || []), ...metadata.map((source) => source.source_system || source.source_name)]);
  const missing = unique([...(meaning?.missing_information || []), ...(data.meaning?.summary_missing_information || [])]);
  const ruleIssues = units.flatMap((unit) => [...safeArray(unit.assembly_issues), unit.review_status !== "ready" ? formatStatus(unit.review_status) : null]);
  const metadataFlags = metadata.flatMap((source) => [...safeArray(source.anchors_missing), ...safeArray(source.limits), source.review_state !== "ready" ? formatStatus(source.review_state) : null]);
  const gateFlags = [...safeArray(data.governance_gate?.practical_questions), ...safeArray(data.governance_gate?.limits)];

  return {
    id: block.id,
    label: block.label,
    raw: block.raw,
    meaning: plainMeaning,
    origin: {
      source: `${sourceName} — ${block.label}`,
      url: sourceUrl,
      statute: firstReference?.matchedText || firstMetadata?.matched_text || (block.pageNumber ? `Page ${block.pageNumber}` : anchorLabel({ page_number: block.pageNumber, block_id: block.sectionId || null })),
    },
    verification: {
      status: verificationStatus(verification, references, metadata),
      crossRef: routes.length ? routes.join(", ") : firstReference?.name || firstMetadata?.source_name || "No external verification route mapped yet.",
      note: verification?.verification_notes || firstReference?.limits?.[0] || firstMetadata?.limits?.[0] || formatStatus(firstMetadata?.resolution_state) || "Verification support is shown only when a source path is available.",
    },
    governance: {
      procedural: formatStatus(data.governance?.status || data.output?.governance_status || data.governance_gate?.status),
      safeguards: missing.length ? `Missing context: ${missing.join(", ")}` : "No missing information returned for this section.",
      flags: unique([...missing, ...ruleIssues, ...metadataFlags, ...gateFlags, ...handoffFlagsForBlock(data, block), ...safeArray(data.errors).map((error) => error.error)]).slice(0, 6),
    },
  };
}

export function buildDocSections(data: PipelineResponse): DocSection[] {
  return buildDocumentBlocks(data).map((block) => sectionFromBlock(data, block));
}
