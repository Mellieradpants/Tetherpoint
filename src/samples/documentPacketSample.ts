export const DOCUMENT_PACKET_SAMPLE_TEXT = JSON.stringify(
{
  "content": "Synthetic screenshot/OCR credit card terms disclosure sample",
  "content_type": "text",
  "options": {
    "run_meaning": true,
    "run_origin": true,
    "run_verification": true
  },
  "document_packet": {
    "document_id": "golden-credit-card-disclosure-screenshot-001",
    "title": "Sample Horizon Mastercard Credit Card Offer and Terms Disclosure",
    "source_type": "unknown",
    "source_name": "Synthetic screenshot/OCR credit card terms disclosure sample",
    "source_uri": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr",
    "extraction_profile": {
      "input_kind": "screenshot_ocr",
      "fixture_role": "golden_sample",
      "modeled_after": "real-world dense credit-card terms disclosure",
      "privacy_note": "Synthetic fixture. No private user data, real invitation code, account number, barcode, QR code, address, or name.",
      "intake_standard": "Messy screenshot/photo style text should preserve anchors, tables, warnings, and uncertainty."
    },
    "extraction_warnings": [
      "Synthetic OCR-style fixture: real screenshots may include skew, blur, shadows, table reading-order errors, and cropped context.",
      "Verification routes are present as cues only; no external source is checked by this fixture."
    ],
    "metadata": {
      "document_family": "financial_disclosure",
      "fixture_status": "repo_safe_synthetic",
      "expected_tabs": [
        "plainMeaning",
        "origin",
        "verification",
        "governance"
      ],
      "expected_verification_status": "route_mapped_or_partial_not_externally_verified",
      "sample_purpose": "Built-in smoke test for Document Navigator drawer tabs and meaning-first output."
    },
    "pages": [
      {
        "page_number": 1,
        "metadata": {
          "image_like_source": true,
          "table_heavy": true
        },
        "extraction_warnings": [
          "Page simulates a photographed first page with dense tables and small print."
        ],
        "blocks": [
          {
            "block_id": "title",
            "page_number": 1,
            "order": 1,
            "text": "SAMPLE HORIZON MASTERCARD\nCREDIT CARD OFFER / TERMS DISCLOSURE",
            "normalized_text": "SAMPLE HORIZON MASTERCARD\nCREDIT CARD OFFER / TERMS DISCLOSURE",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p1-title",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "title",
              "char_start": 0,
              "char_end": 65,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/title"
            },
            "metadata": {
              "fixture_signal": "Detected document title from top of screenshot-style disclosure."
            }
          },
          {
            "block_id": "origin-metadata",
            "page_number": 1,
            "order": 2,
            "text": "Issuer: Example Community Bank. Servicer: Example Card Services, Inc. Revision SAMPLE-2026-03. Page 1 of 2. This synthetic fixture is modeled on a dense credit-card terms disclosure and contains no private user data.",
            "normalized_text": "Issuer: Example Community Bank. Servicer: Example Card Services, Inc. Revision SAMPLE-2026-03. Page 1 of 2. This synthetic fixture is modeled on a dense credit-card terms disclosure and contains no private user data.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p1-origin-metadata",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "origin-metadata",
              "char_start": 0,
              "char_end": 216,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/origin-metadata"
            },
            "metadata": {
              "fixture_signal": "Detected issuer, servicer, revision, page reference, and privacy-safe sample status."
            }
          },
          {
            "block_id": "interest-rates-heading",
            "page_number": 1,
            "order": 3,
            "text": "INTEREST RATES AND INTEREST CHARGES",
            "normalized_text": "INTEREST RATES AND INTEREST CHARGES",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p1-interest-rates-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "interest-rates-heading",
              "char_start": 0,
              "char_end": 35,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/interest-rates-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "apr-table",
            "page_number": 1,
            "order": 4,
            "text": "Annual Percentage Rate (APR) for Purchases: 35.90%. APR for Cash Advances: 35.90%. Paying Interest: Your due date is at least 25 days after the close of each billing cycle. We will not charge interest on purchases if you pay your entire balance by the due date each month. Minimum Interest Charge: If you are charged interest, the charge will be no less than $1.00.",
            "normalized_text": "Annual Percentage Rate (APR) for Purchases: 35.90%. APR for Cash Advances: 35.90%. Paying Interest: Your due date is at least 25 days after the close of each billing cycle. We will not charge interest on purchases if you pay your entire balance by the due date each month. Minimum Interest Charge: If you are charged interest, the charge will be no less than $1.00.",
            "block_type": "table",
            "source_anchor": {
              "anchor_id": "credit-card-p1-apr-table",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "apr-table",
              "char_start": 0,
              "char_end": 370,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/apr-table"
            },
            "metadata": {
              "fixture_signal": "Detected APR, grace period, and minimum interest charge table content."
            },
            "extraction_warnings": [
              "Table text is flattened to simulate screenshot/OCR extraction. Reading order may need normalization."
            ]
          },
          {
            "block_id": "cfpb-reference",
            "page_number": 1,
            "order": 5,
            "text": "For Credit Card Tips from the Consumer Financial Protection Bureau: To learn more about factors to consider when applying for or using a credit card, visit the CFPB credit card information page.",
            "normalized_text": "For Credit Card Tips from the Consumer Financial Protection Bureau: To learn more about factors to consider when applying for or using a credit card, visit the CFPB credit card information page.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p1-cfpb-reference",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "cfpb-reference",
              "char_start": 0,
              "char_end": 187,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/cfpb-reference"
            },
            "metadata": {
              "fixture_signal": "Detected CFPB source-route cue."
            }
          },
          {
            "block_id": "fees-heading",
            "page_number": 1,
            "order": 6,
            "text": "FEES",
            "normalized_text": "FEES",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p1-fees-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "fees-heading",
              "char_start": 0,
              "char_end": 4,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/fees-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "fees-table",
            "page_number": 1,
            "order": 7,
            "text": "Set-up and Maintenance Fees: Annual Fee: $175 the first year. After that, $49 annually. Monthly Fee: none during the first year. After that, $12.50 per month. Account Opening Processing Fee: $0. Transaction Fees: Cash Advance Fee: either $10 or 5% of the amount of each cash advance, whichever is greater. Foreign Transaction Fee: 3% of each transaction in U.S. dollars. Penalty Fees: Late Payment Fee up to $41. Overlimit Fee up to $41. Returned Payment Fee up to $41.",
            "normalized_text": "Set-up and Maintenance Fees: Annual Fee: $175 the first year. After that, $49 annually. Monthly Fee: none during the first year. After that, $12.50 per month. Account Opening Processing Fee: $0. Transaction Fees: Cash Advance Fee: either $10 or 5% of the amount of each cash advance, whichever is greater. Foreign Transaction Fee: 3% of each transaction in U.S. dollars. Penalty Fees: Late Payment Fee up to $41. Overlimit Fee up to $41. Returned Payment Fee up to $41.",
            "block_type": "table",
            "source_anchor": {
              "anchor_id": "credit-card-p1-fees-table",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "fees-table",
              "char_start": 0,
              "char_end": 493,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/fees-table"
            },
            "metadata": {
              "fixture_signal": "Detected account fees, transaction fees, and penalty fees."
            },
            "extraction_warnings": [
              "Table text is flattened to simulate screenshot/OCR extraction. Reading order may need normalization."
            ]
          },
          {
            "block_id": "balance-heading",
            "page_number": 1,
            "order": 8,
            "text": "HOW WE CALCULATE YOUR BALANCE",
            "normalized_text": "HOW WE CALCULATE YOUR BALANCE",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p1-balance-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "balance-heading",
              "char_start": 0,
              "char_end": 29,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/balance-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "balance-method",
            "page_number": 1,
            "order": 9,
            "text": "We use a method called average daily balance, including new purchases.",
            "normalized_text": "We use a method called average daily balance, including new purchases.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p1-balance-method",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "balance-method",
              "char_start": 0,
              "char_end": 67,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/balance-method"
            },
            "metadata": {
              "fixture_signal": "Detected balance calculation method."
            }
          },
          {
            "block_id": "billing-rights-heading",
            "page_number": 1,
            "order": 10,
            "text": "BILLING RIGHTS",
            "normalized_text": "BILLING RIGHTS",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p1-billing-rights-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "billing-rights-heading",
              "char_start": 0,
              "char_end": 14,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/billing-rights-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "billing-rights",
            "page_number": 1,
            "order": 11,
            "text": "Information about your rights to dispute transactions and how to exercise those rights is provided in the Cardholder Agreement.",
            "normalized_text": "Information about your rights to dispute transactions and how to exercise those rights is provided in the Cardholder Agreement.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p1-billing-rights",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 1,
              "block_id": "billing-rights",
              "char_start": 0,
              "char_end": 119,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/1/block/billing-rights"
            },
            "metadata": {
              "fixture_signal": "Detected billing-rights and Cardholder Agreement route cue."
            }
          }
        ]
      },
      {
        "page_number": 2,
        "metadata": {
          "image_like_source": true,
          "terms_page": true
        },
        "extraction_warnings": [
          "Page simulates continuation of small-print terms and state notices."
        ],
        "blocks": [
          {
            "block_id": "terms-heading",
            "page_number": 2,
            "order": 1,
            "text": "TERMS AND CONDITIONS",
            "normalized_text": "TERMS AND CONDITIONS",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p2-terms-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "terms-heading",
              "char_start": 0,
              "char_end": 20,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/terms-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "credit-authorization",
            "page_number": 2,
            "order": 2,
            "text": "This offer is not transferable. You authorize us to obtain credit reports and other information about you from credit reporting agencies and other sources.",
            "normalized_text": "This offer is not transferable. You authorize us to obtain credit reports and other information about you from credit reporting agencies and other sources.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p2-credit-authorization",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "credit-authorization",
              "char_start": 0,
              "char_end": 147,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/credit-authorization"
            },
            "metadata": {
              "fixture_signal": "Detected credit-report authorization and non-transferable offer language."
            }
          },
          {
            "block_id": "approval-conditions",
            "page_number": 2,
            "order": 3,
            "text": "To be approved, you must meet our credit criteria, identity verification requirements, and income or ability-to-pay review. Approval is not guaranteed.",
            "normalized_text": "To be approved, you must meet our credit criteria, identity verification requirements, and income or ability-to-pay review. Approval is not guaranteed.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p2-approval-conditions",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "approval-conditions",
              "char_start": 0,
              "char_end": 145,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/approval-conditions"
            },
            "metadata": {
              "fixture_signal": "Detected approval criteria, identity verification, and ability-to-pay review language."
            }
          },
          {
            "block_id": "refund-cancellation",
            "page_number": 2,
            "order": 4,
            "text": "You may cancel the account within 30 days after account opening. If you have not used the account, any annual fee charged at opening may be refunded according to the Cardholder Agreement.",
            "normalized_text": "You may cancel the account within 30 days after account opening. If you have not used the account, any annual fee charged at opening may be refunded according to the Cardholder Agreement.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p2-refund-cancellation",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "refund-cancellation",
              "char_start": 0,
              "char_end": 181,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/refund-cancellation"
            },
            "metadata": {
              "fixture_signal": "Detected cancellation timing and annual fee refund condition."
            }
          },
          {
            "block_id": "new-account-heading",
            "page_number": 2,
            "order": 5,
            "text": "IMPORTANT INFORMATION ABOUT PROCEDURES FOR OPENING A NEW ACCOUNT",
            "normalized_text": "IMPORTANT INFORMATION ABOUT PROCEDURES FOR OPENING A NEW ACCOUNT",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p2-new-account-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "new-account-heading",
              "char_start": 0,
              "char_end": 62,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/new-account-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "identity-notice",
            "page_number": 2,
            "order": 6,
            "text": "To help the government fight financial crimes, federal law requires financial institutions to obtain, verify, and record information that identifies each person who opens an account.",
            "normalized_text": "To help the government fight financial crimes, federal law requires financial institutions to obtain, verify, and record information that identifies each person who opens an account.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p2-identity-notice",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "identity-notice",
              "char_start": 0,
              "char_end": 171,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/identity-notice"
            },
            "metadata": {
              "fixture_signal": "Detected customer-identification / anti-financial-crime notice."
            }
          },
          {
            "block_id": "prescreen-heading",
            "page_number": 2,
            "order": 7,
            "text": "PRESCREEN AND OPT-OUT NOTICE",
            "normalized_text": "PRESCREEN AND OPT-OUT NOTICE",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p2-prescreen-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "prescreen-heading",
              "char_start": 0,
              "char_end": 28,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/prescreen-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "prescreen-optout",
            "page_number": 2,
            "order": 8,
            "text": "You received this offer because information in your credit report met criteria used for this prescreened offer. You may opt out of prescreened credit offers by contacting the official prescreen opt-out system.",
            "normalized_text": "You received this offer because information in your credit report met criteria used for this prescreened offer. You may opt out of prescreened credit offers by contacting the official prescreen opt-out system.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p2-prescreen-optout",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "prescreen-optout",
              "char_start": 0,
              "char_end": 204,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/prescreen-optout"
            },
            "metadata": {
              "fixture_signal": "Detected prescreened offer and opt-out route cue."
            }
          },
          {
            "block_id": "state-notices-heading",
            "page_number": 2,
            "order": 9,
            "text": "STATE NOTICES",
            "normalized_text": "STATE NOTICES",
            "block_type": "heading",
            "source_anchor": {
              "anchor_id": "credit-card-p2-state-notices-heading",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "state-notices-heading",
              "char_start": 0,
              "char_end": 13,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/state-notices-heading"
            },
            "metadata": {
              "fixture_signal": "Detected section heading."
            }
          },
          {
            "block_id": "state-notices",
            "page_number": 2,
            "order": 10,
            "text": "Some state notices may apply depending on where you live. State notices may include California, Delaware, Ohio, Wisconsin, Kentucky, New York, Vermont, and Utah.",
            "normalized_text": "Some state notices may apply depending on where you live. State notices may include California, Delaware, Ohio, Wisconsin, Kentucky, New York, Vermont, and Utah.",
            "block_type": "paragraph",
            "source_anchor": {
              "anchor_id": "credit-card-p2-state-notices",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "state-notices",
              "char_start": 0,
              "char_end": 155,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/state-notices"
            },
            "metadata": {
              "fixture_signal": "Detected state-specific notice route cues."
            }
          },
          {
            "block_id": "fixture-instructions",
            "page_number": 2,
            "order": 11,
            "text": "Fixture expectation: Plain Meaning should render first. Origin should detect product title, issuer, servicer, page, revision, and section anchors. Verification should show route mapped or partial unless external checks run. Governance should flag APR, fees, credit-report authorization, identity requirements, approval conditions, opt-out language, refund condition, and state notices.",
            "normalized_text": "Fixture expectation: Plain Meaning should render first. Origin should detect product title, issuer, servicer, page, revision, and section anchors. Verification should show route mapped or partial unless external checks run. Governance should flag APR, fees, credit-report authorization, identity requirements, approval conditions, opt-out language, refund condition, and state notices.",
            "block_type": "footnote",
            "source_anchor": {
              "anchor_id": "credit-card-p2-fixture-instructions",
              "source_type": "unknown",
              "document_id": "golden-credit-card-disclosure-screenshot-001",
              "page_number": 2,
              "block_id": "fixture-instructions",
              "char_start": 0,
              "char_end": 360,
              "source_path": "sample://golden-fixture/credit-card-disclosure-screenshot-ocr/page/2/block/fixture-instructions"
            },
            "metadata": {
              "fixture_signal": "Embedded golden-sample expectations for developer smoke testing."
            }
          }
        ]
      }
    ]
  }
},
  null,
  2,
);
