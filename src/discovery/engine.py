"""Route structured MaterialMind requests to prediction, search, ranking, and map tools."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "data" / "raw" / "materials_sample.csv"
PREDICTION_MODEL = PROJECT_ROOT / "models" / "formation_energy_per_atom.joblib"
CLUSTER_PIPELINE = PROJECT_ROOT / "experiments" / "clustering" / "clustering_pipeline.joblib"
CLUSTER_ASSIGNMENTS = PROJECT_ROOT / "experiments" / "clustering" / "cluster_assignments.csv"

SUPPORTED_PREDICTION_TARGETS = ("material_type", "band_gap", "formation_energy_per_atom", "density")


def _records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """Make API-friendly records: drop noise columns, parse elements, NaN to null."""
    from src.similarity.material_similarity import clean_material_records

    return json.loads(clean_material_records(frame).to_json(orient="records"))


def _json_value(value: Any) -> Any:
    """Normalize a single model/database value for JSON serialization."""
    if value is None or pd.isna(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


class MaterialMindDiscovery:
    """Shared entry point for the initial discovery stack.

    Expensive model and similarity assets are loaded lazily and reused by this
    instance. The engine accepts structured intents; natural-language intent
    detection and UI upload handling are separate integration work.
    """

    def __init__(self, data_path: str | Path = DEFAULT_DATA):
        self.data_path = Path(data_path)
        self._materials: pd.DataFrame | None = None
        self._similarity_index = None
        self._prediction_model = None
        self._cluster_pipeline: dict[str, Any] | None = None
        self._cluster_assignments: pd.DataFrame | None = None
        self._rank_cache: tuple[pd.DataFrame, dict] | None = None

    @property
    def materials(self) -> pd.DataFrame:
        if self._materials is None:
            self._materials = pd.read_csv(self.data_path)
        return self._materials

    @property
    def similarity_index(self):
        if self._similarity_index is None:
            from src.similarity.material_similarity import MaterialSimilarityIndex

            self._similarity_index = MaterialSimilarityIndex.from_csv(self.data_path)
        return self._similarity_index

    @property
    def prediction_model(self):
        if self._prediction_model is None:
            from src.models.predict_property import load_model

            self._prediction_model = load_model("formation_energy_per_atom")
        return self._prediction_model

    def _resolve(self, query: str) -> dict[str, Any]:
        from src.similarity.material_similarity import reduced_formula_or_none

        query = query.strip()
        if not query:
            raise ValueError("Provide a chemical formula or Materials Project ID.")
        if query.lower().startswith("mp-"):
            return self.similarity_index.resolve_reference(query)
        if reduced_formula_or_none(query) is None:
            raise ValueError(f"'{query}' is not a recognized chemical formula or Materials Project ID.")
        return self.similarity_index.resolve_reference(query)

    def _exact_local_records(self, formula: str, material_id: str | None) -> pd.DataFrame:
        if material_id:
            exact_id = self.materials[
                self.materials["material_id"].astype(str).str.casefold() == str(material_id).casefold()
            ]
            if not exact_id.empty:
                return exact_id.copy()
        from src.similarity.material_similarity import reduced_formula_or_none

        reduced = reduced_formula_or_none(formula)
        if reduced is None:
            return self.materials.iloc[0:0].copy()
        mask = self.materials["formula_pretty"].map(reduced_formula_or_none) == reduced
        return self.materials.loc[mask].copy()

    def _predict_formation_energy(self, formula: str) -> dict[str, Any]:
        from src.features.composition_features import composition_features

        features = pd.DataFrame([composition_features(formula)])
        predicted = float(self.prediction_model.predict(features)[0])
        return {
            "target": "formation_energy_per_atom",
            "value": predicted,
            "unit": "eV/atom",
            "source": "MaterialMind Phase 2 composition-only ML model",
            "warning": "Estimate only; not a Materials Project database value or experimental measurement.",
        }

    def _prediction_block(self, formula: str, target: str) -> dict[str, Any]:
        """Build the user-facing prediction block for one V1 target."""
        if target == "material_type":
            from src.models.predict_property import predict_material_types

            result = predict_material_types([formula])[0]
            return {
                "target": "material_type",
                "material_type": result["material_type"],
                "classification_probability": result["classification_probability"],
                "metal_probability": result["metal_probability"],
                "unit": None,
                "source": "MaterialMind composition-only Random Forest classifier",
                "warning": "Classification probability is a model self-confidence estimate, not accuracy.",
            }
        if target == "band_gap":
            from src.models.predict_property import predict_band_gaps

            result = predict_band_gaps([formula])[0]
            return {
                "target": "band_gap",
                "value": result["value"],
                "unit": "eV",
                "stage": result["stage"],
                "material_type": result["material_type"],
                "classification_probability": result["classification_probability"],
                "source": ("MaterialMind two-stage model: metal/non-metal classifier routes metals "
                           "to 0 eV; the conditional non-metal regressor predicts otherwise."),
                "warning": "Estimate only; not a Materials Project database value or experimental measurement.",
            }
        if target == "density":
            from src.models.predict_property import predict_regression

            return {
                "target": "density",
                "value": predict_regression([formula], "density")[0],
                "unit": "g/cm^3",
                "source": "MaterialMind composition-only regression model",
                "warning": "Estimate only; not a Materials Project database value or experimental measurement.",
            }
        return self._predict_formation_energy(formula)

    def _cluster_context(self, material_id: str | None) -> dict[str, Any] | None:
        if not material_id or not CLUSTER_ASSIGNMENTS.exists():
            return None
        if self._cluster_assignments is None:
            self._cluster_assignments = pd.read_csv(CLUSTER_ASSIGNMENTS)
        matched = self._cluster_assignments[
            self._cluster_assignments["material_id"].astype(str).str.casefold()
            == str(material_id).casefold()
        ]
        if matched.empty:
            return None
        cluster = int(matched.iloc[0]["cluster"])
        peers = self._cluster_assignments[
            (self._cluster_assignments["cluster"] == cluster)
            & (self._cluster_assignments["material_id"].astype(str) != str(material_id))
        ].head(5)
        return {
            "cluster": cluster,
            "source": "Phase 4 K-Means assignment for this exact database record",
            "cluster_note": "Exploratory grouping; not a predicted property or a scientific taxonomy.",
            "example_members": _records(peers[["material_id", "formula_pretty", "band_gap", "density"]]),
        }

    def discover_material(self, query: str, *, k: int = 10) -> dict[str, Any]:
        """Return known record data, an ML estimate, neighbors, and cluster context."""
        reference = self._resolve(query)
        formula = str(reference.get("formula_pretty", ""))
        if not formula:
            raise ValueError(f"Could not resolve a formula for query '{query}'.")
        material_id = reference.get("material_id")
        known = self._exact_local_records(formula, material_id)
        known_fields = [
            field for field in [
                "material_id", "formula_pretty", "band_gap", "density", "is_metal",
                "is_stable", "formation_energy_per_atom", "energy_above_hull",
            ] if field in known.columns
        ]
        neighbors = self.similarity_index.search(reference, k=k, profile="combined")
        return {
            "intent": "discover_material",
            "query": query,
            "resolved_reference": {
                field: _json_value(reference.get(field))
                for field in [
                    "material_id", "formula_pretty", "band_gap", "density", "is_metal",
                    "is_stable", "formation_energy_per_atom", "energy_above_hull",
                ] if field in reference
            },
            "exact_local_records": _records(known[known_fields]),
            "ml_prediction": {
                name: self._prediction_block(formula, name)
                for name in SUPPORTED_PREDICTION_TARGETS
            },
            "similar_materials": _records(neighbors),
            "similarity_note": "Relative similarity scores; not probabilities. Profile: combined when reference properties are available, otherwise composition-only.",
            "cluster_context": self._cluster_context(str(material_id) if material_id else None),
            "sources": {
                "database": "Materials Project summary data where available",
                "prediction": "MaterialMind formula/composition-only model",
                "similarity": "Phase 3 local composition/property index",
                "cluster": "Phase 4 saved exploratory labels; exact local records only",
            },
        }

    def predict_property(self, query: str, *, target: str = "formation_energy_per_atom") -> dict[str, Any]:
        target = target or "formation_energy_per_atom"
        if target != "all" and target not in SUPPORTED_PREDICTION_TARGETS:
            raise ValueError(
                f"Unsupported target '{target}'. Choose from: "
                f"{', '.join(SUPPORTED_PREDICTION_TARGETS)}, or 'all'."
            )
        query = (query or "").strip()
        if not query:
            raise ValueError("Provide a chemical formula or Materials Project ID.")
        if query.lower().startswith("mp-"):
            # An ID needs its formula looked up (local sample first, API fallback).
            reference = self._resolve(query)
            formula = str(reference.get("formula_pretty", "") or "")
            if not formula:
                raise ValueError(f"Could not resolve a formula for query '{query}'.")
        else:
            # Prediction only needs the formula; never hit the local index or the
            # Materials Project API for plain composition strings.
            from src.similarity.material_similarity import reduced_formula_or_none

            formula = reduced_formula_or_none(query) or ""
            if not formula:
                raise ValueError(f"'{query}' is not a recognized chemical formula or Materials Project ID.")
        if target == "all":
            return {
                "intent": "predict_property",
                "query": query,
                "resolved_formula": formula,
                "predictions": {
                    name: self._prediction_block(formula, name)
                    for name in SUPPORTED_PREDICTION_TARGETS
                },
            }
        return {
            "intent": "predict_property",
            "query": query,
            "resolved_formula": formula,
            "prediction": self._prediction_block(formula, target),
        }

    def find_similar(self, query: str, *, k: int = 10, profile: str = "combined") -> dict[str, Any]:
        results = self.similarity_index.search(query, k=k, profile=profile)
        return {
            "intent": "find_similar",
            "query": query,
            "profile": profile,
            "results": _records(results),
            "score_note": "Relative similarity score; not a probability.",
        }

    def rank_candidates(
        self,
        *,
        k: int = 20,
        include_predictions: bool = True,
        material_class: str = "nonmetal",
        min_gap: float = 0.0,
        max_gap: float = 3.0,
        max_density: float | None = None,
        stable_only: bool = True,
    ) -> dict[str, Any]:
        if k < 1:
            raise ValueError("k must be positive.")
        from src.ranking.rank_candidates import rank_candidates

        norm_class = (material_class or "nonmetal").strip().lower()
        is_default = (
            norm_class in ("nonmetal", "non-metal")
            and float(min_gap) == 0.0
            and float(max_gap) == 3.0
            and max_density is None
            and stable_only is True
        )

        if is_default:
            if self._rank_cache is None:
                self._rank_cache = rank_candidates(write_outputs=False)
            candidates, base_summary = self._rank_cache
        else:
            candidates, base_summary = rank_candidates(
                material_class=material_class,
                min_gap=min_gap,
                max_gap=max_gap,
                max_density=max_density,
                stable_only=stable_only,
                write_outputs=False,
            )

        candidates = candidates.head(k).copy()
        if include_predictions and not candidates.empty:
            from src.features.composition_features import composition_features

            feature_rows = pd.DataFrame([
                composition_features(formula) for formula in candidates["formula_pretty"]
            ])
            candidates["predicted_formation_energy_eV_per_atom"] = self.prediction_model.predict(feature_rows)
            candidates["prediction_source"] = "MaterialMind Phase 2 estimate; supplementary to database-based rank"
        if self._cluster_assignments is None and CLUSTER_ASSIGNMENTS.exists():
            self._cluster_assignments = pd.read_csv(CLUSTER_ASSIGNMENTS)
        if self._cluster_assignments is not None and not candidates.empty:
            labels = self._cluster_assignments.set_index("material_id")["cluster"]
            candidates["phase4_cluster_if_in_sample"] = candidates["material_id"].map(labels)
        return {
            "intent": "rank_candidates",
            "ranking_summary": base_summary,
            "ranked_candidates": _records(candidates),
            "ranking_note": "Rank order is from the density-first screening workflow; ML formation energy is supplementary and does not change rank.",
        }

    def search_image(self, image_path: str | Path, *, mode: str = "auto", k: int = 10) -> dict[str, Any]:
        from src.image_search.image_material_search import search_material_image

        return search_material_image(image_path, mode=mode, k=k, data_path=self.data_path)

    def handle_request(self, request: dict[str, Any]) -> dict[str, Any]:
        """Dispatch a structured request. Gemini conversational parsing is a later phase."""
        intent = request.get("intent")
        query = request.get("query")
        k = int(request.get("k", 10))
        if intent == "discover_material":
            if not query:
                raise ValueError("discover_material requires a formula or material ID in 'query'.")
            return self.discover_material(str(query), k=k)
        if intent == "predict_property":
            if not query:
                raise ValueError("predict_property requires a formula or material ID in 'query'.")
            return self.predict_property(str(query), target=request.get("target", "formation_energy_per_atom"))
        if intent == "find_similar":
            if not query:
                raise ValueError("find_similar requires a formula or material ID in 'query'.")
            return self.find_similar(str(query), k=k, profile=request.get("profile", "combined"))
        if intent == "rank_candidates":
            return self.rank_candidates(k=int(request.get("k", 20)), include_predictions=bool(request.get("include_predictions", True)))
        if intent == "search_image":
            if not request.get("image_path"):
                raise ValueError("search_image requires an 'image_path'.")
            return self.search_image(str(request["image_path"]), mode=request.get("mode", "auto"), k=k)
        raise ValueError(
            "Unknown intent. Choose discover_material, predict_property, find_similar, rank_candidates, or search_image."
        )
