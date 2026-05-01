/**
 * Frontend API client - analysis requests route through local server proxies
 * so the browser never handles secrets directly.
 */

interface AnalyzeRequest {
  content: string;
  content_type: string;
  language?: string;
  options: {
    run_meaning: boolean;
    run_origin: boolean;
    run_verification: boolean;
  };
}

interface TranslatePlainMeaningRequest {
  text: string;
  language: string;
}

export interface ResolveReferenceRequest {
  current_text: string;
  plain_meaning: string;
  referenced_sources: string[];
  referenced_source_text: string;
}

export interface ReferencedSourceMapping {
  sourceName: string;
  specificReferencedText: string;
  whatThisTextControls: string;
  howItConnectsToCurrentRule: string;
  plainLanguageEffect: string;
}

export interface ResolveReferenceResponse {
  status: "resolved" | "needs_review";
  currentRuleRequirement: string;
  referencedSourceMappings: ReferencedSourceMapping[];
  combinedRequirement: string;
  whatAUserMustDo: string;
  limits: string[];
}

async function readErrorMessage(response: Response, fallback: string) {
  const text = await response.text();
  let message = fallback;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === "string") {
      message = parsed.message;
    }
  } catch {
    if (text.trim()) {
      message = text;
    }
  }

  return { text, message };
}

export async function analyzeDocument(request: AnalyzeRequest) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: request.content,
      content_type: request.content_type,
      options: request.options,
    }),
  });

  if (!response.ok) {
    const { message } = await readErrorMessage(response, `Analysis failed (${response.status})`);
    throw new Error(message);
  }

  return JSON.parse(await response.text());
}

export async function translatePlainMeaning(request: TranslatePlainMeaningRequest) {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: request.text,
      language: request.language,
    }),
  });

  if (!response.ok) {
    const { message } = await readErrorMessage(response, `Translation failed (${response.status})`);
    throw new Error(message);
  }

  return JSON.parse(await response.text()) as {
    translated_text: string;
    language: string;
    source_stage?: "meaning";
  };
}

export async function resolveReference(request: ResolveReferenceRequest) {
  const response = await fetch("/api/resolve-reference", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const { message } = await readErrorMessage(response, `Extended meaning failed (${response.status})`);
    throw new Error(message);
  }

  return JSON.parse(await response.text()) as ResolveReferenceResponse;
}
