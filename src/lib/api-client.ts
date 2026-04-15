/**
 * Frontend API client — ALL analysis requests route through the server function.
 * The frontend never calls the backend directly and never handles secrets.
 */

import { analyzePipeline } from "./analyze";

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
  return analyzePipeline({
    data: {
      content: request.content,
      content_type: request.content_type,
      options: request.options,
    },
  });
}
