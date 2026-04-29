import { useMemo, useState } from "react";
import type { PipelineResponse } from "./Workspace";

export type { PipelineResponse } from "./Workspace";

type ReceiptRowKey = "source" | "structure" | "anchors" | "meaning" | "verification" | "governance";
type ReceiptTone = "pass" | "warning" | "error" | "neutral";

type ReceiptRow = {
  key: ReceiptRowKey;
  label: string;
  status: string;
  tone: ReceiptTone;
  whatThisLayerDoes: string;
  whatItChecks: string;
  howToUseIt: string;
  whatHappenedHere: string;
};

const TECHNICAL_TRACE_LABEL = "Show technical trace";

function formatStatus(value: string | null | undefined): string {
  if (!value) return "Not returned";
  return value.replaceAll("_", " ");
}

function toneClass(tone: ReceiptTone): string {
  if (tone === "pass") return "border-primary/30 bg-primary/10 text-primary";
  if (tone === "warning") return "border-gold/40 bg-gold/10 text-gold-muted";
  if (tone === "error") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border/60 bg-background/30 text-muted-foreground";
}

function getToneFromStatus(status: string | null | undefined): ReceiptTone {
  const value = status?.toLowerCase() ?? "";
  if (["blocked", "error", "failed", "fatal"].some((token) => value.includes(token))) return "error";
  if (["review", "fallback", "repaired", "missing", "skipped"].some((token) => value.includes(token))) return "warning";
  if (["ok", "clean", "match", "ready", "complete", "executed", "cleared", "passed"].some((token) => value.includes(token))) return "pass";
  return "neutral";
}

function StatusChip({ label, tone }: { label: string; tone: ReceiptTone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest ${toneClass(tone)}`}>
      {label}
    </span>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: ReceiptTone }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-sm font-semibold leading-snug ${tone === "pass" ? "text-primary" : tone === "warning" ? "text-gold-muted" : tone === "error" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-border/50 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-muted">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}

function buildReadableReceipt(data: PipelineResponse): string {
  const governanceStatus = data.governance?.status ?? data.output.governance_status ?? "not returned";
  const governanceIssues = data.governance?.issue_count ?? data.output.governance_issue_count ?? 0;
  const verificationRoutes = new Set<string>();

  for (const result of data.verification.node_results) {
    for (const system of result.expected_record_systems) verificationRoutes.add(system);
  }

  const lines = [
    "Tetherpoint Receipt",
    "Every result gets a receipt.",
    "",
    `What happened: ${data.structure.node_count} source node(s), ${data.rule_units.unit_count} rule unit(s), ${data.verification.node_results.length} verification check(s).`,
    `What needs review: ${governanceIssues} governance issue(s), ${data.errors.length} pipeline error(s).`,
    `Where support exists: ${verificationRoutes.size > 0 ? Array.from(verificationRoutes).join(", ") : "No external record systems routed."}`,
    "",
    `Source received: ${formatStatus(data.input.parse_status)}`,
    `Text separated: ${data.rule_units.unit_count} rule unit(s)` ,
    `Anchors checked: ${data.structure.node_count} source node(s)`,
    `Meaning allowed: ${formatStatus(data.meaning.status)}`,
    `Verification routed: ${verificationRoutes.size} record system(s)`,
    `Governance result: ${formatStatus(governanceStatus)}`,
    "",
    "Plain meaning:",
    data.meaning.overall_plain_meaning || "No overall plain meaning returned.",
  ];

  return lines.join("\n");
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ReceiptActions({ data, onToggleTrace, traceOpen }: { data: PipelineResponse; onToggleTrace: () => void; traceOpen: boolean }) {
  const receiptText = buildReadableReceipt(data);

  const copyResult = async () => {
    await navigator.clipboard.writeText(receiptText);
  };

  const exportResult = () => {
    downloadText("tetherpoint-receipt.md", receiptText, "text/markdown;charset=utf-8");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copyResult} className="rounded-full border border-border/60 bg-background/30 px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40">
        Copy result
      </button>
      <button type="button" onClick={exportResult} className="rounded-full border border-border/60 bg-background/30 px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40">
        Export result
      </button>
      <button type="button" onClick={onToggleTrace} className="rounded-full border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-medium text-gold-muted hover:border-gold/50">
        {traceOpen ? "Hide technical trace" : TECHNICAL_TRACE_LABEL}
      </button>
    </div>
  );
}

function ReceiptRowCard({ row, active, onClick }: { row: ReceiptRow; active: boolean; onClick: () => void }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/90 shadow-sm">
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-4 text-left">
        <div className={`h-3 w-3 shrink-0 rounded-full border ${toneClass(row.tone)}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{row.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{row.status}</div>
        </div>
        <StatusChip label={row.status} tone={row.tone} />
        <div className="text-muted-foreground">{active ? "⌃" : "⌄"}</div>
      </button>

      {active && (
        <div className="border-t border-border/60 px-4 py-4">
          <DetailBlock title="What this layer does" body={row.whatThisLayerDoes} />
          <DetailBlock title="What it checks" body={row.whatItChecks} />
          <DetailBlock title="How to use it" body={row.howToUseIt} />
          <DetailBlock title="What happened here" body={row.whatHappenedHere} />
        </div>
      )}
    </div>
  );
}

function TechnicalTrace({ data }: { data: PipelineResponse }) {
  const traceText = JSON.stringify(data, null, 2);

  const copyJson = async () => {
    await navigator.clipboard.writeText(traceText);
  };

  const exportJson = () => {
    downloadText("tetherpoint-trace.json", traceText, "application/json;charset=utf-8");
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Technical trace</div>
          <div className="mt-1 text-xs text-muted-foreground">Raw pipeline response for technical review.</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={copyJson} className="rounded-full border border-border/60 bg-background/30 px-3 py-2 text-xs text-foreground">Copy JSON</button>
          <button type="button" onClick={exportJson} className="rounded-full border border-border/60 bg-background/30 px-3 py-2 text-xs text-foreground">Export JSON</button>
        </div>
      </div>
      <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-border/50 bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {traceText}
      </pre>
    </section>
  );
}

function buildRows(data: PipelineResponse): ReceiptRow[] {
  const governanceStatus = data.governance?.status ?? data.output.governance_status ?? "not returned";
  const governanceIssues = data.governance?.issue_count ?? data.output.governance_issue_count ?? 0;
  const verificationRoutes = new Set<string>();

  for (const result of data.verification.node_results) {
    for (const system of result.expected_record_systems) verificationRoutes.add(system);
  }

  return [
    {
      key: "source",
      label: "Source received",
      status: formatStatus(data.input.parse_status),
      tone: getToneFromStatus(data.input.parse_status),
      whatThisLayerDoes: "Receives the submitted content and records the declared content type before processing starts.",
      whatItChecks: "Checks whether the input is present, whether the content type is supported, and whether parsing can begin.",
      howToUseIt: "Use this row to confirm the document was accepted before trusting later results.",
      whatHappenedHere: `The submitted content type was ${data.input.content_type}. Parse status: ${formatStatus(data.input.parse_status)}.`,
    },
    {
      key: "structure",
      label: "Text separated",
      status: `${data.rule_units.unit_count} rule unit(s)`,
      tone: data.rule_units.needs_review_count > 0 ? "warning" : "pass",
      whatThisLayerDoes: "Separates the source into workable pieces without treating loose text as final meaning.",
      whatItChecks: "Checks structure, selected text fragments, rule-unit assembly, and review status.",
      howToUseIt: "Use this row to see whether the source was separated cleanly or whether some pieces need review.",
      whatHappenedHere: `${data.structure.node_count} source node(s) and ${data.rule_units.unit_count} rule unit(s) were returned. ${data.rule_units.needs_review_count} unit(s) need review.`,
    },
    {
      key: "anchors",
      label: "Anchors checked",
      status: `${data.structure.node_count} anchor source(s)`,
      tone: data.structure.validation_report.status === "clean" ? "pass" : getToneFromStatus(data.structure.validation_report.status),
      whatThisLayerDoes: "Connects result material back to source-backed structure so outputs do not float away from the input.",
      whatItChecks: "Checks source nodes, validation status, repaired sections, and structure issues.",
      howToUseIt: "Use this row to confirm whether the output has a traceable source basis.",
      whatHappenedHere: `Structure validation returned ${formatStatus(data.structure.validation_report.status)} with ${data.structure.validation_report.issues.length} issue(s).`,
    },
    {
      key: "meaning",
      label: "Meaning allowed",
      status: formatStatus(data.meaning.status),
      tone: getToneFromStatus(data.meaning.status),
      whatThisLayerDoes: "Turns supported structure into plain-language meaning after the source text has been separated.",
      whatItChecks: "Checks whether plain-language output is available, skipped, fallback, or missing information.",
      howToUseIt: "Use this row to read the human-facing result and check whether anything was skipped or limited.",
      whatHappenedHere: data.meaning.overall_plain_meaning || data.meaning.message || "No overall plain meaning was returned.",
    },
    {
      key: "verification",
      label: "Verification routed",
      status: `${verificationRoutes.size} system(s)`,
      tone: verificationRoutes.size > 0 ? "pass" : "warning",
      whatThisLayerDoes: "Identifies what outside record systems would be needed to verify claims or references.",
      whatItChecks: "Checks assertion signals, verification path availability, and expected record systems.",
      howToUseIt: "Use this row to see where a human or system should check the claim next.",
      whatHappenedHere: verificationRoutes.size > 0 ? `Routed to: ${Array.from(verificationRoutes).join(", ")}.` : "No external verification routes were returned for this input.",
    },
    {
      key: "governance",
      label: "Governance result",
      status: formatStatus(governanceStatus),
      tone: governanceIssues > 0 ? "warning" : getToneFromStatus(governanceStatus),
      whatThisLayerDoes: "Checks whether outputs are supported, complete, and safe to rely on as structured results.",
      whatItChecks: "Checks missing anchors, contradictions, unsupported actions, active issues, and review flags.",
      howToUseIt: "Use this to confirm the output is supported. If governance shows review or blocked, inspect the flagged issue before relying on the result.",
      whatHappenedHere: governanceIssues > 0 ? `${governanceIssues} governance issue(s) were returned.` : "No governance issues were returned for this run.",
    },
  ];
}

export function ReceiptWorkspace({ data }: { data: PipelineResponse }) {
  const rows = useMemo(() => buildRows(data), [data]);
  const [activeRow, setActiveRow] = useState<ReceiptRowKey>("governance");
  const [traceOpen, setTraceOpen] = useState(false);

  const activeIssues = data.governance?.issue_count ?? data.output.governance_issue_count ?? 0;
  const errors = data.errors.length;
  const reviewTone: ReceiptTone = errors > 0 ? "error" : activeIssues > 0 || data.rule_units.needs_review_count > 0 ? "warning" : "pass";
  const supportSystems = new Set<string>();
  for (const result of data.verification.node_results) {
    for (const system of result.expected_record_systems) supportSystems.add(system);
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-12">
        <section className="rounded-2xl border border-border/60 bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-muted">Tetherpoint Receipt</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Every result gets a receipt.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                A source integrity receipt showing what was received, separated, checked, routed, and cleared or flagged.
              </p>
            </div>
            <ReceiptActions data={data} onToggleTrace={() => setTraceOpen((value) => !value)} traceOpen={traceOpen} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="What happened" value={`${data.rule_units.unit_count} rule unit(s) processed`} tone="pass" />
          <SummaryCard label="What needs review" value={errors > 0 ? `${errors} error(s)` : activeIssues > 0 ? `${activeIssues} issue(s)` : "No issues returned"} tone={reviewTone} />
          <SummaryCard label="Where support exists" value={supportSystems.size > 0 ? `${supportSystems.size} route(s) found` : "No routes returned"} tone={supportSystems.size > 0 ? "pass" : "warning"} />
        </section>

        <section className="space-y-3">
          {rows.map((row) => (
            <ReceiptRowCard key={row.key} row={row} active={activeRow === row.key} onClick={() => setActiveRow(row.key)} />
          ))}
        </section>

        {traceOpen && <TechnicalTrace data={data} />}
      </div>
    </div>
  );
}
