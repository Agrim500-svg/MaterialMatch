"""Tests for the MaterialMatch V1 four-target prediction layer.

Two tiers:
- unit tests monkeypatch the loaded models to deterministically verify the
  classifier -> conditional-regression routing and response contracts;
- integration tests use the real saved joblib artifacts to check loading,
  inference, and consistent feature schemas across the four models.
"""

from __future__ import annotations

import json
from typing import Any

import joblib
import numpy as np
import pandas as pd
import pytest

import src.models.predict_property as predict_module
from src.models.predict_property import (
    MODEL_SPECS,
    load_model,
    predict_band_gaps,
    predict_material_types,
    predict_regression,
)


# ----- unit tests (mocked models) ---------------------------------------------


class _FakeClassifier:
    """Always predicts the scripted label; probability comes from a fixed lookup."""

    def __init__(self, metals: set[str]):
        self._metals = metals

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        return np.array([True] * len(features), dtype=bool)

    def predict_proba(self, features: pd.DataFrame) -> np.ndarray:
        out = np.zeros((len(features), 2))
        out[:, 1] = 0.9
        out[:, 0] = 0.1
        return out


class _ZeroBandGapRegressor:
    def predict(self, features: pd.DataFrame) -> np.ndarray:
        return np.array([1.23] * len(features))


class _DualClassifier:
    """Classifies 'Fe' as metal and everything else as non-metal (by input order)."""

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        return np.array([True, False], dtype=bool)

    def predict_proba(self, features: pd.DataFrame) -> np.ndarray:
        return np.array([[0.02, 0.98], [0.91, 0.09]])


def _patch_models(monkeypatch, classifier, bandgap=None, density=None, fe=None):
    store: dict[str, Any] = {
        "material_type": classifier,
        "band_gap": bandgap or _ZeroBandGapRegressor(),
        "density": density or _ZeroBandGapRegressor(),
        "formation_energy_per_atom": fe or _ZeroBandGapRegressor(),
    }
    monkeypatch.setattr(predict_module, "load_model", store.__getitem__)
    return store


def test_metal_routes_to_zero_band_gap(monkeypatch) -> None:
    _patch_models(monkeypatch, _FakeClassifier(metals={"Fe"}))
    # Force the classifier to label Fe as metal regardless of chemistry.
    results = predict_band_gaps(["Fe"])
    assert results[0]["material_type"] == "Metal"
    assert results[0]["value"] == 0.0
    assert results[0]["unit"] == "eV"
    assert results[0]["stage"] == "classifier_only"
    assert results[0]["classification_probability"] == 0.9


def test_nonmetal_invokes_conditional_regressor(monkeypatch) -> None:
    _patch_models(monkeypatch, _DualClassifier())
    results = predict_band_gaps(["Fe", "MgO"])
    assert results[0]["material_type"] == "Metal"
    assert results[0]["value"] == 0.0
    assert results[1]["material_type"] == "Non-Metal"
    assert results[1]["value"] == 1.23
    assert results[1]["stage"] == "classifier_then_nonmetal_regression"


def test_material_type_contract(monkeypatch) -> None:
    _patch_models(monkeypatch, _FakeClassifier(metals=set()))
    result = predict_material_types(["GaAs"])[0]
    assert result["material_type"] == "Metal"  # scripted stub
    assert result["classification_probability"] == result["metal_probability"] == 0.9
    assert 0.0 <= result["metal_probability"] <= 1.0


def test_band_gap_never_negative(monkeypatch) -> None:
    class _Negative:
        def predict(self, features):
            return np.array([-0.5] * len(features))

    _patch_models(monkeypatch, _DualClassifier(), bandgap=_Negative())
    assert predict_band_gaps(["Fe", "MgO"])[1]["value"] == 0.0


def test_density_and_formation_energy_regression_units(engine, monkeypatch) -> None:
    _patch_models(monkeypatch, _FakeClassifier(metals=set()))
    assert engine.predict_property("MgO", target="density")["prediction"]["unit"] == "g/cm^3"
    fe = engine.predict_property("MgO", target="formation_energy_per_atom")["prediction"]
    assert fe["unit"] == "eV/atom" and fe["target"] == "formation_energy_per_atom"


def test_engine_all_target_returns_four_blocks(engine, monkeypatch) -> None:
    _patch_models(monkeypatch, _FakeClassifier(metals=set()))
    result = engine.predict_property("Si", target="all")
    assert set(result["predictions"].keys()) == {
        "material_type", "band_gap", "formation_energy_per_atom", "density",
    }
    assert result["predictions"]["material_type"]["material_type"] == "Metal"
    assert result["predictions"]["band_gap"]["unit"] == "eV"
    json.dumps(result)  # JSON-safe


# ----- integration tests (real saved artifacts) -------------------------------


@pytest.mark.parametrize("key,filename", [
    ("formation_energy_per_atom", "formation_energy_per_atom.joblib"),
    ("material_type", "metal_classifier.joblib"),
    ("band_gap", "band_gap_nonmetal.joblib"),
    ("density", "density.joblib"),
])
def test_model_artifact_loads(key: str, filename: str) -> None:
    path = MODEL_SPECS[key]["path"]
    assert path.exists(), f"missing model artifact: {filename}"
    assert joblib.load(path) is not None


def test_real_two_stage_pipeline_on_known_materials() -> None:
    """Si (a solid) must be classified and get a finite non-negative band gap load-out."""
    result = predict_band_gaps(["Si"])[0]
    assert result["material_type"] in {"Metal", "Non-Metal"}
    assert result["value"] >= 0.0
    assert result["unit"] == "eV"
    if result["material_type"] == "Metal":
        assert result["value"] == 0.0


def test_real_density_prediction_sane_range() -> None:
    value = predict_regression(["SiO2"], "density")[0]
    assert 0.0 < value < 30.0  # plausible g/cm^3 for this composition family


def test_shared_feature_schema_across_models() -> None:
    """All four models must consume the same 153 composition features."""
    frame = predict_module.composition_frame(["H2O"])
    assert frame.shape[1] == 153, frame.shape
    for key in MODEL_SPECS:
        model = load_model(key)
        prediction = model.predict(frame)
        assert len(prediction) == 1
