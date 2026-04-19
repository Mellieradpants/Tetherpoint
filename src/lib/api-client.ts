/**
 * Frontend API client - analysis requests route through the local `/api/analyze`
 * server proxy so the browser never handles secrets directly.
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

  const text = await response.text();

  if (!response.ok) {
    let message = `Analysis failed (${response.status})`;

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

    throw new Error(message);
  }

  return JSON.parse(text);
}
