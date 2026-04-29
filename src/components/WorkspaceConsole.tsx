import { useMemo, useState, type ReactNode } from "react";
import type { PipelineResponse } from "./Workspace";

export type { PipelineResponse } from "./Workspace";

type DetailTab = "structure" | "source_text" | "meaning" | "verification" | "governance" | "signals" | "errors";
type SelectedKind = "rule_unit" | "source_node";
type RuleUnit = PipelineResponse["rule_units"]["rule_units"][number];
type StructureNode = PipelineResponse["structure"]["nodes"][number];
type MeaningNodeResult = PipelineResponse["meaning"]["node_results"][number];
type VerificationNode = PipelineResponse["verification"]["node_results"][number];

const PIPELINE_LAYERS = [
  "Input",
  "Structure",
  "Origin",
  "Selection",
  "Rule Units",
  "Verification",
  "Meaning",
  "Governance",
  "Output",
];

const ASSERTION_TYPE_LABELS: Record<string, string> = {
  legal_legislative: "Law / legislative records",
  court_case_law: "Court / case-law records",
  government_publication: "Government publication records",
  scientific_biomedical: "Scientific / biomedical records",
  statistical_public_data: "Public data / statistics records",
  corporate_financial: "Corporate / financial records",
  infrastructure_energy: "Energy / infrastructure records",
  historical_archival: "Historical / archival records",
};

function formatStatus(status: string | null | undefined): string {
  if (!status) return "Not specified";
  return status.replaceAll("_", " ");
}

function formatAssertionType(assertionType: string | null | undefined): string {
  if (!assertionType) return "Not specified";
  return ASSERTION_TYPE_LABELS[assertionType] ?? assertionType.replaceAll("_", " ");
}

function statusTone(status: string | null | undefined): string {
  const normalized = status?.toLowerCase() ?? "";
  if (["error", "blocked", "failed", "fatal"].some((token) => normalized.includes(token))) {
    return "border-destructive/50 bg-destructive/10 text-destructive";
  }
  if (["needs_review", "fallback", "repaired", "skipped", "review"].some((token) => normalized.includes(token))) {
    return "border-gold/30 bg-gold/10 text-gold-muted";
  }
  if (["executed", "ok", "clean", "match", "ready", "complete", "assembled"].some((token) => normalized.includes(token))) {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  return "border-border/60 bg-background/30 text-muted-foreground";
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-sm italic text-muted-foreground">{message}</div>;
}

function StatusPill({ label, status }: { label: string; status: string | null | undefined }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-widest ${statusTone(status)}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="mx-1 text-border">/</span>
      <span>{formatStatus(status)}</span>
    </span>
  );
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/50 py-2 last:border-0 md:grid-cols-[150px_1fr] md:gap-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="text-sm leading-relaxed text-foreground">{value || "Not specified"}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-surface p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">{title}</div>
      {children}
    </section>
  );
}

function TextBlock({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-border/50 bg-background/40 p-3 text-sm leading-relaxed text-foreground">{children}</div>;
}

function CompactEngineRail({ data, routeCount }: { data: PipelineResponse; routeCount: number }) {
  const governanceStatus = data.governance?.status ?? data.output.governance_status ?? "not returned";
  const layerStatuses: Record<string, string> = {
    Input: data.input.parse_status,
    Structure: data.structure.validation_report.status,
    Origin: data.origin.status,
    Selection: `${data.selection.selected_nodes.length} selected`,
    "Rule Units": `${data.rule_units.ready_count} ready`,
    Verification: data.verification.status,
    Meaning: data.meaning.status,
    Governance: governanceStatus,
    Output: data.errors.length ? "review" : "assembled",
  };

  return (
    <div className="border-b border-border bg-surface/40 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gold-muted">Engine Trace Console</div>
          <div className="mt-1 text-xs text-muted-foreground">Tetherpoint inspection surface · 9-layer source-anchored pipeline</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label="governance" status={governanceStatus} />
          {data.errors.length > 0 && <StatusPill label="errors" status={`${data.errors.length} review`} />}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {PIPELINE_LAYERS.map((layer, index) => (
          <div key={layer} className="min-w-[104px] rounded-lg border border-border/50 bg-background/30 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              <span className={`h-2 w-2 rounded-full border ${statusTone(layerStatuses[layer])}`} />
            </div>
            <div className="mt-1 truncate text-xs font-semibold text-foreground">{layer}</div>
            <div className="mt-1 truncate text-[10px] text-muted-foreground">{formatStatus(layerStatuses[layer])}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="source nodes" value={data.structure.node_count} />
        <Metric label="selected" value={data.selection.selected_nodes.length} />
        <Metric label="rule units" value={data.rule_units.unit_count} />
        <Metric label="routes" value={routeCount} />
        <Metric label="issues" value={data.governance?.issue_count ?? data.output.governance_issue_count ?? 0} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function NavigationButton({ active, title, subtitle, onClick }: { active: boolean; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
        active ? "border-gold/40 bg-gold/10 text-foreground" : "border-border/50 bg-background/25 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      <div className="truncate text-sm font-semibold">{title}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
    </button>
  );
}

function SidePanel({
  nodes,
  ruleUnits,
  selectedKind,
  selectedId,
  setSelectedKind,
  setSelectedId,
}: {
  nodes: StructureNode[];
  ruleUnits: RuleUnit[];
  selectedKind: SelectedKind;
  selectedId: string | null;
  setSelectedKind: (kind: SelectedKind) => void;
  setSelectedId: (id: string) => void;
}) {
  return (
    <aside className="border-b border-border bg-surface/20 md:w-[340px] md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="space-y-5 p-4">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Rule Units</div>
          <div className="space-y-2">
            {ruleUnits.length === 0 ? (
              <EmptyState message="No rule units returned." />
            ) : (
              ruleUnits.map((unit, index) => (
                <NavigationButton
                  key={unit.rule_unit_id}
                  active={selectedKind === "rule_unit" && selectedId === unit.rule_unit_id}
                  title={`${String(index + 1).padStart(2, "0")} · ${unit.rule_unit_id}`}
                  subtitle={unit.primary_text || unit.source_text_combined || formatStatus(unit.review_status)}
                  onClick={() => {
                    setSelectedKind("rule_unit");
                    setSelectedId(unit.rule_unit_id);
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">Source Structure</div>
          <div className="space-y-2">
            {nodes.length === 0 ? (
              <EmptyState message="No source nodes returned." />
            ) : (
              nodes.map((node) => (
                <NavigationButton
                  key={node.node_id}
                  active={selectedKind === "source_node" && selectedId === node.node_id}
                  title={`${node.node_id} · ${formatStatus(node.role)}`}
                  subtitle={node.source_text || node.normalized_text || node.section_id}
                  onClick={() => {
                    setSelectedKind("source_node");
                    setSelectedId(node.node_id);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-medium uppercase tracking-widest transition-colors ${
        active ? "border-gold/30 bg-gold/10 text-foreground" : "border-border/60 bg-background/20 text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function DetailHeader({ selectedUnit, selectedNode, selectedKind }: { selectedUnit?: RuleUnit; selectedNode?: StructureNode; selectedKind: SelectedKind }) {
  const title = selectedKind === "rule_unit"
    ? selectedUnit?.rule_unit_id ?? "No rule unit selected"
    : selectedNode?.node_id ?? "No source node selected";
  const subtitle = selectedKind === "rule_unit"
    ? selectedUnit?.primary_text || selectedUnit?.source_text_combined || "Rule Unit detail"
    : selectedNode?.source_text || selectedNode?.normalized_text || "Source node detail";

  return (
    <div className="border-b border-border bg-surface/20 px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
        {selectedKind === "rule_unit" ? "Selected Rule Unit" : "Selected Source Node"}
      </div>
      <div className="mt-1 font-mono text-sm text-foreground">{title}</div>
      <div className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function RuleUnitStructure({ unit }: { unit?: RuleUnit }) {
  if (!unit) return <EmptyState message="No rule unit selected." />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Assembly">
        <FieldRow label="section" value={unit.section_id} />
        <FieldRow label="primary node" value={unit.primary_node_id || "Not specified"} />
        <FieldRow label="assembly" value={<StatusPill label="status" status={unit.assembly_status} />} />
        <FieldRow label="review" value={<StatusPill label="status" status={unit.review_status} />} />
        <FieldRow label="meaning eligible" value={unit.meaning_eligible ? "yes" : "no"} />
        <FieldRow label="verification eligible" value={unit.verification_eligible ? "yes" : "no"} />
      </Panel>
      <Panel title="Source Anchors">
        <AnchorList ids={[...unit.source_node_ids, ...unit.fragment_node_ids]} />
      </Panel>
    </div>
  );
}

function NodeStructure({ node }: { node?: StructureNode }) {
  if (!node) return <EmptyState message="No source node selected." />;

  return (
    <Panel title="Node Structure">
      <FieldRow label="section" value={node.section_id} />
      <FieldRow label="parent" value={node.parent_id || "None"} />
      <FieldRow label="role" value={formatStatus(node.role)} />
      <FieldRow label="depth" value={String(node.depth)} />
      <FieldRow label="anchor" value={node.source_anchor} />
      <FieldRow label="validation" value={<StatusPill label="status" status={node.validation_status} />} />
    </Panel>
  );
}

function AnchorList({ ids }: { ids: string[] }) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return <EmptyState message="No anchors returned." />;
  return (
    <div className="flex flex-wrap gap-2">
      {unique.map((id) => (
        <span key={id} className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          {id}
        </span>
      ))}
    </div>
  );
}

function NodeRefList({ label, items }: { label: string; items: { node_id: string; text: string; role: string }[] }) {
  if (items.length === 0) return null;
  return (
    <Panel title={label}>
      <div className="space-y-2">
        {items.map((item) => (
          <TextBlock key={`${label}-${item.node_id}`}>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{item.node_id} · {formatStatus(item.role)}</div>
            {item.text}
          </TextBlock>
        ))}
      </div>
    </Panel>
  );
}

function MeaningView({ data, unit, meaning }: { data: PipelineResponse; unit?: RuleUnit; meaning?: MeaningNodeResult }) {
  if (unit) {
    if (!meaning) return <EmptyState message="No plain meaning returned for this rule unit." />;
    return (
      <Panel title="Plain Meaning">
        {meaning.plain_meaning ? <div className="text-sm leading-relaxed text-foreground">{meaning.plain_meaning}</div> : <EmptyState message={meaning.message || meaning.error || "Plain meaning unavailable."} />}
      </Panel>
    );
  }

  return (
    <Panel title="Document Meaning">
      {data.meaning.overall_plain_meaning ? (
        <div className="space-y-3 text-sm leading-relaxed text-foreground">
          {data.meaning.overall_plain_meaning.split(/\n\s*\n/).map((paragraph, index) => <p key={`meaning-${index}`}>{paragraph}</p>)}
        </div>
      ) : (
        <EmptyState message="No overall plain meaning returned." />
      )}
    </Panel>
  );
}

function VerificationView({ verification, routes }: { verification?: VerificationNode; routes: { system: string; unitIds: string[]; assertionTypes: string[] }[] }) {
  if (verification) {
    return (
      <Panel title="Verification Routing">
        <FieldRow label="assertion" value={verification.assertion_detected ? "detected" : "not detected"} />
        <FieldRow label="type" value={formatAssertionType(verification.assertion_type)} />
        <FieldRow label="path" value={verification.verification_path_available ? "available" : "not available"} />
        <FieldRow label="systems" value={verification.expected_record_systems.length ? verification.expected_record_systems.join(", ") : "No systems returned"} />
        <FieldRow label="notes" value={verification.verification_notes || "None"} />
      </Panel>
    );
  }

  return (
    <Panel title="Document Verification Routes">
      {routes.length === 0 ? (
        <EmptyState message="No verification routes returned." />
      ) : (
        <div className="space-y-2">
          {routes.map((route) => (
            <TextBlock key={route.system}>
              <div className="font-semibold text-foreground">{route.system}</div>
              <div className="mt-1 text-xs text-muted-foreground">{route.unitIds.length} rule unit(s) · {route.assertionTypes.map(formatAssertionType).join(", ") || "type not specified"}</div>
            </TextBlock>
          ))}
        </div>
      )}
    </Panel>
  );
}

function GovernanceView({ governance }: { governance?: PipelineResponse["governance"] }) {
  if (!governance) return <EmptyState message="Governance results were not returned." />;
  return (
    <div className="space-y-4">
      <Panel title="Governance Summary">
        <FieldRow label="status" value={<StatusPill label="status" status={governance.status} />} />
        <FieldRow label="checked" value={`${governance.record_count} record(s)`} />
        <FieldRow label="issues" value={`${governance.issue_count} issue(s)`} />
        <FieldRow label="principle" value={governance.principle} />
      </Panel>
      <Panel title="Active Issues">
        {governance.activeIssues.length === 0 ? (
          <EmptyState message="No active governance issues." />
        ) : (
          <div className="space-y-2">
            {governance.activeIssues.map((issue, index) => (
              <TextBlock key={`${issue.checkName}-${index}`}>
                <div className="font-semibold text-foreground">{issue.checkName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatStatus(issue.status)}</div>
                {issue.issue && <div className="mt-2">{issue.issue}</div>}
                {issue.missingFields && issue.missingFields.length > 0 && <div className="mt-2">Missing fields: {issue.missingFields.join(", ")}</div>}
              </TextBlock>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function OriginSignals({ data }: { data: PipelineResponse }) {
  const signals = [
    ...data.origin.origin_identity_signals,
    ...data.origin.origin_metadata_signals,
    ...data.origin.distribution_signals,
  ];

  return (
    <div className="space-y-4">
      <Panel title="Origin Signals">
        {signals.length === 0 ? (
          <EmptyState message="No origin metadata signals returned." />
        ) : (
          <div className="space-y-2">
            {signals.map((signal, index) => (
              <FieldRow key={`${signal.signal}-${index}`} label={signal.signal} value={signal.value} />
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Referenced Sources">
        {!data.origin.referenced_sources || data.origin.referenced_sources.length === 0 ? (
          <EmptyState message="No referenced sources detected." />
        ) : (
          <div className="space-y-2">
            {data.origin.referenced_sources.map((source) => (
              <TextBlock key={source.reference_id}>
                <div className="font-semibold text-foreground">{source.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{source.reference_type}{source.source_system ? ` · ${source.source_system}` : ""}</div>
                {source.why_it_matters && <div className="mt-2">{source.why_it_matters}</div>}
              </TextBlock>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SignalsView({ unit, node }: { unit?: RuleUnit; node?: StructureNode }) {
  if (unit) {
    return (
      <div className="space-y-4">
        <NodeRefList label="Conditions" items={unit.conditions} />
        <NodeRefList label="Exceptions" items={unit.exceptions} />
        <NodeRefList label="Evidence Requirements" items={unit.evidence_requirements} />
        <NodeRefList label="Consequences" items={unit.consequences} />
        <NodeRefList label="Definitions" items={unit.definitions} />
        <NodeRefList label="Timing" items={unit.timing} />
        <NodeRefList label="Jurisdiction" items={unit.jurisdiction} />
        <NodeRefList label="Mechanisms" items={unit.mechanisms} />
      </div>
    );
  }

  if (!node) return <EmptyState message="No source node selected." />;
  return (
    <Panel title="Extracted Signals">
      <FieldRow label="actor" value={node.actor || node.who || "Not specified"} />
      <FieldRow label="action" value={node.action || node.what || "Not specified"} />
      <FieldRow label="condition" value={node.condition || "Not specified"} />
      <FieldRow label="temporal" value={node.temporal || node.when || "Not specified"} />
      <FieldRow label="jurisdiction" value={node.jurisdiction || node.where || "Not specified"} />
      <FieldRow label="mechanism" value={node.mechanism || node.how || "Not specified"} />
      <FieldRow label="tags" value={node.tags.length ? node.tags.join(", ") : "None"} />
      <FieldRow label="blocked flags" value={node.blocked_flags.length ? node.blocked_flags.join(", ") : "None"} />
    </Panel>
  );
}

function ErrorsView({ errors }: { errors: PipelineResponse["errors"] }) {
  if (errors.length === 0) return <EmptyState message="No pipeline errors returned." />;
  return (
    <div className="space-y-2">
      {errors.map((error, index) => (
        <TextBlock key={`${error.layer}-${index}`}>
          <div className="font-semibold text-destructive">{error.layer}</div>
          <div className="mt-2 text-destructive">{error.error}</div>
          {error.fatal && <div className="mt-2 text-xs uppercase tracking-widest text-destructive">fatal</div>}
        </TextBlock>
      ))}
    </div>
  );
}

export function Workspace({ data }: { data: PipelineResponse }) {
  const ruleUnits = data.rule_units?.rule_units ?? [];
  const nodes = data.structure?.nodes ?? [];
  const firstUnitId = ruleUnits[0]?.rule_unit_id ?? null;
  const firstNodeId = nodes[0]?.node_id ?? null;
  const [selectedKind, setSelectedKind] = useState<SelectedKind>(firstUnitId ? "rule_unit" : "source_node");
  const [selectedId, setSelectedId] = useState<string | null>(firstUnitId ?? firstNodeId);
  const [activeTab, setActiveTab] = useState<DetailTab>("structure");

  const meaningMap = useMemo(
    () => new Map(data.meaning.node_results.map((node) => [node.node_id, node])),
    [data.meaning.node_results]
  );

  const verificationByUnit = useMemo(
    () => new Map(data.verification.node_results.map((node) => [node.rule_unit_id || node.node_id, node])),
    [data.verification.node_results]
  );

  const verificationSummary = useMemo(() => {
    const routes = new Map<string, { unitIds: Set<string>; assertionTypes: Set<string> }>();
    for (const result of data.verification.node_results) {
      const unitId = result.rule_unit_id || result.node_id;
      for (const system of result.expected_record_systems) {
        if (!routes.has(system)) routes.set(system, { unitIds: new Set(), assertionTypes: new Set() });
        const route = routes.get(system)!;
        route.unitIds.add(unitId);
        if (result.assertion_type) route.assertionTypes.add(result.assertion_type);
      }
    }
    return Array.from(routes.entries()).map(([system, route]) => ({
      system,
      unitIds: Array.from(route.unitIds),
      assertionTypes: Array.from(route.assertionTypes),
    }));
  }, [data.verification.node_results]);

  const selectedUnit = selectedKind === "rule_unit"
    ? ruleUnits.find((unit) => unit.rule_unit_id === selectedId) ?? ruleUnits[0]
    : undefined;
  const selectedNode = selectedKind === "source_node"
    ? nodes.find((node) => node.node_id === selectedId) ?? nodes[0]
    : undefined;
  const selectedMeaning = selectedUnit ? meaningMap.get(selectedUnit.rule_unit_id) : undefined;
  const selectedVerification = selectedUnit ? verificationByUnit.get(selectedUnit.rule_unit_id) : undefined;

  const tabs: DetailTab[] = ["structure", "source_text", "meaning", "verification", "governance", "signals", "errors"];

  return (
    <div className="flex h-full flex-col bg-background">
      <CompactEngineRail data={data} routeCount={verificationSummary.length} />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SidePanel
          nodes={nodes}
          ruleUnits={ruleUnits}
          selectedKind={selectedKind}
          selectedId={selectedId}
          setSelectedKind={setSelectedKind}
          setSelectedId={setSelectedId}
        />

        <main className="flex min-h-0 flex-1 flex-col">
          <DetailHeader selectedUnit={selectedUnit} selectedNode={selectedNode} selectedKind={selectedKind} />

          <div className="border-b border-border bg-surface/20 px-4 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => (
                <TabButton key={tab} active={activeTab === tab} label={tab.replace("_", " ")} onClick={() => setActiveTab(tab)} />
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "structure" && (selectedKind === "rule_unit" ? <RuleUnitStructure unit={selectedUnit} /> : <NodeStructure node={selectedNode} />)}
            {activeTab === "source_text" && (
              <Panel title="Source Text">
                <TextBlock>{selectedUnit?.source_text_combined || selectedNode?.source_text || data.input.raw_content || "No source text returned."}</TextBlock>
              </Panel>
            )}
            {activeTab === "meaning" && <MeaningView data={data} unit={selectedUnit} meaning={selectedMeaning} />}
            {activeTab === "verification" && <VerificationView verification={selectedVerification} routes={verificationSummary} />}
            {activeTab === "governance" && <GovernanceView governance={data.governance} />}
            {activeTab === "signals" && (selectedKind === "rule_unit" ? <SignalsView unit={selectedUnit} /> : <SignalsView node={selectedNode} />)}
            {activeTab === "errors" && <ErrorsView errors={data.errors} />}
          </div>
        </main>
      </div>
    </div>
  );
}
