"""Smoke tests for the Phase 8 Gemini conversational layer.

Gemini HTTP calls are mocked: routing and answer-writing payloads are faked so
the tests run offline and deterministically. The engine side runs for real
against the tiny fixture corpus.
"""

from __future__ import annotations

from typing import Any

import pytest

import src.conversation.assistant as assistant_module
from src.conversation.assistant import MaterialAssistant


def _fake_route(payload: dict[str, Any]):
    """Return a stub replacing only the router call (first Gemini call)."""

    def fake(input_parts, schema, **kwargs):
        if "required" in schema and "answer" in schema["required"]:
            return {"answer": "The estimated formation energy of GaAs is about -0.44 eV/atom..."}
        return dict(payload)

    return fake


@pytest.fixture()
def assistant(engine, monkeypatch) -> MaterialAssistant:
    return MaterialAssistant(engine=engine)


def _message(assistant: MaterialAssistant, text: str, route: dict[str, Any], monkeypatch):
    monkeypatch.setattr(assistant_module, "_gemini_structured_call", _fake_route(route))
    return assistant.chat(text)


def test_router_maps_prediction_question(assistant, monkeypatch) -> None:
    result = _message(assistant, "What is the formation energy of GaAs?", {
        "intent": "predict_property", "query": "GaAs",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 10,
        "clarifying_question": "", "small_talk_reply": "",
    }, monkeypatch)
    assert result["intent"] == "predict_property"
    assert result["engine"]["result"]["prediction"]["target"] == "formation_energy_per_atom"
    assert result["engine"]["result"]["resolved_formula"] == "GaAs"
    assert result["reply"].endswith("...")


def test_router_maps_similarity_question(assistant, monkeypatch) -> None:
    result = _message(assistant, "Find materials similar to MgO", {
        "intent": "find_similar", "query": "MgO",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 3,
        "clarifying_question": "", "small_talk_reply": "",
    }, monkeypatch)
    assert len(result["engine"]["result"]["results"]) == 3
    # Sanitation must carry through the conversational layer too.
    for item in result["engine"]["result"]["results"]:
        assert "fields_not_requested" not in item
        assert isinstance(item["elements"], list)


def test_ranking_needs_no_query(assistant, monkeypatch) -> None:
    # Rank routing against the local fixture would need the real ranking CSV;
    # assert dispatch builds the right engine request instead.
    captured: dict[str, Any] = {}

    class Recorder:
        def handle_request(self, request):
            captured.update(request)
            return {"intent": "rank_candidates", "ranked_candidates": []}

    unit = MaterialAssistant(engine=Recorder())
    monkeypatch.setattr(assistant_module, "_gemini_structured_call", _fake_route({
        "intent": "rank_candidates", "query": "",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 20,
        "clarifying_question": "", "small_talk_reply": "",
    }))
    result = unit.chat("What are the top lightweight semiconductors?")
    assert captured["intent"] == "rank_candidates"
    assert captured["k"] == 20
    assert result["engine"]["result"]["intent"] == "rank_candidates"


def test_engine_error_is_returned_not_raised(assistant, monkeypatch) -> None:
    result = _message(assistant, "predict Xx3", {
        "intent": "predict_property", "query": "Xx3",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 10,
        "clarifying_question": "", "small_talk_reply": "",
    }, monkeypatch)
    assert "error" in result["engine"]
    assert "not a recognized chemical formula" in result["engine"]["error"]
    assert result["reply"]  # writer still produced a grounded message


def test_small_talk_never_touches_engine(assistant, monkeypatch) -> None:
    class Boom:
        def handle_request(self, request):
            raise AssertionError("engine must not be called for small talk")

    unit = MaterialAssistant(engine=Boom())
    result = _message(unit, "hello!", {
        "intent": "small_talk", "query": "",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 10,
        "clarifying_question": "", "small_talk_reply": "Hi! I can explore materials for you.",
    }, monkeypatch)
    assert result["intent"] == "small_talk"
    assert result["engine"] is None
    assert "materials" in result["reply"]


def test_image_intent_asks_for_upload(assistant, monkeypatch) -> None:
    result = _message(assistant, "I have a screenshot of a scatter plot", {
        "intent": "search_image", "query": "",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 10,
        "clarifying_question": "", "small_talk_reply": "",
    }, monkeypatch)
    assert result["engine"] is None
    assert "upload" in result["reply"].lower()


def test_missing_query_falls_back_to_clarifying_question(assistant, monkeypatch) -> None:
    result = _message(assistant, "predict the formation energy", {
        "intent": "predict_property", "query": "",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 10,
        "clarifying_question": "Which formula should I predict for?", "small_talk_reply": "",
    }, monkeypatch)
    assert result["intent"] == "unclear"
    assert result["engine"] is None
    assert result["reply"] == "Which formula should I predict for?"


def test_router_malformed_response_raises_runtime_error(assistant, monkeypatch) -> None:
    monkeypatch.setattr(
        assistant_module, "_gemini_structured_call",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("Gemini returned malformed JSON.")),
    )
    with pytest.raises(RuntimeError, match="malformed JSON"):
        assistant.chat("hello")


def test_message_validation(assistant) -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        assistant.chat("   ")
    with pytest.raises(ValueError, match="4000 character"):
        assistant.chat("x" * 4001)


def test_k_is_clamped_to_bounds(assistant, monkeypatch) -> None:
    result = _message(assistant, "similar to Si", {
        "intent": "find_similar", "query": "Si",
        "target": "formation_energy_per_atom", "profile": "combined", "k": 99999,
        "clarifying_question": "", "small_talk_reply": "",
    }, monkeypatch)
    assert len(result["engine"]["result"]["results"]) <= 100


def test_history_is_forwarded_to_router(assistant, monkeypatch) -> None:
    seen_input: list[str] = []

    def fake(input_parts, schema, **kwargs):
        if "required" in schema and "answer" in schema["required"]:
            return {"answer": "ok"}
        seen_input.append(input_parts[0]["text"])
        return {"intent": "small_talk", "query": "", "target": "formation_energy_per_atom",
                "profile": "combined", "k": 10, "clarifying_question": "",
                "small_talk_reply": "hi"}

    monkeypatch.setattr(assistant_module, "_gemini_structured_call", fake)
    assistant.chat("hello again", history=[{"role": "user", "content": "earlier question"}])
    assert "earlier question" in seen_input[0]
