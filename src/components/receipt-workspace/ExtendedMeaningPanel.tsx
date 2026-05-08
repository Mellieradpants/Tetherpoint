import { useState } from "react";
import { resolveReference, type ResolveReferenceResponse } from "../../lib/api-client";
import type { PipelineResponse } from "../Workspace";
import { safeArray, Section, StatusPill, DetailRow, SourceQuote } from "./shared";

type RuleUnitReferencePacket = {
  name: string;
  referenceType: string;
  matchedText: string;
  officialSourceUrl?: string | null;
  retrievalStatus: "not_attempted" | "manual_required" | "retrieved" | "failed";
  sourceText?: string;
  anchors?: string[];
  limits?: string[];
};

type RuleUnitWithReferenceMetadata = PipelineResponse["rule_units"]["rule_units"][number] & {
  requires_reference_resolution?: boolean;
  referenced_sources?: RuleUnitReferencePacket[];
};

type GovernanceGateReferenceRole = {
  source: string;
  role: string;
  reason?: string | null;
};

type GovernanceGateData = {
  reference_roles?: GovernanceGateReferenceRole[];
  practical_questions?: string[];
  limits?: string[];
};

type PipelineResponseWithGovernanceGate = PipelineResponse & {
  governance_gate?: GovernanceGateData;
};

function uniqueReferencePackets(units: RuleUnitWithReferenceMetadata[]): RuleUnitReferencePacket[] {
  const seen: Set<string> = new Set();
  const packets: RuleUnitReferencePacket[] = [];

  for (const unit of units) {
    for (const packet of safeArray(unit.referenced_sources)) {
      const key = `${packet.name}|${packet.matchedText}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      packets.push(packet);
    }
  }

  return packets;
}

function referenceUnits(data: PipelineResponse): RuleUnitWithReferenceMetadata[] {
  return (safeArray(data.rule_units?.rule_units) as RuleUnitWithReferenceMetadata[]).filter(
    (unit) => Boolean(unit.requires_reference_resolution) && safeArray(unit.referenced_sources).length > 0
  );
}

export function hasExtendedMeaningReferences(data: PipelineResponse): boolean {
  return referenceUnits(data).length > 0;
}

export function ExtendedMeaningPanel({ data, plainMeaning }: { data: PipelineResponse; plainMeaning: string }) {
  const [referencedSourceText, setReferencedSourceText] = useState("");
  const [result, setResult] = useState<ResolveReferenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const units = referenceUnits(data);
  const referencePackets = uniqueReferencePackets(units);
  const governanceGate = (data as PipelineResponseWithGovernanceGate).governance_gate;
  const referenceRoleBySource = new Map(
    safeArray(governanceGate?.reference_roles).map((role) => [
      role.source.toLowerCase(),
      role,
    ])
  );
  const practicalQuestions = safeArray(governanceGate?.practical_questions);
  const gateLimits = safeArray(governanceGate?.limits);
  const referencedSources = referencePackets.map((packet) => packet.name);
  const currentText = units
    .map((unit) => unit.source_text_combined || unit.primary_text || "")
    .filter(Boolean)
    .join("\n\n") || data.input.raw_content;
  const sourceAnchors = [
    ...units.map((unit) => {
      const text = unit.source_text_combined || unit.primary_text || "";
      return text ? `${unit.rule_unit_id}: ${text}` : "";
    }),
    ...referencePackets.flatMap((packet) => safeArray(packet.anchors).map((anchor) => `${packet.name}: ${anchor}`)),
  ].filter(Boolean);

  const runResolver = async () => {
    setResolving(true);
    setError(null);
    setResult(null);

    try {
      const response = await resolveReference({
        current_text: currentText,
        plain_meaning: plainMeaning,
        referenced_sources: referencedSources,
        referenced_source_text: referencedSourceText,
        source_anchors: sourceAnchors,
      });
      setResult(response);
    } catch (resolverError) {
      setError(resolverError instanceof Error ? resolverError.message : "Extended meaning failed.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <Section title="Extended Meaning">
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Uses referenced source text you provide to show how outside references connect to the current rule.
        </p>

        {referencePackets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {referencePackets.map((packet) => (
              <span key={`${packet.name}-${packet.matchedText}`} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {packet.name}
              </span>
            ))}
          </div>
        )}

        {referencePackets.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-muted">
              Reference Packets
            </div>

            <div className="space-y-3">
              {referencePackets.map((packet) => {
                const role = referenceRoleBySource.get(packet.name.toLowerCase());

                return (
                  <div
                    key={`${packet.name}-${packet.matchedText || packet.referenceType}`}
                    className="rounded-lg border border-border/50 bg-surface p-3"
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {packet.name}
                    </div>

                    {role?.role && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Role: {role.role}
                      </div>
                    )}

                    {packet.matchedText && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Matched text: {packet.matchedText}
                      </div>
                    )}

                    {packet.retrievalStatus && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Retrieval status: {packet.retrievalStatus}
                      </div>
                    )}

                    {packet.officialSourceUrl && (
                      <a
                        href={packet.officialSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-primary underline underline-offset-2"
                      >
                        Open official source
                      </a>
                    )}

                    {safeArray(packet.limits).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Limits: {safeArray(packet.limits).join("; ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {practicalQuestions.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Needed to resolve
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {practicalQuestions.slice(0, 5).map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            )}

            {gateLimits.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Limits
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {gateLimits.map((limit) => (
                    <li key={limit}>{limit}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <textarea
          value={referencedSourceText}
          onChange={(event) => setReferencedSourceText(event.target.value)}
          placeholder="Paste referenced act, section, definition, or official source text here."
          className="min-h-40 w-full rounded-lg border border-border bg-background/40 p-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={runResolver}
          disabled={resolving || !referencedSourceText.trim() || referencedSources.length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {resolving ? "Generating..." : "Generate Extended Meaning"}
        </button>
        {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {result && (
          <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-3">
            <StatusPill label="extended meaning" status={result.status} />
            {result.whoIsAffected && <DetailRow label="who is affected" value={result.whoIsAffected} />}
            {result.whatChanges && <DetailRow label="what changes" value={result.whatChanges} />}
            {result.whenItApplies && <DetailRow label="when it applies" value={result.whenItApplies} />}
            {result.whereInProcessItApplies && <DetailRow label="where in the process it applies" value={result.whereInProcessItApplies} />}
            {result.howProcessOrRequirementChanges && <DetailRow label="how the process or requirement changes" value={result.howProcessOrRequirementChanges} />}
            {result.whyReferencedSourceMatters && <DetailRow label="why the referenced source matters" value={result.whyReferencedSourceMatters} />}
            {safeArray(result.affectedActorEffects).length > 0 && (
              <DetailRow
                label="affected actor effects"
                value={safeArray(result.affectedActorEffects).map((effect, index) => <div key={`actor-effect-${index}`}>{effect}</div>)}
              />
            )}
            {safeArray(result.referencedSourceMappings).map((mapping, index) => (
              <div key={`${mapping.sourceName}-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-foreground">{mapping.sourceName}</div>
                  <StatusPill label="effect" status={mapping.effectType} />
                </div>
                {mapping.roleInCurrentRule && <DetailRow label="role in current rule" value={mapping.roleInCurrentRule} />}
                {mapping.specificTextUsed && (
                  <div className="mt-3">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Specific text used</div>
                    <SourceQuote>{mapping.specificTextUsed}</SourceQuote>
                  </div>
                )}
                {mapping.howItConnectsToCurrentRule && <DetailRow label="how it connects to the current rule" value={mapping.howItConnectsToCurrentRule} />}
                {mapping.plainLanguageEffect && <DetailRow label="plain-language effect" value={mapping.plainLanguageEffect} />}
              </div>
            ))}
            {safeArray(result.whatDoesNotFollowFromSuppliedText).length > 0 && (
              <DetailRow
                label="what does not follow from the supplied text"
                value={safeArray(result.whatDoesNotFollowFromSuppliedText).map((item, index) => <div key={`unsupported-${index}`}>{item}</div>)}
              />
            )}
            {safeArray(result.limits).length > 0 && (
              <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                {result.limits.map((limit, index) => <div key={`limit-${index}`}>Limit: {limit}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
