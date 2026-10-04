"""Gemini conversational layer for MaterialMind (Phase 8).

Flow per chat turn:
1. "Router" call — Gemini reads the user message (+ short history) and returns a
   structured intent chosen from the Phase 2-5 capabilities.
2. Tool call — the structured intent is dispatched to the shared
   MaterialMindDiscovery engine (Phases 2-6), never to free-form code.
3. Available engine JSON is sent back to Gemini for a grounded natural-language
   answer, with the requirement to keep the engine's source/accuracy disclaimers.

Small talk and ambiguous requests never reach the engine: the router answers
them directly or asks one clarifying question.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = "gemini-3-flash-preview"
FALLBACK_MODELS = ("gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.8-flash")
MAX_HISTORY_TURNS = 8

ENGINE_INTENTS = {"discover_material", "predict_property", "find_similar", "rank_candidates"}
ROUTER_INTENTS = sorted(ENGINE_INTENTS | {"search_image", "small_talk", "unclear"})

ROUTER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "intent": {"type": "string", "enum": ROUTER_INTENTS},
        "query": {"type": "string", "description": "Chemical formula or Materials Project ID (mp-...) if the user supplied one, else empty string."},
        "target": {"type": "string", "description": "One of: material_type, band_gap, formation_energy_per_atom, density, all."},
        "profile": {"type": "string", "enum": ["composition", "properties", "combined"]},
        "k": {"type": "integer", "minimum": 1, "maximum": 100},
        "clarifying_question": {"type": "string", "description": "One short question to ask when the intent or query is ambiguous."},
        "small_talk_reply": {"type": "string", "description": "Direct reply for greetings/thanks; empty when not small talk."},
    },
    "required": ["intent", "query", "target", "profile", "k", "clarifying_question", "small_talk_reply"],
}

ROUTER_PROMPT = """You are the request router for MaterialMind, a materials-science
discovery assistant backed by a Materials Project sample and local ML tools.

Map the user's message to exactly one intent:

- discover_material: user asks about a specific material/formula/mp-id in
  general (properties, overview, "tell me about", "what is X like").
- predict_property: user asks for a prediction/estimate for a formula or
  material ID. Supported targets: material_type (metal vs non-metal),
  band_gap (eV), formation_energy_per_atom (eV/atom), density (g/cm^3), and
  'all' for the full V1 profile. If the user asks for a different property,
  still choose this intent and set target to the requested property name so
  the engine can reject it clearly.
- find_similar: user asks for similar/related/comparable materials.
- rank_candidates: user asks for best/top/screened lightweight stable
  semiconductors or candidate rankings.
- search_image: the user references an uploaded image/screenshot/structure
  diagram. (You do not receive the image here; just route it.)
- small_talk: greetings, thanks, or questions about the assistant itself.
- unclear: none of the above fits, or a required formula/id is missing.

Rules:
- Never invent formulas or material IDs. Only copy ones the user typed.
- Default profile is "combined"; use "composition" or "properties" only when
  the user clearly wants composition-only or property-only matching.
- Default k is 10 for searches, 20 for rankings; never exceed 100.
- If query is needed but missing, intent MUST be "unclear" with a specific
  clarifying_question (e.g. which formula to analyze).
- For small_talk, write a one-sentence friendly small_talk_reply that states
  what MaterialMind can do.
"""

ANSWER_PROMPT = """You are MaterialMind's answer writer. You receive:
1) the user's question, and 2) JSON returned by the MaterialMind engine tools.

Write a concise, faithful answer grounded ONLY in that JSON. Rules:
- Keep every numeric disclaimer: ML predictions are estimates (not database
  facts or measurements), similarity scores are relative (not probabilities),
  clusters are exploratory. Say so briefly when you cite those values.
- Distinguish database values from ML estimates; never blend them.
- If the JSON contains an error field, explain it plainly and suggest a fix
  (e.g. a valid formula format like Al2O3 or a materials ID like mp-...).
- Use plain text with short bullet lists when helpful. No markdown headers.
- Do not invent materials, values, or capabilities that are not in the JSON.
"""


def _extract_output_text(body: dict[str, Any]) -> str | None:
    """Read the model text from a Gemini interaction body (both wire shapes)."""
    interaction = body.get("interaction", body)
    output_text = interaction.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text
    for step in reversed(interaction.get("steps", []) or []):
        if step.get("type") != "model_output":
            continue
        for part in step.get("content", []) or []:
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                return text
    return None


def _gemini_structured_call(
    input_parts: list[dict[str, Any]],
    schema: dict[str, Any],
    *,
    model_env: str = "GEMINI_CHAT_MODEL",
) -> dict[str, Any]:
    """One Gemini call that must answer with schema-valid JSON (retried with fallback models)."""
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Add your Gemini API key to the local .env file."
        )

    configured_model = os.getenv(model_env, DEFAULT_MODEL)
    models_to_try = [configured_model]
    for fb in FALLBACK_MODELS:
        if fb not in models_to_try:
            models_to_try.append(fb)

    last_error_detail = ""
    for model_name in models_to_try:
        payload = {
            "model": model_name,
            "input": input_parts,
            "response_format": {"type": "text", "mime_type": "application/json", "schema": schema},
            "generation_config": {"thinking_level": os.getenv("GEMINI_THINKING_LEVEL", "low")},
        }

        for attempt in range(2):
            try:
                response = requests.post(
                    "https://generativelanguage.googleapis.com/v1beta/interactions",
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=payload,
                    timeout=90,
                )
            except Exception as exc:
                last_error_detail = str(exc)
                continue

            if response.ok:
                body = response.json()
                output_text = _extract_output_text(body)
                if output_text:
                    try:
                        return json.loads(output_text)
                    except json.JSONDecodeError:
                        pass
            else:
                last_error_detail = f"{model_name} failed ({response.status_code}): {response.text[:200]}"
                # If rate limited or 503 high demand or 5xx, try fallback model
                if response.status_code in {429, 503, 500, 502, 504}:
                    break

    raise RuntimeError(f"Gemini request failed on all models: {last_error_detail}")


def _history_excerpt(history: list[dict[str, str]] | None) -> str:
    """Render the last few turns for the router prompt (no engine JSON bloat)."""
    if not history:
        return ""
    turns = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        role = str(turn.get("role", "user"))
        content = str(turn.get("content", ""))[:400]
        turns.append(f"{role}: {content}")
    return "\n".join(turns)


class MaterialAssistant:
    """Conversational facade over the Phase 6 discovery engine."""

    def __init__(self, engine: Any | None = None):
        self._engine = engine

    @property
    def engine(self):
        if self._engine is None:
            from src.discovery.engine import MaterialMindDiscovery

            self._engine = MaterialMindDiscovery()
        return self._engine

    def _route(self, message: str, history: list[dict[str, str]] | None) -> dict[str, Any]:
        history_text = _history_excerpt(history)
        context = f"\n\nRecent conversation:\n{history_text}" if history_text else ""
        return _gemini_structured_call(
            [{"type": "text", "text": f"{ROUTER_PROMPT}{context}\n\nUser message: {message}"}],
            ROUTER_SCHEMA,
        )

    def _dispatch(self, route: dict[str, Any]) -> dict[str, Any]:
        """Run the routed intent through the engine; errors are returned, never raised."""
        intent = str(route.get("intent", ""))
        query = str(route.get("query") or "").strip()
        request: dict[str, Any] = {
            "intent": intent,
            "query": query or None,
            "target": route.get("target") or "formation_energy_per_atom",
            "profile": route.get("profile") or "combined",
            "k": max(1, min(int(route.get("k") or 10), 100)),
        }
        try:
            return {"result": self.engine.handle_request(request)}
        except ValueError as exc:
            return {"error": str(exc)}

    def _answer(
        self,
        message: str,
        route: dict[str, Any],
        engine_payload: dict[str, Any],
    ) -> str:
        payload = json.dumps(engine_payload, indent=2)[:60000]
        result = _gemini_structured_call(
            [{
                "type": "text",
                "text": (
                    f"{ANSWER_PROMPT}\n\nUser question: {message}\n\n"
                    f"Routed intent: {route.get('intent')}\n\nEngine JSON:\n{payload}"
                ),
            }],
            {"type": "object", "properties": {"answer": {"type": "string"}}, "required": ["answer"]},
        )
        return str(result["answer"]).strip()

    def chat(self, message: str, history: list[dict[str, str]] | None = None) -> dict[str, Any]:
        """Handle one chat message end-to-end and return reply + routing/tool trace."""
        message = str(message or "").strip()
        if not message:
            raise ValueError("Message must not be empty.")
        if len(message) > 4000:
            raise ValueError("Message exceeds the 4000 character limit.")

        route = self._route(message, history)
        intent = str(route.get("intent", "unclear"))

        if intent == "small_talk":
            reply = str(route.get("small_talk_reply") or "").strip() or (
                "I help you explore materials: ask about a formula, request a "
                "formation-energy prediction, find similar materials, or rank candidates."
            )
            return {"reply": reply, "intent": "small_talk", "route": route, "engine": None}

        if intent == "search_image":
            reply = (
                "Please upload the image (screenshot, table, or structure diagram) using "
                "the image search option, and I will interpret it and find related materials."
            )
            return {"reply": reply, "intent": intent, "route": route, "engine": None}

        engine_payload: dict[str, Any] | None = None
        if intent in ENGINE_INTENTS:
            if intent != "rank_candidates" and not str(route.get("query") or "").strip():
                intent = "unclear"
            else:
                engine_payload = self._dispatch(route)

        if engine_payload is None:
            question = str(route.get("clarifying_question") or "").strip() or (
                "Which chemical formula (e.g. Al2O3) or Materials Project ID "
                "(e.g. mp-...) should I analyze?"
            )
            return {"reply": question, "intent": "unclear", "route": route, "engine": None}

        reply = self._answer(message, route, engine_payload)
        return {"reply": reply, "intent": route.get("intent"), "route": route, "engine": engine_payload}
