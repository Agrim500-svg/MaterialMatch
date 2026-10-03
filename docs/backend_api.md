# MaterialMind Phase 7: Backend API

**Status:** Initial FastAPI service implemented  
**Module:** `backend/app.py`

A thin HTTP wrapper around the shared Phase 6 `MaterialMindDiscovery` engine. One
engine instance lives per process, so the similarity index, Phase 2 model, and the
Phase 5 ranking results load/compute once and are reused across requests.

## Run

From the project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --reload --port 8000
```

Interactive API docs are available at `http://127.0.0.1:8000/docs`.

## Response envelope

Every endpoint returns the same envelope so the frontend never inspects
Python exception types:

```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": { "type": "value_error", "message": "..." } }
```

| Error type | HTTP status | Raised by |
|---|---|---|
| `value_error` | 400 | Invalid formula/material ID, unknown intent, bad `k`/`profile`/`mode` |
| `not_found` | 404 | Missing image file or model artifact |
| `upstream_error` | 502 | Gemini or Materials Project failures |
| `internal_error` | 500 | Anything unexpected |

Malformed JSON bodies or missing required fields return FastAPI's standard 422.

## Endpoints

| Method & path | Body | Engine call |
|---|---|---|
| `GET /api/health` | — | liveness check only |
| `POST /api/handle` | `{intent, query?, target?, profile?, k?, include_predictions?}` | generic `handle_request` router |
| `POST /api/discover` | `{query, k?}` | `discover_material`: database record + all four V1 predictions + similarity + cluster context |
| `POST /api/predict` | `{query, target?}` | `predict_property` (offline for plain formulas). `target`: `material_type` (Metal/Non-Metal + model confidence), `band_gap` (two-stage: metal → 0 eV; non-metal → conditional regressor), `density` (g/cm³), `formation_energy_per_atom` (eV/atom, unchanged Phase 2 response), or `all` (all four user-facing outputs under `predictions`) |
| `POST /api/similar` | `{query, profile?, k?}` | `find_similar` |
| `POST /api/rank` | `{k?, include_predictions?}` | `rank_candidates` (ranking cached per process) |
| `POST /api/search-image` | multipart `file` + query params `mode`, `k` | `search_image` (requires `GEMINI_API_KEY`) |
| `POST /api/chat` | `{message, history?}` | `MaterialAssistant.chat` (Gemini intent routing, Phase 8) |

CORS allows `FRONTEND_ORIGIN` (default `http://localhost:5173`) only; set it in
`.env` when deploying (Phase 10).

## Testing

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

`tests/test_backend_api.py` covers the envelope shape, error→status mapping, and
engine reuse over HTTP via FastAPI's `TestClient`.

## Still out of scope (later phases)

- React frontend (Phase 9) consumes these endpoints.
- Gemini conversational layer (Phase 8) will call `/api/handle` after intent parsing.
- Deployment hardening: process manager, auth, rate limits, multi-worker engine
  sharing (Phase 10).
