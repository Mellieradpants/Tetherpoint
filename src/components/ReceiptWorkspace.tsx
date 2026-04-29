import { useMemo, useState } from "react";
import type { PipelineResponse } from "./Workspace";

export type { PipelineResponse } from "./Workspace";

type StageKey = "input" | "structure" | "origin" | "selection" | "rule_units" | "meaning" | "verification" | "governance" | "output";
type StageTone = "pass" | "warning" | "error" | "neutral";

type Stage = {
  key: StageKey;
  label: string;
  status: string;
  tone: StageTone;
  summary: string;
  whatItDoes: string;
  whatItChecks: string;
  howToUseIt: string;
  findings: Finding[];
  sourceSupport: string;
};

type Finding = {
  label: string;
  detail: string;
  tone: StageTone;
};

function formatStatus(value: string | null | undefined): string {
  if (!value) return "Not returned";
  return value.replaceAll("_", " ");
}

function toneClass(tone: StageTone): string {
  if (tone === "pass") return "border-primary/30 bg-primary/10 text-primary";
  if (tone === "warning") return "border-gold/40 bg-gold/10 text-gold-muted";
  if (tone === "error") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border/60 bg-background/30 text-muted-foreground";
}

function toneText(tone: StageTone): string {
  if (tone === "pass") return "text-primary";
  if (tone === "warning") return "text-gold-muted";
  if (tone === "error") return "text-destructive";
  return "text-muted-foreground";
}

function getToneFromStatus(status: string | null | undefined): StageTone {
  const value = status?.toLowerCase() ?? "";
  if (["blocked", "error", "failed", "fatal"].some((token) => value.includes(token))) return "error";
  if (["review", "fallback", "repaired", "missing", "skipped"].some((token) => value.includes(token))) return "warning";
  if (["ok", "clean", "match", "ready", "complete", "executed", "cleared", "passed"].some((token) => value.includes(token))) return "pass";
  return "neutral";
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

function buildReadableResult(data: PipelineResponse): string {
  const governanceStatus = data.governance?.status ?? data.output.governance_status ?? "not returned";
  const supportSystems = new Set<string>();

  for (const result of data.verification.node_results) {
    for (const system of result.expected_record_systems) supportSystems.add(system);
  }

  return [
    "Tetherpoint Result",
    "",
    `Input: ${formatStatus(data.input.parse_status)} (${data.input.content_type})`,
    `Structure: ${data.structure.node_count} source node(s), ${data.structure.validation_report.issues.length} issue(s)`,
    `Rule units: ${data.rule_units.unit_count} total, ${data.rule_units.needs_review_count} review`,
    `Meaning: ${formatStatus(data.meaning.status)}`,
    `Verification: ${supportSystems.size} route(s) found`,
    `Governance: ${formatStatus(governanceStatus)}`,
    `Errors: ${data.errors.length}`,
    "",
    "Plain-language result:",
    data.meaning.overall_plain_meaning || data.meaning.message || "No overall plain-language result returned.",
  ].join("\n");
}

function Actions({ data, onToggleTrace, traceOpen }: { data: PipelineResponse; onToggleTrace: () => void; traceOpen: boolean }) {
  const text = buildReadableResult(data);

  const copyResult = async () => {
    await navigator.clipboard.writeText(text);
  };

  const exportResult = () => {
    downloadText("tetherpoint-result.md", text, "text/markdown;charset=utf-8");
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
        {traceOpen ? "Hide technical trace" : "Show technical trace"}
      </button>
    </div>
  );
}

function StageTab({ stage, active, onClick }: { stage: Stage; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[86px] rounded-xl border px-3 py-3 text-center transition-colors ${
        active ? "border-gold/60 bg-gold/10 text-gold-muted" : "border-border/60 bg-surface/70 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest">{stage.label}</div>
      <div className={`mx-auto mt-2 h-2 w-2 rounded-full border ${toneClass(stage.tone)}`} />
    </button>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-muted">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClass(finding.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{finding.label}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{finding.detail}</div>
        </div>
        <span className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-widest">
          {finding.tone === "error" ? "blocked" : finding.tone === "warning" ? "review" : "ok"}
        </span>
      </div>
    </div>
  );
}

function ActiveStagePanel({ stage }: { stage: Stage }) {
  return (
    <section className="rounded-2xl border border-gold/30 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Selected function</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">{stage.label}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{stage.summary}</p>
        </div>
        <span className={`rounded-full border px-3 py-2 text-xs font-medium uppercase tracking-widest ${toneClass(stage.tone)}`}>
          {stage.status}
        </span>
      </div>

      <div className="grid gap-4 py-4 md:grid-cols-2">
        <DetailBlock title="What it does" body={stage.whatItDoes} />
        <DetailBlock title="What it checks" body={stage.whatItChecks} />
        <DetailBlock title="How to use it" body={stage.howToUseIt} />
        <DetailBlock title="Source support" body={stage.sourceSupport} />
      </div>

      <div className="border-t border-border/60 pt-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-muted">Findings</div>
        {stage.findings.length > 0 ? (
          <div className="space-y-2">
            {stage.findings.map((finding, index) => (
              <FindingRow key={`${finding.label}-${index}`} finding={finding} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary">No review items returned for this function.</div>
        )}
      </div>
    </section>
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
          <div className="mt-1 text-xs text-muted-foreground">Detailed pipeline response for technical review.</div>
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

function buildStages(data: PipelineResponse): Stage[] {
  const governanceStatus = data.governance?.status ?? data.output.governance_status ?? "not returned";
  const governanceIssues = data.governance?.issue_count ?? data.output.governance_issue_count ?? 0;
  const supportSystems = new Set<string>();

  for (const result of data.verification.node_results) {
    for (const system of result.expected_record_systems) supportSystems.add(system);
  }

  const errors = data.errors.map((error) => ({
    label: `${error.layer} error`,
    detail: error.error,
    tone: error.fatal ? "error" as StageTone : "warning" as StageTone,
  }));

  return [
    {
      key: "input",
      label: "Input",
      status: formatStatus(data.input.parse_status),
      tone: getToneFromStatus(data.input.parse_status),
      summary: "Checks the submitted content before the pipeline runs.",
      whatItDoes: "Validates document content, content type, size, and parsing readiness.",
      whatItChecks: "Checks that the source is present, supported, and available for processing.",
      howToUseIt: "Start here when a result looks wrong. Input problems usually mean the submitted source was empty, malformed, or the wrong type.",
      sourceSupport: `${data.input.size} character(s) received as ${data.input.content_type}.`,
      findings: data.input.parse_errors.map((error) => ({ label: "Input parse issue", detail: error, tone: "error" as StageTone })),
    },
    {
      key: "structure",
      label: "Structure",
      status: formatStatus(data.structure.validation_report.status),
      tone: data.structure.validation_report.status === "clean" ? "pass" : getToneFromStatus(data.structure.validation_report.status),
      summary: "Breaks the document into usable source-backed sections.",
      whatItDoes: "Separates source text into structured pieces without changing what the source says.",
      whatItChecks: "Checks source nodes, section boundaries, structure validation, repairs, and unsupported fragments.",
      howToUseIt: "Use this function to see whether the source was cleanly separated before meaning or verification is applied.",
      sourceSupport: `${data.structure.node_count} source node(s), ${data.structure.section_count} section(s).`,
      findings: data.structure.validation_report.issues.map((issue) => ({ label: issue.issue_type, detail: issue.message, tone: issue.severity === "error" ? "error" as StageTone : "warning" as StageTone })),
    },
    {
      key: "origin",
      label: "Origin",
      status: formatStatus(data.origin.status),
      tone: getToneFromStatus(data.origin.status),
      summary: "Looks for source identity and metadata signals.",
      whatItDoes: "Checks whether the document carries visible origin, metadata, or reference signals.",
      whatItChecks: "Checks identity signals, metadata signals, distribution signals, and referenced sources.",
      howToUseIt: "Use this function to understand what source information was visible in the submitted document.",
      sourceSupport: `${data.origin.origin_identity_signals.length + data.origin.origin_metadata_signals.length + data.origin.distribution_signals.length} origin signal(s) returned.`,
      findings: data.origin.warnings.map((warning) => ({ label: "Origin warning", detail: warning, tone: "warning" as StageTone })),
    },
    {
      key: "selection",
      label: "Selection",
      status: `${data.selection.selected_nodes.length} selected`,
      tone: data.selection.excluded_nodes.length > 0 ? "warning" : "pass",
      summary: "Filters which source pieces move forward.",
      whatItDoes: "Separates usable source-backed material from excluded or blocked material.",
      whatItChecks: "Checks selected nodes, excluded nodes, blocked flags, and selection status.",
      howToUseIt: "Use this function to see what the system allowed into later stages and what it left out.",
      sourceSupport: `${data.selection.selected_nodes.length} selected, ${data.selection.excluded_nodes.length} excluded.`,
      findings: data.selection.excluded_nodes.slice(0, 5).map((node) => ({ label: "Excluded source piece", detail: node.source_text || node.node_id, tone: "warning" as StageTone })),
    },
    {
      key: "rule_units",
      label: "Rule Units",
      status: `${data.rule_units.unit_count} unit(s)`,
      tone: data.rule_units.needs_review_count > 0 ? "warning" : "pass",
      summary: "Groups related source pieces into interpretable units.",
      whatItDoes: "Builds rule units from selected source material so the result can be inspected one unit at a time.",
      whatItChecks: "Checks assembly status, review state, source-node links, and whether each unit is eligible for meaning or verification.",
      howToUseIt: "Use this function to see whether the source material grouped cleanly before final output.",
      sourceSupport: `${data.rule_units.ready_count} ready, ${data.rule_units.needs_review_count} need review.`,
      findings: data.rule_units.rule_units.filter((unit) => unit.review_status !== "ready" || unit.assembly_issues.length > 0).slice(0, 5).map((unit) => ({ label: unit.rule_unit_id, detail: unit.assembly_issues.join(", ") || formatStatus(unit.review_status), tone: "warning" as StageTone })),
    },
    {
      key: "meaning",
      label: "Meaning",
      status: formatStatus(data.meaning.status),
      tone: getToneFromStatus(data.meaning.status),
      summary: "Turns supported structure into plain-language output.",
      whatItDoes: "Explains supported source structure in plain language without treating unsupported text as final meaning.",
      whatItChecks: "Checks whether meaning ran, skipped, used fallback, or returned errors.",
      howToUseIt: "Use this function to read the plain-language result and verify whether it was generated normally or through fallback.",
      sourceSupport: data.meaning.summary_basis ? `Summary basis: ${formatStatus(data.meaning.summary_basis)}.` : "No summary basis returned.",
      findings: data.meaning.node_results.filter((node) => node.status !== "ok" && node.status !== "fallback").slice(0, 5).map((node) => ({ label: node.node_id, detail: node.message || node.error || formatStatus(node.status), tone: getToneFromStatus(node.status) })),
    },
    {
      key: "verification",
      label: "Verification",
      status: `${supportSystems.size} system(s)`,
      tone: supportSystems.size > 0 ? "pass" : "warning",
      summary: "Routes claims to the record systems needed for checking.",
      whatItDoes: "Identifies what external evidence systems would be needed to verify claims or references.",
      whatItChecks: "Checks assertion type, verification path availability, expected record systems, and verification notes.",
      howToUseIt: "Use this function to see where the claim should be checked next outside the app.",
      sourceSupport: supportSystems.size > 0 ? Array.from(supportSystems).join(", ") : "No external record systems returned.",
      findings: data.verification.node_results.filter((node) => !node.verification_path_available).slice(0, 5).map((node) => ({ label: node.rule_unit_id || node.node_id, detail: node.verification_notes || "No verification path returned.", tone: "warning" as StageTone })),
    },
    {
      key: "governance",
      label: "Governance",
      status: formatStatus(governanceStatus),
      tone: governanceIssues > 0 ? "warning" : getToneFromStatus(governanceStatus),
      summary: "Checks whether outputs are supported, complete, and safe to rely on.",
      whatItDoes: "Confirms that the result has enough source support and follows required rules and checks.",
      whatItChecks: "Checks missing anchors, contradictions, unsupported actions, active issues, and review flags.",
      howToUseIt: "Use this to confirm the output is supported. If governance shows review or blocked, inspect the flagged issue before relying on the result.",
      sourceSupport: `${data.governance?.record_count ?? 0} governance record(s), ${governanceIssues} issue(s).`,
      findings: data.governance?.activeIssues.map((issue) => ({ label: issue.checkName, detail: issue.issue || issue.missingFields?.join(", ") || formatStatus(issue.status), tone: issue.status === "contradiction" ? "error" as StageTone : "warning" as StageTone })) ?? [],
    },
    {
      key: "output",
      label: "Output",
      status: data.errors.length > 0 ? `${data.errors.length} error(s)` : "assembled",
      tone: data.errors.length > 0 ? "error" : "pass",
      summary: "Assembles the final traceable result.",
      whatItDoes: "Collects the completed pipeline outputs into the visible result.",
      whatItChecks: "Checks output assembly, errors, and whether technical trace is available.",
      howToUseIt: "Use this function to confirm the result is complete before copying or exporting it.",
      sourceSupport: `Output contains ${data.errors.length} pipeline error(s).`,
      findings: errors,
    },
  ];
}

export function ReceiptWorkspace({ data }: { data: PipelineResponse }) {
  const stages = useMemo(() => buildStages(data), [data]);
  const [activeKey, setActiveKey] = useState<StageKey>("governance");
  const [traceOpen, setTraceOpen] = useState(false);
  const activeStage = stages.find((stage) => stage.key === activeKey) ?? stages[0];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-12">
        <section className="rounded-2xl border border-border/60 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Analysis result</div>
              <div className="mt-1 text-sm text-muted-foreground">Select a function to inspect what it checked and returned.</div>
            </div>
            <Actions data={data} onToggleTrace={() => setTraceOpen((value) => !value)} traceOpen={traceOpen} />
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-surface p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">How to use this result</div>
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
            <div><span className="text-foreground">1.</span> Pick a function.</div>
            <div><span className="text-foreground">2.</span> Read what it checked.</div>
            <div><span className="text-foreground">3.</span> Open trace only if needed.</div>
          </div>
        </section>

        <section>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Analysis stages</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {stages.map((stage) => (
              <StageTab key={stage.key} stage={stage} active={activeKey === stage.key} onClick={() => setActiveKey(stage.key)} />
            ))}
          </div>
        </section>

        <ActiveStagePanel stage={activeStage} />

        {traceOpen && <TechnicalTrace data={data} />}
      </div>
    </div>
  );
}
