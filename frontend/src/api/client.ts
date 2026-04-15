import { AnalyzeRequest, PipelineResponse } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function analyzeDocument(
  request: AnalyzeRequest
): Promise<PipelineResponse> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    try {
      const text = await response.text();
      console.error(`API error ${response.status}:`, text);
    } catch {}
    throw new Error("Analysis failed. Please retry.");
  }

  return response.json();
}
