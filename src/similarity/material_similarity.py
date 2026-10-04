"""Similarity search over a saved Materials Project summary corpus."""

from __future__ import annotations

import ast
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymatgen.core import Composition, Element
from sklearn.impute import SimpleImputer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "data" / "raw" / "materials_sample.csv"
PROPERTY_COLUMNS = ["band_gap", "density", "formation_energy_per_atom", "energy_above_hull"]
COMPOSITION_WEIGHT = 0.5
PROPERTY_WEIGHT = 0.5
# mp_api bookkeeping columns that are not useful in API/search responses.
NOISE_COLUMNS = ("fields_not_requested", "unavailable_fields")

sys.path.insert(0, str(PROJECT_ROOT))
from src.features.composition_features import composition_features


_REAL_ELEMENT_SYMBOLS = {Element.from_Z(i).symbol for i in range(1, 119)}
_LOWER_TO_SYMBOL = {s.lower(): s for s in _REAL_ELEMENT_SYMBOLS}


def reduced_formula_or_none(value: Any) -> str | None:
    """Normalize a formula, returning None instead of raising on bad input.

    Composition() alone accepts placeholder symbols like 'Xx'; element lookup is
    what downstream featurization uses, so reject unknown elements here as well.
    Also handles smart casing canonicalization for common lowercase formula inputs.
    """
    if value is None:
        return None
    raw = str(value).strip()
    if not raw or raw.lower().startswith("mp-"):
        return None

    try:
        composition = Composition(raw)
        for symbol in composition.get_el_amt_dict():
            if symbol not in _REAL_ELEMENT_SYMBOLS:
                raise ValueError(f"Unknown element: {symbol}")
            Element(symbol)
        return composition.reduced_formula
    except Exception:
        pass

    try:
        tokens = []
        i = 0
        while i < len(raw):
            if raw[i].isspace():
                i += 1
                continue
            two = raw[i : i + 2].lower()
            one = raw[i : i + 1].lower()
            if len(two) == 2 and two in _LOWER_TO_SYMBOL:
                tokens.append(_LOWER_TO_SYMBOL[two])
                i += 2
            elif one in _LOWER_TO_SYMBOL:
                tokens.append(_LOWER_TO_SYMBOL[one])
                i += 1
            elif raw[i] in "()[]0123456789.":
                tokens.append(raw[i])
                i += 1
            else:
                return None
        candidate = "".join(tokens)
        composition = Composition(candidate)
        for symbol in composition.get_el_amt_dict():
            if symbol not in _REAL_ELEMENT_SYMBOLS:
                raise ValueError(f"Unknown element: {symbol}")
            Element(symbol)
        return composition.reduced_formula
    except Exception:
        return None


def element_list_from(value: Any) -> list[str]:
    """Convert the CSV '"['A', 'B']"' string repr into a real list of symbols."""
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    try:
        parsed = ast.literal_eval(str(value))
    except (ValueError, SyntaxError):
        return []
    return [str(item) for item in parsed] if isinstance(parsed, (list, tuple)) else []


def clean_material_records(frame: pd.DataFrame) -> pd.DataFrame:
    """Drop mp_api bookkeeping columns and parse element reprs for JSON output."""
    cleaned = frame.drop(columns=[c for c in NOISE_COLUMNS if c in frame.columns]).copy()
    if "elements" in cleaned.columns:
        cleaned["elements"] = cleaned["elements"].map(element_list_from)
    return cleaned


def element_fraction_columns() -> list[str]:
    return [f"fraction_{Element.from_Z(z).symbol}" for z in range(1, 119)]


def composition_vector(formula: str, columns: list[str]) -> np.ndarray:
    amounts = Composition(formula).get_el_amt_dict()
    total = float(sum(amounts.values()))
    fractions = {f"fraction_{symbol}": float(amount) / total for symbol, amount in amounts.items()}
    return np.asarray([fractions.get(column, 0.0) for column in columns], dtype=float)


def _reference_from_api(query: str) -> dict[str, Any] | None:
    """Fetch a reference summary record when it is outside the local sample."""
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("MP_API_KEY")
    if not api_key:
        return None

    from mp_api.client import MPRester

    fields = ["material_id", "formula_pretty", *PROPERTY_COLUMNS, "is_stable", "is_metal"]
    with MPRester(api_key) as mpr:
        if query.lower().startswith("mp-"):
            docs = mpr.materials.summary.search(
                material_ids=[query], deprecated=False, fields=fields
            )
        else:
            formula = Composition(query).reduced_formula
            docs = mpr.materials.summary.search(
                formula=formula, deprecated=False, fields=fields
            )

    if not docs:
        return None

    def hull_value(doc: Any) -> float:
        value = getattr(doc, "energy_above_hull", None)
        return float(value) if value is not None and np.isfinite(float(value)) else np.inf

    docs = sorted(
        docs,
        key=lambda doc: (
            not bool(getattr(doc, "is_stable", False)),
            hull_value(doc),
            str(doc.material_id),
        ),
    )
    return docs[0].model_dump()


class MaterialSimilarityIndex:
    """Index with composition-only, property-only, and combined profiles.

    Element-fraction cosine similarity is blended equally with a distance over
    35 standardized stoichiometric/element-property descriptors to form the
    composition score. Property similarity is 1/(1 + standardized Euclidean
    distance / sqrt(number of properties)). The combined score is the mean of
    composition and property scores when properties are available, otherwise
    it falls back to composition. All scores are relative similarities, not
    probabilities.
    """

    def __init__(self, materials: pd.DataFrame, data_path: str | Path = DEFAULT_DATA):
        parseable = materials["formula_pretty"].map(reduced_formula_or_none).notna()
        self.materials = materials.loc[parseable].reset_index(drop=True).copy()
        self.data_path = Path(data_path)
        self.composition_columns = element_fraction_columns()
        self.compositions = np.vstack([
            composition_vector(formula, self.composition_columns)
            for formula in self.materials["formula_pretty"]
        ])

        descriptor_records = [
            composition_features(formula) for formula in self.materials["formula_pretty"]
        ]
        self.descriptor_columns = [
            name for name in descriptor_records[0] if not name.startswith("fraction_")
        ]
        descriptor_data = pd.DataFrame(descriptor_records)[self.descriptor_columns]
        self.composition_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        descriptor_imputed = self.composition_imputer.fit_transform(descriptor_data)
        self.composition_scaler = StandardScaler()
        self.scaled_composition_descriptors = self.composition_scaler.fit_transform(descriptor_imputed)

        property_data = self.materials[PROPERTY_COLUMNS].apply(pd.to_numeric, errors="coerce")
        self.property_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        property_imputed = self.property_imputer.fit_transform(property_data)
        self.property_scaler = StandardScaler()
        self.scaled_properties = self.property_scaler.fit_transform(property_imputed)

    @classmethod
    def from_csv(cls, data_path: str | Path = DEFAULT_DATA, use_cache: bool = True) -> "MaterialSimilarityIndex":
        resolved_data = Path(data_path).resolve()
        cache_path = PROJECT_ROOT / "models" / "similarity_index.joblib"
        if use_cache and resolved_data == DEFAULT_DATA.resolve() and cache_path.exists():
            import joblib

            try:
                cached = joblib.load(cache_path)
                if isinstance(cached, cls):
                    return cached
            except Exception:
                pass

        materials = pd.read_csv(data_path)
        required = {"material_id", "formula_pretty", *PROPERTY_COLUMNS}
        missing = required - set(materials.columns)
        if missing:
            raise ValueError(f"Input data is missing required columns: {sorted(missing)}")
        return cls(materials, data_path)

    def _resolve_reference(self, query: str | dict[str, Any]) -> dict[str, Any]:
        if isinstance(query, dict):
            return query

        by_id = self.materials[self.materials["material_id"].astype(str) == query]
        if len(by_id):
            return by_id.iloc[0].to_dict()

        if query.lower().startswith("mp-"):
            api_reference = _reference_from_api(query)
            if api_reference is not None:
                return api_reference
            raise ValueError(f"Materials Project ID {query} was not found in the local sample or API.")

        reduced = reduced_formula_or_none(query)
        if not reduced:
            raise ValueError(
                f"'{query}' is neither an MP material ID nor a valid chemical formula."
            )

        reduced_keys = self.materials["formula_pretty"].map(reduced_formula_or_none)
        formula_matches = self.materials[reduced_keys == reduced].copy()
        if len(formula_matches):
            stable = formula_matches.get("is_stable", pd.Series(False, index=formula_matches.index))
            formula_matches["_stable_sort"] = stable.fillna(False).astype(bool)
            formula_matches["_hull_sort"] = pd.to_numeric(
                formula_matches["energy_above_hull"], errors="coerce"
            ).fillna(np.inf)
            return formula_matches.sort_values(
                ["_stable_sort", "_hull_sort", "material_id"],
                ascending=[False, True, True],
            ).iloc[0].drop(labels=["_stable_sort", "_hull_sort"]).to_dict()

        api_reference = _reference_from_api(query)
        if api_reference is not None:
            return api_reference
        return {"material_id": None, "formula_pretty": reduced}

    def resolve_reference(self, query: str | dict[str, Any]) -> dict[str, Any]:
        """Resolve a formula or material ID to local/API reference data."""
        return self._resolve_reference(query)

    def search(
        self,
        query: str | dict[str, Any],
        k: int = 10,
        profile: str = "combined",
    ) -> pd.DataFrame:
        if k < 1:
            raise ValueError("k must be a positive integer.")
        if profile not in {"composition", "properties", "combined"}:
            raise ValueError("profile must be composition, properties, or combined.")

        reference = self._resolve_reference(query)
        formula = str(reference["formula_pretty"])
        query_fraction_vector = composition_vector(formula, self.composition_columns)
        fraction_scores = cosine_similarity(
            query_fraction_vector.reshape(1, -1), self.compositions
        )[0]
        fraction_scores = np.clip(fraction_scores, 0.0, 1.0)

        query_descriptors = pd.DataFrame([composition_features(formula)])[self.descriptor_columns]
        query_descriptors = self.composition_imputer.transform(query_descriptors)
        query_descriptors = self.composition_scaler.transform(query_descriptors)
        descriptor_distances = np.linalg.norm(
            self.scaled_composition_descriptors - query_descriptors, axis=1
        ) / np.sqrt(len(self.descriptor_columns))
        descriptor_scores = 1.0 / (1.0 + descriptor_distances)
        composition_scores = 0.5 * fraction_scores + 0.5 * descriptor_scores

        query_properties = pd.DataFrame([{
            field: pd.to_numeric(pd.Series([reference.get(field)]), errors="coerce").iloc[0]
            for field in PROPERTY_COLUMNS
        }])
        has_property_reference = bool(query_properties.notna().to_numpy().any())
        property_scores = np.full(len(self.materials), np.nan, dtype=float)
        if has_property_reference:
            query_values = self.property_imputer.transform(query_properties)
            query_scaled = self.property_scaler.transform(query_values)
            distances = np.linalg.norm(
                self.scaled_properties - query_scaled, axis=1
            ) / np.sqrt(len(PROPERTY_COLUMNS))
            property_scores = 1.0 / (1.0 + distances)

        if profile == "composition":
            scores = composition_scores
        elif profile == "properties":
            if not has_property_reference:
                raise ValueError("This reference has no database properties for a property-profile search.")
            scores = property_scores
        elif has_property_reference:
            scores = COMPOSITION_WEIGHT * composition_scores + PROPERTY_WEIGHT * property_scores
        else:
            scores = composition_scores

        result = clean_material_records(self.materials)
        result["element_fraction_similarity"] = fraction_scores
        result["composition_descriptor_similarity"] = descriptor_scores
        result["composition_similarity"] = composition_scores
        result["property_similarity"] = property_scores
        result["similarity_score"] = scores
        query_id = reference.get("material_id")
        if query_id is not None:
            result = result[result["material_id"].astype(str) != str(query_id)]

        result = result.sort_values(
            ["similarity_score", "composition_similarity", "material_id"],
            ascending=[False, False, True],
        ).head(k).copy()

        reference_symbols = set(Composition(formula).get_el_amt_dict())
        explanations = []
        shared_elements = []
        for _, candidate in result.iterrows():
            candidate_symbols = set(Composition(str(candidate["formula_pretty"])).get_el_amt_dict())
            shared = sorted(reference_symbols & candidate_symbols)
            shared_elements.append(", ".join(shared) if shared else "none")
            close_properties = []
            if has_property_reference:
                candidate_properties = candidate[PROPERTY_COLUMNS].apply(pd.to_numeric, errors="coerce")
                for index, field in enumerate(PROPERTY_COLUMNS):
                    reference_value = query_properties.iloc[0][field]
                    candidate_value = candidate_properties[field]
                    if pd.notna(reference_value) and pd.notna(candidate_value):
                        scale = self.property_scaler.scale_[index] or 1.0
                        if abs(float(candidate_value) - float(reference_value)) / scale <= 0.5:
                            close_properties.append(field)
            explanation = [f"shared elements: {', '.join(shared) if shared else 'none'}"]
            explanation.append(
                f"composition descriptor score: {descriptor_scores[int(candidate.name)]:.2f}"
            )
            if close_properties:
                explanation.append(f"close database properties: {', '.join(close_properties)}")
            explanations.append("; ".join(explanation))

        result["shared_elements"] = shared_elements
        result["similarity_reasons"] = explanations
        result["reference_material_id"] = query_id
        result["reference_formula"] = formula
        result["similarity_profile"] = profile
        result["score_note"] = "Relative similarity score; not a probability."
        return result.reset_index(drop=True)


def find_similar_materials(
    query: str,
    k: int = 10,
    profile: str = "combined",
    data_path: str | Path = DEFAULT_DATA,
) -> pd.DataFrame:
    """Convenience function for one-off searches against a saved CSV corpus."""
    return MaterialSimilarityIndex.from_csv(data_path).search(query, k, profile)
