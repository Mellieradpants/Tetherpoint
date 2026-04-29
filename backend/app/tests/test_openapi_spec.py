"""Tests that validate the OpenAPI spec against the live backend models.

These tests ensure the spec stays aligned with Pydantic models -
any future drift will surface as a clear test failure.
"""

import yaml
from pathlib import Path

import pytest
from pydantic import BaseModel

from app.schemas.models import (
    AnalyzeOptions,
    AnalyzeRequest,
    ContentType,
    InputResult,
    MeaningBrief,
    MeaningNodeResult,
    MeaningResult,
    OriginResult,
    OriginSignal,
    OutputResult,
    PipelineError,
    PipelineResponse,
    RuleUnit,
    RuleUnitNodeRef,
    RuleUnitResult,
    SelectionResult,
    StructureNode,
    StructureResult,
    StructureValidationIssue,
    StructureValidationReport,
    VerificationNodeResult,
    VerificationResult,
)

SPEC_PATH = Path(__file__).resolve().parent.parent.parent / "openapi.yaml"


@pytest.fixture(scope="module")
def spec():
    """Load and return the parsed OpenAPI spec."""
    assert SPEC_PATH.exists(), f"OpenAPI spec not found at {SPEC_PATH}"
    with open(SPEC_PATH) as f:
        return yaml.safe_load(f)


def test_spec_is_valid_yaml(spec):
    assert "openapi" in spec
    assert "paths" in spec
    assert "components" in spec
    assert "schemas" in spec["components"]


def test_spec_version(spec):
    assert spec["openapi"].startswith("3.1")


def test_spec_has_required_endpoints(spec):
    paths = spec["paths"]
    assert "/analyze" in paths
    assert "/health" in paths


def test_analyze_endpoint_has_security(spec):
    analyze = spec["paths"]["/analyze"]["post"]
    assert "security" in analyze
    security_names = [list(s.keys())[0] for s in analyze["security"]]
    assert "analyzeSecret" in security_names


def test_analyze_error_responses(spec):
    responses = spec["paths"]["/analyze"]["post"]["responses"]
    for code in ["400", "401", "413", "422", "429"]:
        assert code in responses, f"Missing {code} response documentation"


def _get_spec_schema(spec, name: str) -> dict:
    schemas = spec["components"]["schemas"]
    assert name in schemas, f"Schema {name} not found in spec"
    return schemas[name]


def _get_model_field_names(model: type[BaseModel]) -> set[str]:
    return set(model.model_fields.keys())


def _get_spec_field_names(spec, schema_name: str) -> set[str]:
    schema = _get_spec_schema(spec, schema_name)
    return set(schema.get("properties", {}).keys())


SCHEMA_MODEL_MAP = {
    "AnalyzeOptions": AnalyzeOptions,
    "AnalyzeRequest": AnalyzeRequest,
    "InputResult": InputResult,
    "StructureNode": StructureNode,
    "StructureResult": StructureResult,
    "StructureValidationIssue": StructureValidationIssue,
    "StructureValidationReport": StructureValidationReport,
    "SelectionResult": SelectionResult,
    "RuleUnitNodeRef": RuleUnitNodeRef,
    "RuleUnit": RuleUnit,
    "RuleUnitResult": RuleUnitResult,
    "MeaningBrief": MeaningBrief,
    "MeaningNodeResult": MeaningNodeResult,
    "MeaningResult": MeaningResult,
    "OriginSignal": OriginSignal,
    "OriginResult": OriginResult,
    "VerificationNodeResult": VerificationNodeResult,
    "VerificationResult": VerificationResult,
    "OutputResult": OutputResult,
    "PipelineError": PipelineError,
    "PipelineResponse": PipelineResponse,
}


@pytest.mark.parametrize("schema_name,model", list(SCHEMA_MODEL_MAP.items()))
def test_spec_fields_match_model(spec, schema_name, model):
    spec_fields = _get_spec_field_names(spec, schema_name)
    model_fields = _get_model_field_names(model)

    extra_in_spec = spec_fields - model_fields
    extra_in_model = model_fields - spec_fields

    errors = []
    if extra_in_spec:
        errors.append(f"Fields in spec but NOT in model: {extra_in_spec}")
    if extra_in_model:
        errors.append(f"Fields in model but NOT in spec: {extra_in_model}")

    assert not errors, f"Schema mismatch for {schema_name}:\n" + "\n".join(errors)


def test_spec_required_fields_match_model(spec):
    schema = _get_spec_schema(spec, "PipelineResponse")
    spec_required = set(schema.get("required", []))
    model_required = set()
    for name, field in PipelineResponse.model_fields.items():
        if field.is_required():
            model_required.add(name)

    assert spec_required == model_required, (
        f"PipelineResponse required mismatch:\n"
        f"  Spec: {spec_required}\n"
        f"  Model: {model_required}"
    )


def test_content_type_enum_matches(spec):
    spec_enum = set(_get_spec_schema(spec, "ContentType").get("enum", []))
    model_enum = {e.value for e in ContentType}
    assert spec_enum == model_enum, f"ContentType mismatch: spec={spec_enum}, model={model_enum}"


def test_no_removed_meaning_taxonomy_in_spec(spec):
    spec_str = yaml.dump(spec)
    removed_terms = [
        "MeaningLens",
        "MeaningScopeDetail",
        "modality_shift",
        "scope_change",
        "actor_power_shift",
        "action_domain_shift",
        "threshold_standard_shift",
        "obligation_removal",
    ]
    for term in removed_terms:
        assert term not in spec_str, f"Removed Meaning taxonomy term found in OpenAPI spec: {term}"


def test_no_translated_text_in_spec(spec):
    spec_str = yaml.dump(spec)
    assert "translated_text" not in spec_str, "Stale field 'translated_text' found in OpenAPI spec"
