"""Tests for the Tetherpoint pipeline."""

import json

import pytest

from app.input.handler import process_input
from app.meaning.handler import process_meaning
from app.origin.handler import process_origin
from app.pipeline.runner import run_pipeline
from app.schemas.models import AnalyzeOptions, AnalyzeRequest, ContentType
from app.selection.handler import process_selection
from app.structure.handler import process_structure
from app.verification.handler import process_verification


# ---------------------------------------------------------------------------
# Input layer tests
# ---------------------------------------------------------------------------

class TestInputLayer:
    def test_text_input_valid(self):
        result = process_input("Hello world.", ContentType.text)
        assert result.parse_status == "ok"
        assert result.content_type == "text"
        assert result.raw_content == "Hello world."
        assert result.size > 0

    def test_text_input_empty(self):
        result = process_input("   ", ContentType.text)
        assert result.parse_status == "error"
        assert len(result.parse_errors) > 0

    def test_xml_input_valid(self):
        result = process_input("<root><item>Test</item></root>", ContentType.xml)
        assert result.parse_status == "ok"
        assert result.parse_errors == []

    def test_xml_input_malformed(self):
        result = process_input("<root><item>Test</root>", ContentType.xml)
        assert result.parse_status == "error"
        assert any("XML" in e for e in result.parse_errors)

    def test_html_input_valid(self):
        result = process_input("<html><body><p>Hello</p></body></html>", ContentType.html)
        assert result.parse_status == "ok"
        assert result.parse_errors == []

    def test_html_input_no_elements(self):
        result = process_input("just plain text no tags", ContentType.html)
        assert result.parse_status == "error"
        assert any("no recognizable" in e.lower() for e in result.parse_errors)

    def test_json_input_valid(self):
        result = process_input('{"key": "value"}', ContentType.json)
        assert result.parse_status == "ok"
        assert result.parse_errors == []

    def test_json_input_malformed(self):
        result = process_input("{bad json", ContentType.json)
        assert result.parse_status == "error"
        assert any("JSON" in e for e in result.parse_errors)

    def test_plain_text_preserved(self):
        text = "The court ruled in favor of the defendant."
        result = process_input(text, ContentType.text)
        assert result.raw_content == text
        assert result.size == len(text.encode("utf-8"))


# ---------------------------------------------------------------------------
# Structure layer tests
# ---------------------------------------------------------------------------

class TestStructureLayer:
    def test_text_structure_nodes(self):
        inp = process_input(
            "The SEC issued a new regulation on January 15, 2024. Companies must comply within 90 days.",
            ContentType.text,
        )
        struct = process_structure(inp)
        assert struct.node_count > 0
        for node in struct.nodes:
            assert node.node_id
            assert node.source_anchor
            assert node.source_text

    def test_node_order_preserved(self):
        inp = process_input(
            "First statement here. Second statement follows. Third statement ends.",
            ContentType.text,
        )
        struct = process_structure(inp)
        texts = [n.source_text for n in struct.nodes]
        assert texts[0].startswith("First")
        assert texts[-1].startswith("Third")

    def test_xml_structure(self):
        inp = process_input(
            "<doc><section>Congress enacted Public Law 118-1.</section><section>The deadline is 2024-06-01.</section></doc>",
            ContentType.xml,
        )
        struct = process_structure(inp)
        assert struct.node_count >= 2

    def test_json_structure(self):
        data = json.dumps({"title": "Report", "body": "The court issued a ruling on the case."})
        inp = process_input(data, ContentType.json)
        struct = process_structure(inp)
        assert struct.node_count >= 1

    def test_malformed_input_produces_empty_structure(self):
        inp = process_input("{bad", ContentType.json)
        struct = process_structure(inp)
        assert struct.node_count == 0

    def test_html_structure_extracts_paragraphs(self):
        html = "<html><body><p>First paragraph.</p><p>Second paragraph.</p></body></html>"
        inp = process_input(html, ContentType.html)
        struct = process_structure(inp)
        assert struct.node_count >= 2


# ---------------------------------------------------------------------------
# Selection layer tests
# ---------------------------------------------------------------------------

class TestSelectionLayer:
    def test_deterministic_selection(self):
        inp = process_input(
            "The SEC must enforce compliance by March 2025. Random words without signals.",
            ContentType.text,
        )
        struct = process_structure(inp)
        sel = process_selection(struct)
        total = len(sel.selected_nodes) + len(sel.excluded_nodes)
        assert total == struct.node_count
        assert len(sel.selection_log) == struct.node_count

    def test_blocked_node_excluded(self):
        """Nodes with CFS blocked_flags should be excluded by selection."""
        inp = process_input(
            "The company intends to reduce emissions. The regulation shall take effect.",
            ContentType.text,
        )
        struct = process_structure(inp)
        # Force a blocked flag on the first node to test exclusion
        if struct.nodes:
            struct.nodes[0].blocked_flags = ["intent_attribution"]
        sel = process_selection(struct)
        excluded_ids = [n.node_id for n in sel.excluded_nodes]
        if struct.nodes:
            assert struct.nodes[0].node_id in excluded_ids

    def test_selection_preserves_node_content(self):
        """Selected nodes must not be modified by selection layer."""
        inp = process_input(
            "The SEC issued guidance on January 10, 2024.",
            ContentType.text,
        )
        struct = process_structure(inp)
        sel = process_selection(struct)
        for sel_node in sel.selected_nodes:
            orig = next(n for n in struct.nodes if n.node_id == sel_node.node_id)
            assert sel_node.source_text == orig.source_text
            assert sel_node.normalized_text == orig.normalized_text


# ---------------------------------------------------------------------------
# Meaning layer tests
# ---------------------------------------------------------------------------

class TestMeaningLayer:
    def test_meaning_skipped_when_disabled(self):
        inp = process_input("The SEC must enforce compliance.", ContentType.text)
        struct = process_structure(inp)
        sel = process_selection(struct)
        result = process_meaning(sel.selected_nodes, run=False)
        assert result.status == "skipped"
        assert result.node_results == []

    def test_meaning_skipped_without_api_key(self):
        """Without OPENAI_API_KEY, meaning returns skipped even when run=True."""
        import os
        old = os.environ.pop("OPENAI_API_KEY", None)
        try:
            inp = process_input("The court ruled on the case.", ContentType.text)
            struct = process_structure(inp)
            sel = process_selection(struct)
            result = process_meaning(sel.selected_nodes, run=True)
            assert result.status == "skipped"
        finally:
            if old is not None:
                os.environ["OPENAI_API_KEY"] = old


# ---------------------------------------------------------------------------
# Origin layer tests
# ---------------------------------------------------------------------------

class TestOriginLayer:
    def test_origin_skipped_when_disabled(self):
        inp = process_input("Some text content.", ContentType.text)
        result = process_origin(inp, run=False)
        assert result.status == "skipped"
        assert result.origin_identity_signals == []
        assert result.origin_metadata_signals == []

    def test_origin_executes_for_html(self):
        html = '<html><head><meta name="author" content="Jane Doe"></head><body><p>Content</p></body></html>'
        inp = process_input(html, ContentType.html)
        result = process_origin(inp, run=True)
        assert result.status == "executed"

    def test_origin_executes_for_text(self):
        inp = process_input("By John Smith. Published 2024.", ContentType.text)
        result = process_origin(inp, run=True)
        assert result.status == "executed"


# ---------------------------------------------------------------------------
# Verification layer tests
# ---------------------------------------------------------------------------

class TestVerificationLayer:
    def test_verification_skipped_when_disabled(self):
        inp = process_input("The SEC must enforce compliance.", ContentType.text)
        struct = process_structure(inp)
        sel = process_selection(struct)
        result = process_verification(sel.selected_nodes, run=False)
        assert result.status == "skipped"
        assert result.node_results == []

    def test_verification_detects_legal_assertion(self):
        inp = process_input("Congress enacted Public Law 118-1.", ContentType.text)
        struct = process_structure(inp)
        sel = process_selection(struct)
        result = process_verification(sel.selected_nodes, run=True)
        assert result.status == "executed"
        found_legal = any(
            nr.assertion_type and "legal" in nr.assertion_type
            for nr in result.node_results
        )
        assert found_legal

    def test_verification_detects_corporate_assertion(self):
        inp = process_input("The SEC filed charges against the company.", ContentType.text)
        struct = process_structure(inp)
        sel = process_selection(struct)
        result = process_verification(sel.selected_nodes, run=True)
        assert result.status == "executed"
        found = any(nr.assertion_detected for nr in result.node_results)
        assert found


# ---------------------------------------------------------------------------
# Full pipeline tests
# ---------------------------------------------------------------------------

class TestFullPipeline:
    def test_text_pipeline(self):
        req = AnalyzeRequest(
            content="Congress enacted the Clean Air Act in 1970. The EPA must enforce compliance.",
            content_type=ContentType.text,
            options=AnalyzeOptions(run_meaning=False, run_origin=True, run_verification=True),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "ok"
        assert result.meaning.status == "skipped"
        assert result.origin.status == "executed"
        assert result.verification.status == "executed"

    def test_html_pipeline(self):
        html = """<html><head><title>Report</title><meta name="author" content="Jane Doe"></head>
        <body><p>The federal court ruled on the case in January 2024.</p></body></html>"""
        req = AnalyzeRequest(
            content=html,
            content_type=ContentType.html,
            options=AnalyzeOptions(run_meaning=False, run_origin=True, run_verification=True),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "ok"
        assert len(result.origin.origin_identity_signals) > 0 or len(result.origin.origin_metadata_signals) > 0

    def test_xml_pipeline(self):
        xml = "<doc><section>Congress enacted Public Law 118-1.</section></doc>"
        req = AnalyzeRequest(
            content=xml,
            content_type=ContentType.xml,
            options=AnalyzeOptions(run_meaning=False, run_origin=True, run_verification=True),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "ok"
        assert result.structure.node_count >= 1
        assert result.origin.status == "executed"

    def test_json_pipeline(self):
        data = json.dumps({"title": "Report", "body": "The court issued a ruling."})
        req = AnalyzeRequest(
            content=data,
            content_type=ContentType.json,
            options=AnalyzeOptions(run_meaning=False, run_origin=True, run_verification=True),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "ok"
        assert result.structure.node_count >= 1

    def test_malformed_json_pipeline(self):
        req = AnalyzeRequest(
            content="{bad json",
            content_type=ContentType.json,
            options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "error"
        assert len(result.errors) > 0
        assert result.errors[0].layer == "input"

    def test_malformed_xml_pipeline(self):
        req = AnalyzeRequest(
            content="<root><broken>",
            content_type=ContentType.xml,
            options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "error"
        assert len(result.errors) > 0

    def test_skipped_layers(self):
        req = AnalyzeRequest(
            content="Simple text.",
            content_type=ContentType.text,
            options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
        )
        result = run_pipeline(req)
        assert result.meaning.status == "skipped"
        assert result.origin.status == "skipped"
        assert result.verification.status == "skipped"

    def test_response_has_all_8_top_level_keys(self):
        req = AnalyzeRequest(
            content="The SEC must enforce compliance.",
            content_type=ContentType.text,
            options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
        )
        result = run_pipeline(req)
        assert result.input is not None
        assert result.structure is not None
        assert result.selection is not None
        assert result.meaning is not None
        assert result.origin is not None
        assert result.verification is not None
        assert result.output is not None
        assert result.errors is not None

    def test_errors_present_even_when_empty(self):
        req = AnalyzeRequest(
            content="The SEC must enforce compliance by March 2025.",
            content_type=ContentType.text,
            options=AnalyzeOptions(run_meaning=False, run_origin=True, run_verification=True),
        )
        result = run_pipeline(req)
        assert isinstance(result.errors, list)

    def test_response_serializes_all_8_keys_via_api(self):
        """Verify the HTTP response JSON contains exactly the 8 required keys."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        resp = client.post("/analyze", json={
            "content": "Test content.",
            "content_type": "text",
            "options": {"run_meaning": False, "run_origin": False, "run_verification": False},
        })
        assert resp.status_code == 200
        body = resp.json()
        required_keys = {"input", "structure", "selection", "meaning", "origin", "verification", "output", "errors"}
        assert required_keys == set(body.keys())
