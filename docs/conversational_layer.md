# MaterialMind Phase 8: Gemini Conversational Layer

**Status:** Implemented and live smoke-tested  
**Module:** `src/conversation/assistant.py` (`MaterialAssistant` class)  
**Endpoints:** `POST /api/chat`

## Flow per chat turn

1. **Router call** — Gemini reads the user message (+ last 8 turns of history)
   and returns structured JSON via `ROUTER_SCHEMA`: one intent of
   `discover_material`, `predict_property`, `find_similar`, `rank_candidates`,
   `search_image`, `small_talk`, or `unclear`, plus extracted
   `query`/`target`/`profile`/`k`.
2. **Tool call** — actionable intents are dispatched to the shared Phase 6
   `MaterialMindDiscovery` engine through `handle_request`. Engine `ValueError`s
   (bad formula, unknown intent) are returned as an `{"error": ...}` payload to
   the answer writer instead of raising.
   - `small_talk`, `search_image`, and `unclear` never touch the engine.
   - A missing formula or material ID forces intent `unclear` and returns one
     clarifying question.
3. **Answer call** — engine JSON goes back to Gemini with instructions to stay
   grounded: keep ML-estimate/relative-score/exploratory-cluster disclaimers,
   never blend database values with ML estimates, never invent materials.

## Use from Python / CLI

```python
from src.conversation.assistant import MaterialAssistant

assistant = MaterialAssistant()
result = assistant.chat("What is the formation energy of GaAs?")
print(result["reply"])        # grounded natural-language answer
print(result["intent"])       # routed intent
print(result["engine"])       # engine JSON (result or error) for UI rendering
```

```powershell
# one-shot with routing trace
.\.venv\Scripts\python.exe -m src.conversation.run_chat "Find materials similar to GaAs" --trace
# interactive
.\.venv\Scripts\python.exe -m src.conversation.run_chat
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — | required for router + answer calls |
| `GEMINI_CHAT_MODEL` | `gemini-3.8-flash` | chat model override |
| `GEMINI_THINKING_LEVEL` | `low` | Gemini thinking level (`minimal` is **not** supported by this model) |

Gemini 5xx responses (e.g. transient `service_unavailable`) are retried up to
2 times with a short backoff; on persistent failure a `RuntimeError` is raised,
which the backend maps to HTTP 502 (`upstream_error`).

## Testing

- `tests/test_conversation_assistant.py` — 11 offline tests: Gemini calls are
  mocked with canned router/answer payloads, engine side runs for real on the
  fixture corpus. Covers routing, dispatch, error-return behavior, small-talk
  and image bypasses, clarifying fallback, validation, k clamping, history
  forwarding.
- Live verified: prediction, similarity (top-3 with disclaimers), small talk,
  clarifying questions, and `/api/chat` error envelope over HTTP.

## Boundaries (unchanged from earlier phases)

The layer never predicts anything itself: all numbers come from engine JSON.
The router can only copy formulas/IDs the user typed. Free-tier note: Gemini
has a low daily request cap; two Gemini calls happen per engine-backed turn, so
development testing can exhaust the quota quickly.
