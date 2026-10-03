"""Reusable inference for the saved MaterialMind V1 models.

Targets (all composition-only, 153 shared descriptors from formula parsing):

- ``formation_energy_per_atom``: HistGradientBoosting regression (eV/atom)
- ``density``: HistGradientBoosting regression (g/cm^3)
- ``band_gap``: two-stage — metal classifier routes metals to 0 eV; the
  conditional non-metal HistGradientBoosting regressor predicts otherwise (eV)
- ``material_type``: Random Forest binary classifier (Metal/Non-Metal +
  probability)

Models are loaded once per process via ``functools.lru_cache``. Returned values
are MaterialMind ML estimates, not experimentally verified values, DFT results,
or Materials Project database values.
"""

from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Any, Sequence

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = PROJECT_ROOT / "models"

MODEL_SPECS: dict[str, dict[str, Any]] = {
    "formation_energy_per_atom": {
        "path": MODEL_DIR / "formation_energy_per_atom.joblib",
        "unit": "eV/atom",
        "kind": "regression",
    },
    "density": {"path": MODEL_DIR / "density.joblib", "unit": "g/cm^3", "kind": "regression"},
    "band_gap": {
        "path": MODEL_DIR / "band_gap_nonmetal.joblib",
        "unit": "eV",
        "kind": "regression",
        "scope": "conditional non-metal regressor",
    },
    "material_type": {
        "path": MODEL_DIR / "metal_classifier.joblib",
        "unit": None,
        "kind": "classification",
    },
}

sys.path.insert(0, str(PROJECT_ROOT))
from src.features.composition_features import composition_features, reduced_formula


@lru_cache(maxsize=None)
def load_model(key: str):
    """Load a saved Phase 2/V1 pipeline once per process."""
    spec = MODEL_SPECS[key]
    if not spec["path"].exists():
        raise FileNotFoundError(f"Trained model not found: {spec['path']}")
    return joblib.load(spec["path"])


def _formula_list(formulas: str | Sequence[str]) -> list[str]:
    formula_list = [formulas] if isinstance(formulas, str) else list(formulas)
    if not formula_list:
        raise ValueError("Provide at least one chemical formula.")
    return formula_list


def composition_frame(formulas: list[str]) -> pd.DataFrame:
    return pd.DataFrame([composition_features(formula) for formula in formulas]).replace(
        [float("inf"), float("-inf")], pd.NA
    )


def predict_formation_energy(
    formulas: str | Sequence[str],
    model_path: str | Path | None = None,
) -> pd.DataFrame:
    """Predict formation energy from one or more chemical formulas (unchanged Phase 2 API).

    Returned values are MaterialMind ML estimates in eV/atom, not experimentally
    verified values or Materials Project database values.
    """
    formula_list = _formula_list(formulas)
    if model_path is not None:
        model = joblib.load(model_path)
        predictions = model.predict(composition_frame(formula_list))
    else:
        predictions = load_model("formation_energy_per_atom").predict(composition_frame(formula_list))
    return pd.DataFrame({
        "formula": formula_list,
        "predicted_formation_energy_eV_per_atom": predictions,
        "value_source": "MaterialMind ML model",
    })


def predict_regression(formulas: str | Sequence[str], target: str) -> list[float]:
    """Unconditional regression prediction for formation_energy_per_atom or density."""
    if target not in ("formation_energy_per_atom", "density"):
        raise ValueError("predict_regression targets: formation_energy_per_atom, density")
    formula_list = _formula_list(formulas)
    preds = load_model(target).predict(composition_frame(formula_list))
    return [float(value) for value in preds]


def predict_material_types(formulas: str | Sequence[str]) -> list[dict[str, Any]]:
    """Metal/Non-Metal classification with model probability (self-confidence, not accuracy)."""
    formula_list = _formula_list(formulas)
    model = load_model("material_type")
    classes = model.predict(composition_frame(formula_list))
    metal_proba = model.predict_proba(composition_frame(formula_list))[:, 1]
    results = []
    for formula, is_metal, prob in zip(formula_list, classes, metal_proba):
        prob = float(prob)
        results.append({
            "formula": formula,
            "material_type": "Metal" if bool(is_metal) else "Non-Metal",
            "metal_probability": round(prob, 4),
            "classification_probability": round(prob if bool(is_metal) else 1.0 - prob, 4),
        })
    return results


def predict_band_gaps(formulas: str | Sequence[str]) -> list[dict[str, Any]]:
    """Two-stage band gap: classifier routes metals to 0 eV; non-metals are regressed."""
    formula_list = _formula_list(formulas)
    types = predict_material_types(formula_list)
    nonmetal_indices = [
        index for index, item in enumerate(types) if item["material_type"] == "Non-Metal"
    ]
    regression: dict[int, float] = {}
    if nonmetal_indices:
        subset = [formula_list[index] for index in nonmetal_indices]
        preds = load_model("band_gap").predict(composition_frame(subset))
        for index, value in zip(nonmetal_indices, preds):
            regression[index] = max(0.0, float(value))

    results = []
    for index, item in enumerate(types):
        is_metal = item["material_type"] == "Metal"
        results.append({
            "formula": item["formula"],
            "value": 0.0 if is_metal else regression[index],
            "unit": "eV",
            "material_type": item["material_type"],
            "classification_probability": item["classification_probability"],
            "metal_probability": item["metal_probability"],
            "stage": "classifier_only" if is_metal else "classifier_then_nonmetal_regression",
        })
    return results


def normalize_formula(formula: str) -> str | None:
    try:
        return reduced_formula(formula)
    except Exception:
        return None


if __name__ == "__main__":
    examples = ["GaAs", "SiO2", "MgO", "Fe"]
    print(predict_formation_energy(examples).to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print()
    print(pd.DataFrame(predict_band_gaps(examples)).to_string(index=False, float_format=lambda v: f"{v:.4f}"))
