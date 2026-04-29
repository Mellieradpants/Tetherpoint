"""Tests for security guards on /analyze endpoint."""

import os

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
TEST_SECRET = os.environ.get("ANALYZE_SECRET", "ci-test-secret")
AUTH_HEADERS = {"x-analyze-secret": TEST_SECRET}


def _req(content="The court ruled.", content_type="text", headers=None, **opts):
    body = {"content": content, "content_type": content_type, "options": opts}
    return client.post("/analyze", json=body, headers=headers or AUTH_HEADERS)


class TestInputValidation:
    def test_empty_content_rejected(self):
        r = client.post(
            "/analyze",
            json={"content": "", "content_type": "text"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 422  # pydantic min_length=1

    def test_whitespace_only_rejected(self):
        r = _req(content="   ")
        assert r.status_code == 400

    def test_invalid_content_type_rejected(self):
        r = client.post(
            "/analyze",
            json={"content": "hi", "content_type": "yaml"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 422

    def test_oversized_content_rejected(self):
        r = _req(content="x" * 500_001)
        assert r.status_code in (413, 422)  # pydantic max_length or guard


class TestMeaningProtection:
    def test_meaning_defaults_to_false(self):
        r = _req()
        assert r.status_code == 200
        data = r.json()
        assert data["meaning"]["status"] == "skipped"

    def test_meaning_blocked_with_invalid_secret(self):
        r = _req(run_meaning=True, headers={"x-analyze-secret": "wrong-secret"})
        assert r.status_code == 401

    def test_meaning_allowed_with_secret(self):
        previous = os.environ.get("ANALYZE_SECRET")
        os.environ["ANALYZE_SECRET"] = "test-secret-123"
        try:
            r = client.post(
                "/analyze",
                json={"content": "Test.", "content_type": "text", "options": {"run_meaning": True}},
                headers={"x-analyze-secret": "test-secret-123"},
            )
            assert r.status_code == 200
            # Meaning may fall back if no external Meaning provider is configured.
        finally:
            if previous is None:
                del os.environ["ANALYZE_SECRET"]
            else:
                os.environ["ANALYZE_SECRET"] = previous


class TestRateLimiting:
    def test_rate_limit_triggers(self):
        from app.security.rate_limiter import GENERAL_LIMIT, rate_limiter
        # Reset state
        rate_limiter._general.clear()
        rate_limiter._meaning.clear()

        results = []
        for _ in range(GENERAL_LIMIT + 5):
            r = _req()
            results.append(r.status_code)

        assert 429 in results
