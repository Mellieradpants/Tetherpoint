export type DocumentNavigatorZoneId =
  | "whole_document_overview"
  | "document_map"
  | "selected_passage"
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
  document_map: {
    id: "document_map",
    label: "Document Map",
    purpose: "Lets the user move through the mapped document.",
    owns: ["sections/rules/passages", "readable labels", "status indicators", "selection behavior"],
  },
  selected_passage: {
    id: "selected_passage",
    label: "Selected Passage",
    purpose: "Shows the exact source material selected by the user.",
    owns: ["selected source text", "passage location", "page/section/block anchor"],
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
