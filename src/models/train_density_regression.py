"""Train and evaluate the composition-only density regressor (V1).

Standard regression on all rows with a valid density. No routing through the
metal classifier (density is a general property of every material). Features
are the shared 153 composition descriptors; density is never an input.
"""

from __future__ import annotations

import json
import platform
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_CSV = PROJECT_ROOT / "data" / "raw" / "materials_sample.csv"
SAMPLE_METADATA = PROJECT_ROOT / "data" / "raw" / "materials_sample_metadata.json"
RESULTS_DIR = PROJECT_ROOT / "experiments" / "density_regression"
MODEL_DIR = PROJECT_ROOT / "models"
TARGET = "density"
SEED = 42

sys.path.insert(0, str(PROJECT_ROOT))
from src.features.composition_features import composition_features, reduced_formula


def metric_row(name: str, y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float | str]:
    return {
        "model": name,
        "mae_g_cm3": float(mean_absolute_error(y_true, y_pred)),
        "rmse_g_cm3": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(INPUT_CSV)
    initial_rows = len(raw)
    clean = raw.drop_duplicates(subset="material_id", keep="first").copy()
    clean = clean.dropna(subset=["formula_pretty", TARGET]).copy()
    clean[TARGET] = pd.to_numeric(clean[TARGET], errors="coerce")
    clean = clean[np.isfinite(clean[TARGET]) & clean[TARGET].gt(0)].copy()
    clean["composition_group"] = clean["formula_pretty"].map(reduced_formula)

    target_stats = clean[TARGET].describe()

    feature_records = [composition_features(formula) for formula in clean["formula_pretty"]]
    features = pd.DataFrame(feature_records, index=clean.index)
    features = features.replace([np.inf, -np.inf], np.nan)

    assert not {"density", "is_metal", "label_is_metal", "band_gap"}.intersection(features.columns), \
        "leakage: density or other target column present in feature matrix"

    y = clean[TARGET].to_numpy(dtype=float)
    groups = clean["composition_group"].to_numpy()
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=SEED)
    train_idx, test_idx = next(splitter.split(features, y, groups=groups))
    pd.DataFrame({
        "material_id": clean["material_id"],
        "reduced_formula": clean["composition_group"],
        "partition": np.where(np.isin(np.arange(len(clean)), train_idx), "train", "test"),
    }).to_csv(RESULTS_DIR / "split_assignments.csv", index=False)

    X_train, X_test = features.iloc[train_idx], features.iloc[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    groups_train = groups[train_idx]

    estimators = {
        "mean_baseline": make_pipeline(SimpleImputer(strategy="median"), DummyRegressor(strategy="mean")),
        "ridge": make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), Ridge(alpha=10.0)),
        "random_forest": make_pipeline(
            SimpleImputer(strategy="median"),
            RandomForestRegressor(
                n_estimators=250, max_features=0.8, min_samples_leaf=2,
                n_jobs=-1, random_state=SEED,
            ),
        ),
        "hist_gradient_boosting": make_pipeline(
            SimpleImputer(strategy="median"),
            HistGradientBoostingRegressor(
                max_iter=200, max_leaf_nodes=15, l2_regularization=1.0,
                early_stopping=True, random_state=SEED,
            ),
        ),
    }

    n_splits = min(5, len(np.unique(groups_train)))
    cv = GroupKFold(n_splits=n_splits)
    cv_rows = []
    for name, estimator in estimators.items():
        scores = cross_validate(
            estimator, X_train, y_train, groups=groups_train, cv=cv,
            scoring={"mae": "neg_mean_absolute_error",
                     "rmse": "neg_root_mean_squared_error", "r2": "r2"},
            n_jobs=1, error_score="raise",
        )
        cv_rows.append({
            "model": name,
            "cv_mae_mean": float(-scores["test_mae"].mean()),
            "cv_mae_std": float(scores["test_mae"].std()),
            "cv_rmse_mean": float(-scores["test_rmse"].mean()),
            "cv_r2_mean": float(scores["test_r2"].mean()),
        })

    cv_results = pd.DataFrame(cv_rows).sort_values("cv_mae_mean")
    cv_results.to_csv(RESULTS_DIR / "cross_validation_metrics.csv", index=False)
    candidates = cv_results[cv_results["model"] != "mean_baseline"]
    best_name = str(candidates.iloc[0]["model"])

    holdout_rows = []
    for name, estimator in estimators.items():
        estimator.fit(X_train, y_train)
        predictions = estimator.predict(X_test)
        holdout_rows.append(metric_row(name, y_test, predictions))
        if name == best_name:
            best_model = estimator
            best_predictions = predictions

    holdout_results = pd.DataFrame(holdout_rows).sort_values("mae_g_cm3")
    holdout_results.to_csv(RESULTS_DIR / "holdout_metrics.csv", index=False)

    error_table = clean.iloc[test_idx][["material_id", "formula_pretty", TARGET, "nelements"]].copy()
    error_table = error_table.rename(columns={TARGET: "actual_g_cm3"})
    error_table["predicted_g_cm3"] = best_predictions
    error_table["residual_g_cm3"] = error_table["actual_g_cm3"] - error_table["predicted_g_cm3"]
    error_table["absolute_error_g_cm3"] = error_table["residual_g_cm3"].abs()
    error_table.sort_values("absolute_error_g_cm3", ascending=False).to_csv(
        RESULTS_DIR / "holdout_predictions_and_errors.csv", index=False
    )

    model_path = MODEL_DIR / "density.joblib"
    joblib.dump(best_model, model_path)
    sample_metadata = json.loads(SAMPLE_METADATA.read_text(encoding="utf-8"))
    metadata = {
        "materials_project_database_version": sample_metadata["database_version"],
        "sample_random_seed": sample_metadata["random_seed"],
        "target": TARGET,
        "target_unit": "g/cm^3",
        "model_scope": "unconditional regressor over the full sample (metals and non-metals).",
        "best_model_by_group_cv_mae": best_name,
        "random_seed": SEED,
        "group_key": "reduced_formula",
        "split": "GroupShuffleSplit, 80/20, groups are reduced formulas",
        "cv": f"{n_splits}-fold GroupKFold on training partition",
        "feature_count": int(features.shape[1]),
        "feature_source": "formula only; no target-derived properties",
        "rows_in_input": int(initial_rows),
        "rows_used": int(len(clean)),
        "train_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "train_groups": int(pd.Series(groups_train).nunique()),
        "test_groups": int(pd.Series(groups[test_idx]).nunique()),
        "target_stats_g_cm3": {
            "min": float(target_stats["min"]),
            "p25": float(target_stats["25%"]),
            "median": float(target_stats["50%"]),
            "p75": float(target_stats["75%"]),
            "max": float(target_stats["max"]),
        },
        "python_version": platform.python_version(),
        "pandas_version": pd.__version__,
        "numpy_version": np.__version__,
        "scikit_learn_version": sklearn.__version__,
    }
    (RESULTS_DIR / "feature_columns.json").write_text(json.dumps(list(features.columns), indent=2), encoding="utf-8")
    with (RESULTS_DIR / "experiment_metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)

    print("Rows input / used:", initial_rows, "/", len(clean))
    print("Train / test rows:", len(train_idx), "/", len(test_idx))
    print("\nGroup cross-validation (training partition):")
    print(cv_results.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print("\nHoldout metrics:")
    print(holdout_results.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print("\nSelected model:", best_name, "| saved to", model_path)
    print("Largest holdout errors:")
    print(error_table.nlargest(5, "absolute_error_g_cm3")[
        ["material_id", "formula_pretty", "actual_g_cm3", "predicted_g_cm3", "absolute_error_g_cm3"]
    ].to_string(index=False, float_format=lambda v: f"{v:.3f}"))


if __name__ == "__main__":
    main()
