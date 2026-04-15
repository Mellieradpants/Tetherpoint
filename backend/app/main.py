"""Tetherpoint API — source-anchored parsing stack."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.pipeline.runner import run_pipeline
from app.schemas.models import AnalyzeRequest, PipelineResponse

app = FastAPI(
    title="Tetherpoint",
    description="Source-anchored parsing stack",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze", response_model=PipelineResponse)
def analyze(request: AnalyzeRequest) -> PipelineResponse:
    """Run the locked 7-layer pipeline on the provided document."""
    return run_pipeline(request)


@app.get("/health")
def health():
    return {"status": "ok"}
