import { AnalyzeRequest, PipelineResponse } from "../types";

export async function analyzeDocument(
  request: AnalyzeRequest
): Promise<PipelineResponse> {
  const response = await fetch(
    "https://anchored-flow-stack.onrender.com/analyze",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-analyze-secret": "Apple_Banana_Bridge!123",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error("Analysis failed");
  }

  return response.json();
}
