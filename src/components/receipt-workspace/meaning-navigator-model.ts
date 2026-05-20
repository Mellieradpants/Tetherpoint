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

export function sourceNameLabel(data: PipelineResponse): string {
  const packetNode = safeArray(data.document_first_v2?.rule_unit_candidates?.candidates).find((item) => item.document_id?.trim());
  const structureNode = safeArray(data.document_first_v2?.document_structure?.nodes).find((node) => node.document_id?.trim());
  const originSignal = [...safeArray(data.origin?.origin_identity_signals), ...safeArray(data.origin?.origin_metadata_signals)].find((signal) => signal.value?.trim());
  return packetNode?.document_id || structureNode?.document_id || originSignal?.value || "Submitted document";
}

function sourceUrlForData(data: PipelineResponse): string | null {
  return safeArray(data.origin?.referenced_sources).find((source) => source.official_source_url)?.official_source_url || null;
}

function anchorLabel(anchor: DocumentFirstSourceAnchor | null | undefined): string {
  return [anchor?.page_number ? `Page ${anchor.page_number}` : "", anchor?.block_id ? `Block ${anchor.block_id}` : ""].filter(present).join(" / ") || "Document passage";
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
      return { id: node.structural_node_id, label: `Section ${sectionId}`, raw: node.source_text || node.normalized_text || "", pageNumber: node.page_number ?? anchor?.page_number, sectionId, nodeId: node.structural_node_id, sourceNodeIds: [node.structural_node_id], order: node.order ?? index + 1 };
    });
}

function ruleUnitBlock(unit: RuleUnit, index: number): NavigatorBlock {
  const sectionId = unit.section_id || String(index + 1);
  return { id: `rule-${unit.rule_unit_id || index}`, label: `Section ${sectionId}`, raw: unit.source_text_combined || unit.primary_text || "", sectionId, ruleUnitId: unit.rule_unit_id, nodeId: unit.primary_node_id, sourceNodeIds: [unit.primary_node_id, ...safeArray(unit.source_node_ids), ...safeArray(unit.fragment_node_ids)].filter(present), order: index + 1 };
}

function legacyStructureBlocks(data: PipelineResponse): NavigatorBlock[] {
  return safeArray(data.structure?.nodes)
    .filter((node: StructureNode) => (node.source_text || node.normalized_text || "").trim())
    .map((node: StructureNode, index: number) => {
      const sectionId = node.section_id || String(index + 1);
      return { id: `structure-${node.node_id || index}`, label: `Section ${sectionId}`, raw: node.source_text || node.normalized_text || "", sectionId, nodeId: node.node_id, sourceNodeIds: [node.node_id].filter(present), order: index + 1 };
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

function ruleUnitMatchesBlock(unit: RuleUnit, block: NavigatorBlock): boolean {
  const ids = blockIds(block);
  const unitIds = [unit.rule_unit_id, unit.primary_node_id, ...safeArray(unit.source_node_ids), ...safeArray(unit.fragment_node_ids)].filter(present);
  const blockText = normalizedText(block.raw);
  const unitText = normalizedText(unit.source_text_combined || unit.primary_text || "");
  return unitIds.some((id) => ids.includes(id)) || Boolean(blockText && unitText && (unitText.includes(blockText) || blockText.includes(unitText)));
}

function referencesForBlock(data: PipelineResponse, block: NavigatorBlock): RuleUnitReferencedSource[] {
  const packets: RuleUnitReferencedSource[] = [];
  const seen = new Set<string>();
  safeArray(data.rule_units?.rule_units).filter((unit) => ruleUnitMatchesBlock(unit, block)).forEach((unit) => {
    safeArray(unit.referenced_sources).forEach((packet) => {
      const key = `${packet.name}|${packet.matchedText}|${packet.officialSourceUrl || ""}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); packets.push(packet); }
    });
  });
  return packets;
}

function verificationStatus(verification: VerificationNode | undefined, references: RuleUnitReferencedSource[]): VerificationStatus {
  if (verification?.verification_path_available || references.some((reference) => reference.officialSourceUrl?.trim())) return "verified";
  if (verification || references.length > 0) return "partial";
  return "unverified";
}

function sectionFromBlock(data: PipelineResponse, block: NavigatorBlock): DocSection {
  const meaning = meaningForBlock(data, block);
  const verification = verificationForBlock(data, block);
  const references = referencesForBlock(data, block);
  const referenceLabel = hasUnresolvedReferencedSources(data) ? "source reference" : "source-backed result";
  const plainMeaning = hideAtomicReferences(meaning?.plain_meaning || meaning?.message || "No plain meaning is attached to this section yet.", referenceLabel);
  const sourceUrl = references.find((reference) => reference.officialSourceUrl)?.officialSourceUrl || sourceUrlForData(data);
  const sourceName = references[0]?.name || sourceNameLabel(data);
  const routes = safeArray(verification?.expected_record_systems);
  const missing = safeArray(meaning?.missing_information);

  return {
    id: block.id,
    label: block.label,
    raw: block.raw,
    meaning: plainMeaning,
    origin: { source: `${sourceName} — ${block.label}`, url: sourceUrl, statute: references[0]?.matchedText || (block.pageNumber ? `Page ${block.pageNumber}` : anchorLabel({ page_number: block.pageNumber, block_id: block.sectionId || null })) },
    verification: { status: verificationStatus(verification, references), crossRef: routes.length ? routes.join(", ") : references[0]?.name || "No external verification route mapped yet.", note: verification?.verification_notes || references[0]?.limits?.[0] || "Verification support is shown only when a source path is available." },
    governance: { procedural: data.governance?.status || data.output?.governance_status || "Not returned", safeguards: missing.length ? `Missing context: ${missing.join(", ")}` : "No missing information returned for this section.", flags: [...missing, ...safeArray(data.errors).map((error) => error.error)].slice(0, 4) },
  };
}

export function buildDocSections(data: PipelineResponse): DocSection[] {
  return buildDocumentBlocks(data).map((block) => sectionFromBlock(data, block));
}
