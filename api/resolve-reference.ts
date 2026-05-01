type ResolveReferenceBody = {
  current_text?: string;
  plain_meaning?: string;
  referenced_sources?: string[];
  referenced_source_text?: string;
  source_anchors?: string[];
};

function sendJson(res: any, status: number, payload: Record<string, unknown>) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

async function readRawBody(req: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (error: Error) => {
      reject(error);
    });

    req.on("aborted", () => {
      reject(new Error("Request body was aborted."));
    });
  });
}

function parseBody(rawBody: string): ResolveReferenceBody {
  const parsed = rawBody.trim() ? JSON.parse(rawBody) : {};
  const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};

  return {
    current_text: typeof record.current_text === "string" ? record.current_text : "",
    plain_meaning: typeof record.plain_meaning === "string" ? record.plain_meaning : "",
    referenced_sources: Array.isArray(record.referenced_sources)
      ? record.referenced_sources.filter((value): value is string => typeof value === "string")
      : [],
    referenced_source_text: typeof record.referenced_source_text === "string" ? record.referenced_source_text : "",
    source_anchors: Array.isArray(record.source_anchors)
      ? record.source_anchors.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function extractJsonObject(value: string): unknown {
  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Reference resolver did not return valid JSON.");
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  let body: ResolveReferenceBody;

  try {
    body = parseBody(await readRawBody(req));
  } catch (error) {
    sendJson(res, 400, {
      message: error instanceof Error ? error.message : "Invalid JSON request body.",
    });
    return;
  }

  const currentText = (body.current_text || "").trim();
  const plainMeaning = (body.plain_meaning || "").trim();
  const referencedSources = body.referenced_sources || [];
  const referencedSourceText = (body.referenced_source_text || "").trim();
  const sourceAnchors = body.source_anchors || [];

  if (!currentText) {
    sendJson(res, 400, { message: "Current source text is required for reference resolution." });
    return;
  }

  if (referencedSources.length === 0) {
    sendJson(res, 400, { message: "At least one referenced source name is required." });
    return;
  }

  if (!referencedSourceText) {
    sendJson(res, 400, { message: "Referenced source text is required for this first resolver prototype." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.REFERENCE_RESOLUTION_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    sendJson(res, 500, {
      message: "OPENAI_API_KEY is not configured for reference resolution.",
    });
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a bounded Extended Meaning reference-integration engine for Tetherpoint. AI must not run by default; this resolver is only for current source text that already contains explicit outside references such as referenced acts, section citations, external definitions, as defined in, pursuant to, or cross-references to another law, rule, or code. Do not give legal advice. Do not make policy judgments. Do not decide whether a law is valid, enforceable, constitutional, good policy, or true. Do not predict outcomes unless the supplied text supports them. Do not infer from topic association, do not blend categories such as voting topics, and do not fetch or use outside law. Use only the supplied current source text, deterministic plain meaning, referenced source names, pasted referenced source text, and source anchors when provided. Extended Meaning is not a summary. It must integrate current text plus referenced source text into source-anchored operational meaning. Identify who is affected, what changes, when it applies, where in the process it applies, how the process or requirement changes, why the referenced source matters, affected actor effects, reference source mappings, what does not follow from the supplied text, and limits. For each referenced source, identify the role in the current rule, the specific supplied text used, one effectType, how it connects to the current rule, and the plain-language effect. effectType must be one of document_requirement, registration_framework, timing_deadline, agency_process, form_requirement, eligibility_condition, definition_imported, authority_modified, or not_supported_by_text. If source text is missing, vague, incomplete, or a claim does not follow from the supplied text, set status to needs_review, say so directly in whatDoesNotFollowFromSuppliedText or limits, and do not fill gaps with broad interpretation. Return JSON only with exactly this shape: {\"status\":\"resolved\"|\"needs_review\",\"whoIsAffected\":string,\"whatChanges\":string,\"whenItApplies\":string,\"whereInProcessItApplies\":string,\"howProcessOrRequirementChanges\":string,\"whyReferencedSourceMatters\":string,\"affectedActorEffects\":[string],\"referencedSourceMappings\":[{\"sourceName\":string,\"roleInCurrentRule\":string,\"specificTextUsed\":string,\"effectType\":\"document_requirement\"|\"registration_framework\"|\"timing_deadline\"|\"agency_process\"|\"form_requirement\"|\"eligibility_condition\"|\"definition_imported\"|\"authority_modified\"|\"not_supported_by_text\",\"howItConnectsToCurrentRule\":string,\"plainLanguageEffect\":string}],\"whatDoesNotFollowFromSuppliedText\":[string],\"limits\":[string]}."
          },
          {
            role: "user",
            content: JSON.stringify({
              currentText,
              plainMeaning,
              referencedSources,
              referencedSourceText,
              sourceAnchors,
            }),
          },
        ],
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      sendJson(res, response.status, {
        message: payload?.error?.message || "Reference resolution request failed.",
      });
      return;
    }

    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      sendJson(res, 502, { message: "Reference resolver response did not include content." });
      return;
    }

    const resolved = extractJsonObject(content);
    sendJson(res, 200, resolved as Record<string, unknown>);
  } catch (error) {
    sendJson(res, 502, {
      message: error instanceof Error ? error.message : "Reference resolution request failed.",
    });
  }
}
