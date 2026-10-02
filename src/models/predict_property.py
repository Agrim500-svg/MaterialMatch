"""Reproducible inference for the saved formation-energy model."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import joblib
import pandas as pd
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = PROJECT_ROOT / "models" / "formation_energy_per_atom.joblib"

sys.path.insert(0, str(PROJECT_ROOT))
from src.features.composition_features import composition_features


def predict_formation_energy(
    formulas: str | Sequence[str],
    model_path: str | Path = MODEL_PATH,
) -> pd.DataFrame:
    """Predict formation energy from one or more chemical formulas.

    Returned values are MaterialMind ML estimates in eV/atom, not experimentally
    verified values or Materials Project database values.
    """
    formula_list = [formulas] if isinstance(formulas, str) else list(formulas)
    if not formula_list:
        raise ValueError("Provide at least one chemical formula.")

    model = joblib.load(model_path)
    features = pd.DataFrame([composition_features(formula) for formula in formula_list])
    predictions = model.predict(features)
    return pd.DataFrame({
        "formula": formula_list,
        "predicted_formation_energy_eV_per_atom": predictions,
        "value_source": "MaterialMind ML model",
    })


if __name__ == "__main__":
    examples = predict_formation_energy(["GaAs", "SiO2", "MgO"])
    print(examples.to_string(index=False, float_format=lambda value: f"{value:.4f}"))

