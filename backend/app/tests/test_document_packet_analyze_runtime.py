"""Runtime tests for optional document_packet /analyze path."""

import os

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
TEST_SECRET = os.environ.get("ANALYZE_SECRET", "ci-test-secret")
AUTH_HEADERS = {"x-analyze-secret": TEST_SECRET}


def _document_packet():
    return {
        "document_id": "runtime-doc-001",
        "source_type": "pdf",
        "source_name": "Runtime packet",
        "pages": [
            {
                "page_number": 1,
                "blocks": [
                    {
                        "block_id": "p1-b1",
                        "page_number": 1,
                        "order": 1,
                        "text": "The applicant shall provide proof within 30 days.",
                        "normalized_text": "The applicant shall provide proof within 30 days.",
                        "block_type": "paragraph",
                        "source_anchor": {
                            "anchor_id": "pdf-page-1-block-p1-b1",
                            "source_type": "pdf",
                            "document_id": "runtime-doc-001",
                            "page_number": 1,
                            "block_id": "p1-b1",
                            "char_start": 0,
                            "char_end": 50,
                        },
                    }
                ],
            }
        ],
    }


def _analyze_with_packet(packet):
    return client.post(
        "/analyze",
        json={
            "content": "structured document packet",
            "content_type": "text",
            "options": {"run_meaning": True, "run_origin": True, "run_verification": True},
            "user_selected_state": "CA",
            "document_packet": packet,
        },
        headers=AUTH_HEADERS,
    )


def test_existing_text_analyze_path_still_runs_text_first_pipeline_with_v2_skipped():
    response = client.post(
        "/analyze",
        json={
            "content": "The agency shall send notice within 30 days.",
            "content_type": "text",
            "options": {"run_meaning": False, "run_origin": True, "run_verification": True},
        },
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["structure"]["node_count"] >= 1
    assert body["rule_units"]["unit_count"] >= 1
    assert body["verification"]["status"] == "executed"
    assert body["document_first_v2"]["status"] == "skipped"


def test_document_packet_analyze_runs_document_first_v2_chain():
    response = _analyze_with_packet(_document_packet())

    assert response.status_code == 200
    v2 = response.json()["document_first_v2"]
    assert v2["status"] == "executed"
    assert v2["document_structure"] is not None
    assert v2["semantic_structure"] is not None
    assert v2["selection_v2"] is not None
    assert v2["rule_unit_candidates"] is not None


def test_document_packet_path_does_not_run_existing_runtime_layers():
    response = _analyze_with_packet(_document_packet())

    assert response.status_code == 200
    body = response.json()
    assert body["meaning"]["status"] == "skipped"
    assert body["verification"]["status"] == "skipped"
    assert body["governance"]["status"] == "match"
    assert body["governance"]["record_count"] == 0
    assert body["rule_units"]["unit_count"] == 0
    assert body["rule_units"]["rule_units"] == []


def test_document_packet_path_preserves_source_text_and_anchors_through_candidates():
    response = _analyze_with_packet(_document_packet())

    assert response.status_code == 200
    v2 = response.json()["document_first_v2"]
    candidate = v2["rule_unit_candidates"]["candidates"][0]
    assert candidate["source_text"] == "The applicant shall provide proof within 30 days."
    assert candidate["source_anchor"]["anchor_id"] == "pdf-page-1-block-p1-b1"
    assert set(candidate["signal_types"]) >= {"obligation", "timing", "evidence_requirement"}
    assert set(candidate["anchor_texts"]) >= {"shall", "within 30 days", "proof"}


def test_document_packet_path_returns_jurisdiction_context():
    response = _analyze_with_packet(_document_packet())

    assert response.status_code == 200
    context = response.json()["jurisdiction_context"]
    assert context == {
        "user_selected_state": "CA",
        "document_detected_state": None,
        "jurisdiction_status": "needs_review",
    }


def test_missing_user_selected_state_returns_missing_jurisdiction_context():
    response = client.post(
        "/analyze",
        json={
            "content": "The agency shall send notice within 30 days.",
            "content_type": "text",
            "options": {"run_meaning": False, "run_origin": True, "run_verification": True},
        },
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 200
    context = response.json()["jurisdiction_context"]
    assert context["user_selected_state"] is None
    assert context["document_detected_state"] is None
    assert context["jurisdiction_status"] == "missing"


def test_invalid_document_packet_returns_validation_error():
    packet = _document_packet()
    del packet["pages"][0]["blocks"][0]["source_anchor"]

    response = _analyze_with_packet(packet)

    assert response.status_code == 422
    assert "document_packet" in response.text
