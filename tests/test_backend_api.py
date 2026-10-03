"""API smoke tests: envelope shape, status mapping, engine reuse."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import backend.app as backend_app


@pytest.fixture()
def client(engine, monkeypatch):
    """TestClient with the shared discovery engine replaced by the fixture engine.

    Only patch the get_engine factory so the real FastAPI app, error handlers,
    and CORS middleware run exactly as in production.
    """
    monkeypatch.setattr(backend_app, "get_engine", lambda: engine)
    with TestClient(backend_app.app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "data": {"status": "up", "service": "materialmind-api"}}


def test_predict_success_envelope(client: TestClient) -> None:
    response = client.post("/api/predict", json={"query": "GaAs"})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["intent"] == "predict_property"
    assert body["data"]["resolved_formula"] == "GaAs"


def test_predict_validation_error_maps_to_400(client: TestClient) -> None:
    response = client.post("/api/predict", json={"query": "Xx3"})
    assert response.status_code == 400
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["type"] == "value_error"
    assert "not a recognized chemical formula" in body["error"]["message"]


def test_similar_invalid_profile_maps_to_400(client: TestClient) -> None:
    response = client.post("/api/similar", json={"query": "GaAs", "profile": "magic"})
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "value_error"


def test_missing_field_maps_to_422(client: TestClient) -> None:
    response = client.post("/api/predict", json={})
    assert response.status_code == 422


def test_handle_routes_unknown_intent_to_400(client: TestClient) -> None:
    response = client.post("/api/handle", json={"intent": "summarize_paper"})
    assert response.status_code == 400
    assert "Unknown intent" in response.json()["error"]["message"]


def test_discover_endpoint(client: TestClient) -> None:
    response = client.post("/api/discover", json={"query": "GaAs", "k": 2})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["intent"] == "discover_material"
    assert len(data["similar_materials"]) == 2
