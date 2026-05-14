import { useState } from "react";
import type { PipelineResponse } from "../../types/pipeline";
import { displayStatus, hideAtomicReferences, safeArray } from "./shared";

function buildResultText(data: PipelineResponse) {
  const governanceStatus = data.governance?.status ?? data.output?.governance_status;
  const governanceIssues = data.governance?.issue_count ?? data.output?.governance_issue_count ?? 0;
  const plainMeaning = hideAtomicReferences(data.meaning?.overall_plain_meaning || data.meaning?.message || "No plain meaning returned.");
  const systems = new Set<string>();

  for (const result of safeArray(data.verification?.node_results)) {
    for (const system of safeArray(result.expected_record_systems)) systems.add(system);
  }

  return [
    "Tetherpoint Result",
    "",
    "Plain Meaning",
    plainMeaning,
    "",
    "Origin",
    `Status: ${displayStatus(data.origin?.status)}`,
    "",
    "Verification",
    systems.size > 0 ? `Record systems: ${Array.from(systems).join(", ")}` : "No verification record systems returned.",
    "",
    "Governance",
    `Status: ${displayStatus(governanceStatus)}`,
    `Issue count: ${governanceIssues}`,
  ].join("\n");
}

function exportText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ResultActions({ data }: { data: PipelineResponse }) {
  const [status, setStatus] = useState<string | null>(null);
  const resultText = buildResultText(data);

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setStatus("Result copied.");
    } catch {
      setStatus("Copy failed. Use export instead.");
    }
  };

  const exportResult = () => {
    exportText("tetherpoint-result.txt", resultText);
    setStatus("Result exported.");
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copyResult} className="rounded-md border border-border/60 bg-background/30 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40">
          Copy result
        </button>
        <button type="button" onClick={exportResult} className="rounded-md border border-border/60 bg-background/30 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40">
          Export result
        </button>
      </div>
      {status && <div className="text-xs text-muted-foreground">{status}</div>}
    </div>
  );
}
