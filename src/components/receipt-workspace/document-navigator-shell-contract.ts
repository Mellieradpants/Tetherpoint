export type DocumentNavigatorZoneId =
  | "whole_document_overview"
  | "document_navigation"
  | "source_document_viewer"
  | "attached_layers_panel"
  | "technical_trace";

export type DocumentNavigatorZone = {
  id: DocumentNavigatorZoneId;
  label: string;
  purpose: string;
  owns: string[];
};

export const DOCUMENT_NAVIGATOR_DISPLAY_RULE =
  "User-facing document understanding belongs in Document Navigator; raw production details belong in Technical Trace.";

export const DOCUMENT_NAVIGATOR_ZONES: Record<DocumentNavigatorZoneId, DocumentNavigatorZone> = {
  whole_document_overview: {
    id: "whole_document_overview",
    label: "Whole Document Overview",
    purpose: "Shows document-level context before the user drills into a passage.",
    owns: [
      "document/source name",
      "source type",
      "jurisdiction context",
      "overall status",
      "governance summary/status",
      "unresolved references/checks",
    ],
  },
  document_navigation: {
    id: "document_navigation",
    label: "Document Navigation",
    purpose: "Lets the user move through the mapped document.",
    owns: [
      "document overview",
      "pages",
      "sections/passages",
      "document search",
      "jurisdiction summary",
      "processing/source mapping status",
      "selection behavior",
    ],
  },
  source_document_viewer: {
    id: "source_document_viewer",
    label: "Source Document Viewer",
    purpose: "Keeps the submitted or extracted source document as the main product surface.",
    owns: [
      "full submitted/extracted document",
      "page/block grouped source text",
      "selectable passages",
      "active selection highlight",
      "page/block/section anchors",
      "original source text unchanged",
    ],
  },
  attached_layers_panel: {
    id: "attached_layers_panel",
    label: "Attached Layers Panel",
    purpose: "Shows what Tetherpoint knows about the selected passage.",
    owns: [
      "plain meaning",
      "source support",
      "references",
      "governance/status flags",
      "jurisdiction context",
      "checked/not checked/needs review status",
      "future federal/state/local source relevance",
      "possible next checks, not legal advice",
    ],
  },
  technical_trace: {
    id: "technical_trace",
    label: "Technical Trace",
    purpose:
      "Keeps backend/debug details inspectable without making them the main user experience.",
    owns: [
      "raw rule IDs",
      "section IDs",
      "pipeline details",
      "route details",
      "backend node output",
      "debug structures",
      "full technical output",
    ],
  },
};
