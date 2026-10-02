"""Composition-only descriptor generation for MaterialMind experiments."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from pymatgen.core import Composition, Element

ELEMENT_SYMBOLS = [Element.from_Z(z).symbol for z in range(1, 119)]
PROPERTY_NAMES = ("Z", "atomic_mass", "X", "atomic_radius", "row", "group")


def reduced_formula(formula: str) -> str:
    """Return a normalized composition key for grouping polymorphs together."""
    return Composition(formula).reduced_formula


def composition_features(formula: str) -> dict[str, float]:
    """Create fixed-length elemental fractions and Magpie-like composition stats.

    Features depend only on the chemical formula. Missing tabulated elemental
    properties are represented as NaN and imputed inside each model pipeline.
    """
    composition = Composition(formula)
    amounts = composition.get_el_amt_dict()
    total = float(sum(amounts.values()))
    fractions = {symbol: float(amount) / total for symbol, amount in amounts.items()}
    result: dict[str, float] = {
        f"fraction_{symbol}": fractions.get(symbol, 0.0)
        for symbol in ELEMENT_SYMBOLS
    }

    fraction_values = np.asarray(list(fractions.values()), dtype=float)
    result["num_elements"] = float(len(fractions))
    result["fraction_min"] = float(fraction_values.min())
    result["fraction_max"] = float(fraction_values.max())
    result["fraction_sum_squares"] = float(np.square(fraction_values).sum())
    result["composition_entropy"] = float(
        -sum(f * math.log(f) for f in fraction_values if f > 0)
    )

    elements: list[tuple[Element, float]] = [
        (Element(symbol), fraction) for symbol, fraction in fractions.items()
    ]
    for property_name in PROPERTY_NAMES:
        values: list[tuple[float, float]] = []
        for element, fraction in elements:
            value: Any = getattr(element, property_name, None)
            try:
                numeric_value = float(value) if value is not None else np.nan
            except (TypeError, ValueError):
                numeric_value = np.nan
            if np.isfinite(numeric_value):
                values.append((numeric_value, fraction))

        prefix = f"{property_name}_stats"
        if not values:
            result.update({
                f"{prefix}_mean": np.nan,
                f"{prefix}_std": np.nan,
                f"{prefix}_min": np.nan,
                f"{prefix}_max": np.nan,
                f"{prefix}_range": np.nan,
            })
            continue

        vals = np.asarray([item[0] for item in values], dtype=float)
        weights = np.asarray([item[1] for item in values], dtype=float)
        weights /= weights.sum()
        mean = float(np.average(vals, weights=weights))
        std = float(np.sqrt(np.average(np.square(vals - mean), weights=weights)))
        minimum = float(vals.min())
        maximum = float(vals.max())
        result.update({
            f"{prefix}_mean": mean,
            f"{prefix}_std": std,
            f"{prefix}_min": minimum,
            f"{prefix}_max": maximum,
            f"{prefix}_range": maximum - minimum,
        })

    return result

