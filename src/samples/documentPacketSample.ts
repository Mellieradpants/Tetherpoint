export const DOCUMENT_PACKET_SAMPLE_TEXT = JSON.stringify(
  {
    content: "Document Navigator sample notice",
    content_type: "text",
    options: {
      run_meaning: true,
      run_origin: true,
      run_verification: true,
    },
    document_packet: {
      document_id: "document-navigator-sample-notice",
      source_type: "pdf",
      source_name: "Document Navigator sample notice",
      source_uri: "sample://document-navigator-notice",
      pages: [
        {
          page_number: 1,
          blocks: [
            {
              block_id: "title",
              page_number: 1,
              order: 1,
              text: "Document Navigator Sample Notice",
              normalized_text: "Document Navigator Sample Notice",
              block_type: "heading",
              source_anchor: {
                anchor_id: "sample-page-1-title",
                source_type: "pdf",
                document_id: "document-navigator-sample-notice",
                page_number: 1,
                block_id: "title",
              },
            },
            {
              block_id: "overview",
              page_number: 1,
              order: 2,
              text: "This notice explains how a household can ask for a fee waiver when submitting a city permit application. The applicant should read each section and keep a copy of any documents submitted with the application.",
              normalized_text:
                "This notice explains how a household can ask for a fee waiver when submitting a city permit application. The applicant should read each section and keep a copy of any documents submitted with the application.",
              block_type: "paragraph",
              source_anchor: {
                anchor_id: "sample-page-1-overview",
                source_type: "pdf",
                document_id: "document-navigator-sample-notice",
                page_number: 1,
                block_id: "overview",
                char_start: 0,
                char_end: 207,
              },
            },
            {
              block_id: "eligibility",
              page_number: 1,
              order: 3,
              text: "A household may request a waiver if its current income is below the published program limit or if a recent emergency created a temporary inability to pay the permit fee.",
              normalized_text:
                "A household may request a waiver if its current income is below the published program limit or if a recent emergency created a temporary inability to pay the permit fee.",
              block_type: "paragraph",
              source_anchor: {
                anchor_id: "sample-page-1-eligibility",
                source_type: "pdf",
                document_id: "document-navigator-sample-notice",
                page_number: 1,
                block_id: "eligibility",
                char_start: 0,
                char_end: 165,
              },
            },
            {
              block_id: "documents-needed",
              page_number: 1,
              order: 4,
              text: "The applicant must include a completed request form, a copy of the permit application, and one document showing the household's current income or emergency expense.",
              normalized_text:
                "The applicant must include a completed request form, a copy of the permit application, and one document showing the household's current income or emergency expense.",
              block_type: "paragraph",
              source_anchor: {
                anchor_id: "sample-page-1-documents-needed",
                source_type: "pdf",
                document_id: "document-navigator-sample-notice",
                page_number: 1,
                block_id: "documents-needed",
                char_start: 0,
                char_end: 157,
              },
            },
          ],
        },
        {
          page_number: 2,
          blocks: [
            {
              block_id: "review-timing",
              page_number: 2,
              order: 1,
              text: "The office should review a complete request within ten business days. If information is missing, the office may ask the applicant to provide the missing item before making a decision.",
              normalized_text:
                "The office should review a complete request within ten business days. If information is missing, the office may ask the applicant to provide the missing item before making a decision.",
              block_type: "paragraph",
              source_anchor: {
                anchor_id: "sample-page-2-review-timing",
                source_type: "pdf",
                document_id: "document-navigator-sample-notice",
                page_number: 2,
                block_id: "review-timing",
                char_start: 0,
                char_end: 170,
              },
            },
            {
              block_id: "next-step",
              page_number: 2,
              order: 2,
              text: "If the request is denied, the applicant may submit a short written explanation and any missing documents within fifteen calendar days of the notice date.",
              normalized_text:
                "If the request is denied, the applicant may submit a short written explanation and any missing documents within fifteen calendar days of the notice date.",
              block_type: "paragraph",
              source_anchor: {
                anchor_id: "sample-page-2-next-step",
                source_type: "pdf",
                document_id: "document-navigator-sample-notice",
                page_number: 2,
                block_id: "next-step",
                char_start: 0,
                char_end: 146,
              },
            },
          ],
        },
      ],
    },
  },
  null,
  2,
);
