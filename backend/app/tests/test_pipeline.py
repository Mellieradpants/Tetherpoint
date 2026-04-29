"""Tests for the Tetherpoint pipeline."""

import json

from fastapi.testclient import TestClient

from app.input.handler import process_input
from app.main import app
from app.meaning.handler import process_meaning
from app.origin.handler import process_origin
from app.pipeline.runner import run_pipeline
from app.rule_units.handler import process_rule_units
from app.schemas.models import AnalyzeOptions, AnalyzeRequest, ContentType
from app.selection.handler import process_selection
from app.structure.handler import process_structure
from app.verification.handler import process_verification


def _rule_units_for_text(text: str):
    inp = process_input(text, ContentType.text)
    struct = process_structure(inp)
    selection = process_selection(struct)
    return process_rule_units(struct, selection)


class TestInputLayer:
    def test_text_input_valid(self):
        result = process_input("Hello world.", ContentType.text)
        assert result.parse_status == "ok"
        assert result.content_type == "text"
        assert result.raw_content == "Hello world."
        assert result.size > 0

    def test_json_input_malformed(self):
        result = process_input("{bad json", ContentType.json)
        assert result.parse_status == "error"
        assert any("JSON" in e for e in result.parse_errors)


class TestStructureLayer:
    def test_atomic_rule_preserves_documentary_evidence_signals(self):
        text = "An applicant shall provide documentary proof of United States citizenship to register to vote."
        inp = process_input(text, ContentType.text)
        struct = process_structure(inp)

        output_text = " ".join(node.source_text for node in struct.nodes).lower()

        assert struct.validation_report.status == "clean"
        assert struct.nodes
        assert "citizenship" in output_text
        assert "documentary proof" in output_text
        assert all(node.role != "BOILERPLATE" for node in struct.nodes)

    def test_multiple_obligations_split_before_rule_unit_assembly(self):
        inp = process_input(
            "The State shall verify documentary proof, and the registrar shall retain a copy of each record.",
            ContentType.text,
        )
        struct = process_structure(inp)
        primary_nodes = [node for node in struct.nodes if node.role == "PRIMARY_RULE"]
        assert len(primary_nodes) == 2


class TestSelectionLayer:
    def test_blocked_node_excluded(self):
        inp = process_input(
            "The company intends to reduce emissions. The regulation shall take effect.",
            ContentType.text,
        )
        struct = process_structure(inp)
        if struct.nodes:
            struct.nodes[0].blocked_flags = ["intent_attribution"]
        selection = process_selection(struct)
        excluded_ids = [node.node_id for node in selection.excluded_nodes]
        assert struct.nodes[0].node_id in excluded_ids


class TestRuleUnitsLayer:
    def test_rule_units_group_primary_and_evidence(self):
        units = _rule_units_for_text(
            "An applicant shall provide documentary proof of United States citizenship to register to vote. "
            "Acceptable document types include: a valid United States passport; a certified birth certificate."
        )
        assert units.unit_count >= 1
        assert units.ready_count >= 1
        assert units.rule_units[0].meaning_eligible is True
        assert units.rule_units[0].source_node_ids
        assert "citizenship" in units.rule_units[0].source_text_combined.lower()

    def test_standalone_exception_rule_unit_is_ready(self):
        units = _rule_units_for_text(
            "The reporting requirement in Section 2 does not apply to a regional transmission operator "
            "that serves fewer than 100,000 retail customers, unless the Commission determines that "
            "the operator’s service area includes critical defense, hospital, or water infrastructure."
        )
        assert units.unit_count == 1
        assert units.ready_count == 1
        assert units.needs_review_count == 0
        assert units.rule_units[0].meaning_eligible is True
        assert "missing_primary_rule" not in units.rule_units[0].assembly_issues
        assert "regional transmission operator" in units.rule_units[0].source_text_combined
        assert "serves fewer than 100,000 retail customers" in units.rule_units[0].source_text_combined
        assert "unless the Commission determines" in units.rule_units[0].source_text_combined


class TestMeaningLayer:
    def test_meaning_skipped_when_disabled(self):
        units = _rule_units_for_text("The SEC must enforce compliance.")
        result = process_meaning(units.rule_units, run=False)
        assert result.status == "skipped"
        assert result.node_results == []

    def test_meaning_uses_deterministic_brief_without_external_api(self):
        units = _rule_units_for_text(
            "An applicant shall provide documentary proof of United States citizenship to register to vote."
        )
        result = process_meaning(units.rule_units, run=True)
        assert result.status == "fallback"
        assert result.summary_basis == "deterministic_brief"
        assert result.summary_brief is not None
        assert result.overall_plain_meaning
        assert "citizenship" in result.overall_plain_meaning.lower()
        assert all(node.status in {"fallback", "skipped"} for node in result.node_results)

    def test_meaning_does_not_emit_scope_or_shift_taxonomy(self):
        units = _rule_units_for_text("A State shall require proof of citizenship to register to vote.")
        result = process_meaning(units.rule_units, run=True)
        payload = result.model_dump()
        payload_text = json.dumps(payload)
        assert "scope_change" not in payload_text
        assert "modality_shift" not in payload_text
        assert "detected_scopes" not in payload_text


class TestOriginLayer:
    def test_origin_executes_for_html(self):
        html = '<html><head><meta name="author" content="Jane Doe"></head><body><p>Content</p></body></html>'
        inp = process_input(html, ContentType.html)
        result = process_origin(inp, run=True)
        assert result.status == "executed"


class TestVerificationLayer:
    def test_verification_skipped_when_disabled(self):
        units = _rule_units_for_text("The SEC must enforce compliance.")
        result = process_verification(units.rule_units, run=False)
        assert result.status == "skipped"
        assert result.node_results == []

    def test_verification_routes_rule_units(self):
        units = _rule_units_for_text("Congress enacted Public Law 118-1.")
        result = process_verification(units.rule_units, run=True)
        assert result.status == "executed"
        assert any(node.rule_unit_id for node in result.node_results)
        assert any(node.source_node_ids for node in result.node_results)
        assert any(node.assertion_type == "legal_legislative" for node in result.node_results)


class TestFullPipeline:
    def test_text_pipeline_order_and_outputs(self):
        req = AnalyzeRequest(
            content="Congress enacted the Clean Air Act in 1970. The EPA must enforce compliance.",
            content_type=ContentType.text,
            options=AnalyzeOptions(run_meaning=True, run_origin=True, run_verification=True),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "ok"
        assert result.origin.status == "executed"
        assert result.rule_units.unit_count >= 1
        assert result.verification.status == "executed"
        assert result.meaning.status == "fallback"
        assert result.meaning.summary_basis == "deterministic_brief"
        assert result.governance.status in {"match", "needs_review"}

    def test_malformed_json_pipeline(self):
        req = AnalyzeRequest(
            content="{bad json",
            content_type=ContentType.json,
            options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
        )
        result = run_pipeline(req)
        assert result.input.parse_status == "error"
        assert result.errors
        assert result.errors[0].layer == "input"

    def test_response_has_top_level_rule_units_and_governance(self):
        req = AnalyzeRequest(
            content="The SEC must enforce compliance.",
            content_type=ContentType.text,
            options=AnalyzeOptions(run_meaning=False, run_origin=False, run_verification=False),
        )
        result = run_pipeline(req)
        assert result.input is not None
        assert result.structure is not None
        assert result.selection is not None
        assert result.rule_units is not None
        assert result.meaning is not None
        assert result.origin is not None
        assert result.verification is not None
        assert result.governance is not None
        assert result.output is not None
        assert result.errors is not None

    def test_response_serializes_all_keys_via_api(self):
        client = TestClient(app)
        response = client.post(
            "/analyze",
            headers={"x-analyze-secret": "ci-test-secret"},
            json={
                "content": "Test content.",
                "content_type": "text",
                "options": {"run_meaning": False, "run_origin": False, "run_verification": False},
            },
        )
        assert response.status_code == 200
        body = response.json()
        required_keys = {"input", "structure", "selection", "rule_units", "meaning", "origin", "verification", "governance", "output", "errors"}
        assert required_keys == set(body.keys())
