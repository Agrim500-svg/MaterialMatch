"""Smoke tests for the Phase 5/6 similarity index and combined discovery engine."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from conftest import SAMPLE_ROWS


def _json_round_trip(payload: object) -> str:
    """json.dumps must succeed and emit valid JSON (no raw NaN tokens)."""
    rendered = json.dumps(payload, allow_nan=False)
    return rendered


def test_discover_material_contract(engine) -> None:
    result = engine.discover_material("GaAs", k=3)
    assert result["intent"] == "discover_material"
    assert result["resolved_reference"]["formula_pretty"] == "GaAs"
    assert result["exact_local_records"], "GaAs row should match the local fixture"
    predictions = result["ml_prediction"]
    assert set(predictions.keys()) == {
        "material_type", "band_gap", "formation_energy_per_atom", "density",
    }
    assert predictions["formation_energy_per_atom"]["target"] == "formation_energy_per_atom"
    assert predictions["material_type"]["material_type"] in {"Metal", "Non-Metal"}
    assert predictions["band_gap"]["unit"] == "eV"
    assert predictions["density"]["unit"] == "g/cm^3"
    assert len(result["similar_materials"]) == 3
    _json_round_trip(result)


def test_similar_results_strip_noise_and_parse_elements(engine) -> None:
    result = engine.find_similar("GaAs", k=4)
    for item in result["results"]:
        assert "fields_not_requested" not in item
        assert "unavailable_fields" not in item
        assert isinstance(item["elements"], list)
        assert all(isinstance(symbol, str) for symbol in item["elements"])
    _json_round_trip(result)


def test_query_material_is_excluded_from_similar_results(engine) -> None:
    result = engine.find_similar("GaAs", k=4)
    ids = {item["material_id"] for item in result["results"]}
    assert "mp-t0003" not in ids


def test_missing_property_values_serialize_as_null(engine) -> None:
    result = engine.discover_material("Fe2O3", k=2)
    rendered = _json_round_trip(result)
    assert "NaN" not in rendered
    assert result["resolved_reference"]["band_gap"] is None


def test_predict_property_never_touches_api_for_formulas(engine, monkeypatch) -> None:
    import src.similarity.material_similarity as similarity_module

    def _fail(*args, **kwargs):
        raise AssertionError("API/local resolution must not run for a plain formula")

    monkeypatch.setattr(similarity_module, "_reference_from_api", _fail)
    # Use an engine whose fixture corpus has no formula lookup row either.
    result = engine.predict_property("CaTiO3")
    assert result["resolved_formula"] == "CaTiO3"
    assert result["prediction"]["target"] == "formation_energy_per_atom"
    assert result["prediction"]["unit"] == "eV/atom"
    assert "estimate" in result["prediction"]["warning"].lower()
    _json_round_trip(result)


def test_predict_property_rejects_unsupported_target(engine) -> None:
    with pytest.raises(ValueError, match="Unsupported target"):
        engine.predict_property("GaAs", target="thermal_conductivity")


def test_predict_property_rejects_invalid_formula(engine) -> None:
    with pytest.raises(ValueError, match="not a recognized chemical formula"):
        engine.predict_property("Xx3")


def test_handle_request_dispatches_intents(engine) -> None:
    result = engine.handle_request({"intent": "find_similar", "query": "MgO", "k": 2})
    assert result["intent"] == "find_similar"
    assert len(result["results"]) == 2


def test_unknown_intent_raises(engine) -> None:
    with pytest.raises(ValueError, match="Unknown intent"):
        engine.handle_request({"intent": "summarize_paper"})


def test_missing_query_raises(engine) -> None:
    with pytest.raises(ValueError, match="requires a formula or material ID"):
        engine.handle_request({"intent": "discover_material"})


def test_find_similar_validates_k_and_profile(engine) -> None:
    with pytest.raises(ValueError, match="positive integer"):
        engine.find_similar("GaAs", k=0)
    with pytest.raises(ValueError, match="profile must be"):
        engine.find_similar("GaAs", profile="magic")


def test_index_skips_unparseable_formula_rows(tmp_path: Path) -> None:
    bad_row = dict(SAMPLE_ROWS[0])
    bad_row["material_id"] = "mp-bad1"
    bad_row["formula_pretty"] = "Xx3"
    bad_row["elements"] = "['Xx']"
    data = pd.DataFrame([*SAMPLE_ROWS, bad_row])
    csv_path = tmp_path / "mixed.csv"
    data.to_csv(csv_path, index=False)

    from src.similarity.material_similarity import MaterialSimilarityIndex

    index = MaterialSimilarityIndex.from_csv(csv_path)
    assert "mp-bad1" not in index.materials["material_id"].tolist()
    results = index.search("GaAs", k=3)
    assert "mp-bad1" not in results["material_id"].tolist()
