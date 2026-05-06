import type { HumanReviewHandoff, SourceMetadataContract } from "../lib/api-client";

declare module "./Workspace" {
  interface PipelineResponse {
    source_metadata?: SourceMetadataContract[];
    human_review_handoffs?: HumanReviewHandoff[];
  }
}

export {};
