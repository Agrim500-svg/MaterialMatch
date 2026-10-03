"""FastAPI wrapper around the MaterialMind discovery engine (Phase 7).

One long-lived MaterialMindDiscovery instance is created at startup so the
similarity index and model artifacts load once. All responses use a uniform
envelope so the React frontend never has to sniff Python exception types:

    success: {"ok": true,  "data": {...}}
    failure: {"ok": false, "error": {"type": "validation_error", "message": "..."}}

Run from the project root:

    .\\.venv\\Scripts\\python.exe -m uvicorn backend.app:app --reload --port 8000
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.discovery.engine import MaterialMindDiscovery

app = FastAPI(title="MaterialMind API", version="0.1.0")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

_engine: MaterialMindDiscovery | None = None
_assistant: Any | None = None


def get_engine() -> MaterialMindDiscovery:
    """Lazily create (and then reuse) one discovery engine per process."""
    global _engine
    if _engine is None:
        _engine = MaterialMindDiscovery()
    return _engine


def get_assistant():
    """One assistant per process, sharing the same engine instance."""
    global _assistant
    if _assistant is None:
        from src.conversation.assistant import MaterialAssistant

        _assistant = MaterialAssistant(engine=get_engine())
    return _assistant


# --- Error envelope -----------------------------------------------------------

ERROR_TYPE_TO_STATUS = {
    "value_error": 400,
    "not_found": 404,
    "upstream_error": 502,
    "internal_error": 500,
}


def ok(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"ok": True, "data": data})


def error_response(error_type: str, message: str) -> JSONResponse:
    status = ERROR_TYPE_TO_STATUS.get(error_type, 500)
    return JSONResponse(
        status_code=status,
        content={"ok": False, "error": {"type": error_type, "message": message}},
    )


@app.exception_handler(ValueError)
async def handle_value_error(_: Request, exc: ValueError) -> JSONResponse:
    return error_response("value_error", str(exc))


@app.exception_handler(FileNotFoundError)
async def handle_not_found(_: Request, exc: FileNotFoundError) -> JSONResponse:
    return error_response("not_found", str(exc))


@app.exception_handler(RuntimeError)
async def handle_runtime_error(_: Request, exc: RuntimeError) -> JSONResponse:
    return error_response("upstream_error", str(exc))


@app.exception_handler(Exception)
async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        raise exc
    return error_response("internal_error", f"Unexpected server error: {exc}")


# --- Request models -------------------------------------------------------------


class DiscoveryRequest(BaseModel):
    intent: str
    query: str | None = None
    target: str = "formation_energy_per_atom"
    profile: str = "combined"
    k: int = Field(default=10, ge=1, le=100)
    include_predictions: bool = True


class PredictRequest(BaseModel):
    query: str
    target: str = "formation_energy_per_atom"


class SimilarRequest(BaseModel):
    query: str
    profile: str = "combined"
    k: int = Field(default=10, ge=1, le=100)


class DiscoverRequest(BaseModel):
    query: str
    k: int = Field(default=10, ge=1, le=100)


class RankRequest(BaseModel):
    k: int = Field(default=20, ge=1, le=100)
    include_predictions: bool = True


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list)


# --- Endpoints ------------------------------------------------------------------


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "data": {"status": "up", "service": "materialmind-api"}}


@app.post("/api/handle")
def handle(request: DiscoveryRequest) -> JSONResponse:
    """Generic intent router mirroring engine.handle_request."""
    engine = get_engine()
    result = engine.handle_request(request.model_dump())
    return ok(result)


@app.post("/api/discover")
def discover(request: DiscoverRequest) -> JSONResponse:
    return ok(get_engine().discover_material(request.query, k=request.k))


@app.post("/api/predict")
def predict(request: PredictRequest) -> JSONResponse:
    return ok(get_engine().predict_property(request.query, target=request.target))


@app.post("/api/similar")
def similar(request: SimilarRequest) -> JSONResponse:
    return ok(get_engine().find_similar(request.query, k=request.k, profile=request.profile))


@app.post("/api/rank")
def rank(request: RankRequest) -> JSONResponse:
    return ok(get_engine().rank_candidates(k=request.k, include_predictions=request.include_predictions))


@app.post("/api/chat")
def chat(request: ChatRequest) -> JSONResponse:
    """Natural-language entry point: Gemini routes the message to engine intents."""
    history = [turn.model_dump() for turn in request.history]
    return ok(get_assistant().chat(request.message, history=history))


@app.post("/api/search-image")
async def search_image(file: UploadFile, mode: str = "auto", k: int = 10) -> JSONResponse:
    """Accept an uploaded image, relay it to the vision-backed search, then clean up."""
    suffix = Path(file.filename or "upload.png").suffix or ".png"
    tmp_path: Path | None = None
    try:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = Path(tmp.name)
        return ok(get_engine().search_image(tmp_path, mode=mode, k=k))
    finally:
        if tmp_path is not None and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
