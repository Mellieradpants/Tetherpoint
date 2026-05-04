"""Tetherpoint API — source-dependent traceability stack."""

import logging
import os

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.pipeline.runner import run_pipeline
from app.schemas.models import AnalyzeRequest, PipelineResponse
from app.security.guards import enforce_security

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

logger = logging.getLogger("tetherpoint.cors")

app = FastAPI(
    title="Tetherpoint",
    description="Interface-level traceability layer for source-dependent AI meaning",
    version="0.1.0",
)

_default_origins = "http://localhost:5173"
_raw = os.environ.get("ALLOWED_ORIGINS", _default_origins)
ALLOWED_ORIGINS = [origin.strip() for origin in _raw.split(",") if origin.strip()]

logger.info("CORS allowed origins: %s", ALLOWED_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.options("/analyze")
async def options_analyze():
    return Response(status_code=200)


@app.post("/analyze", response_model=PipelineResponse)
def analyze(
    body: AnalyzeRequest,
    request: Request,
    x_analyze_secret: str = Header(..., alias="x-analyze-secret"),
) -> PipelineResponse:
    """Run the locked 10-layer traceability pipeline on the provided document."""
    _ = x_analyze_secret
    body = enforce_security(body, request)
    return run_pipeline(body)


@app.get("/health")
def health():
    return {"status": "ok"}
