"""Train and evaluate composition-only metal/non-metal classifiers (V1).

Label source: Materials Project summary field ``band_gap`` — metal when
``band_gap == 0``, non-metal when ``band_gap > 0``. In the 10,000-record sample
this agrees with the MP ``is_metal`` flag at 99.93%; the 7 disagreements are
tiny-gap pseudo-metals (band_gap on the order of 1e-6–1e-3 eV).

No band_gap or target-derived value is used as an input feature: inputs come
from ``composition_features`` (formula only), identical to Phase 2 regression.
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
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_CSV = PROJECT_ROOT / "data" / "raw" / "materials_sample.csv"
SAMPLE_METADATA = PROJECT_ROOT / "data" / "raw" / "materials_sample_metadata.json"
RESULTS_DIR = PROJECT_ROOT / "experiments" / "metal_classification"
MODEL_DIR = PROJECT_ROOT / "models"
MODEL_PATH = MODEL_DIR / "metal_classifier.joblib"
# Label from band_gap only; MP is_metal is kept separately as a consistency check.
LABEL_COLUMN = "label_is_metal"
SEED = 42

sys.path.insert(0, str(PROJECT_ROOT))
from src.features.composition_features import composition_features, reduced_formula


def metric_row(
    name: str,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    tn: int,
    fp: int,
    fn: int,
    tp: int,
) -> dict[str, float | int | str]:
    return {
        "model": name,
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_metal": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall_metal": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_metal": float(f1_score(y_true, y_pred, zero_division=0)),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(INPUT_CSV)
    initial_rows = len(raw)
    clean = raw.drop_duplicates(subset="material_id", keep="first").copy()
    clean = clean.dropna(subset=["formula_pretty", "band_gap"]).copy()
    clean["band_gap"] = pd.to_numeric(clean["band_gap"], errors="coerce")
    clean = clean[np.isfinite(clean["band_gap"])].copy()
    clean["composition_group"] = clean["formula_pretty"].map(reduced_formula)

    # Label from band_gap only; is_metal from MP is kept solely as a consistency note.
    clean[LABEL_COLUMN] = clean["band_gap"].eq(0)
    mp_is_metal = clean["is_metal"].astype(str).str.strip().str.lower().map({"true": True, "false": False})
    label_agreement = float((clean[LABEL_COLUMN] == mp_is_metal).mean())

    feature_records = [composition_features(formula) for formula in clean["formula_pretty"]]
    features = pd.DataFrame(feature_records, index=clean.index)
    features = features.replace([np.inf, -np.inf], np.nan)

    assert not {"band_gap", "is_metal", "density", "energy_above_hull"}.intersection(features.columns), \
        "leakage: target-related column present in feature matrix"

    y = clean[LABEL_COLUMN].to_numpy(dtype=bool)
    groups = clean["composition_group"].to_numpy()
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=SEED)
    train_idx, test_idx = next(splitter.split(features, y, groups=groups))
    partitions = np.full(len(clean), "test", dtype=object)
    partitions[train_idx] = "train"
    pd.DataFrame({
        "material_id": clean["material_id"],
        "reduced_formula": clean["composition_group"],
        "partition": partitions,
    }).to_csv(RESULTS_DIR / "split_assignments.csv", index=False)

    X_train, X_test = features.iloc[train_idx], features.iloc[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    groups_train = groups[train_idx]

    estimators = {
        "most_frequent_baseline": make_pipeline(
            SimpleImputer(strategy="median"), DummyClassifier(strategy="most_frequent")
        ),
        "logistic_regression": make_pipeline(
            SimpleImputer(strategy="median"), StandardScaler(),
            LogisticRegression(max_iter=2000, random_state=SEED),
        ),
        "random_forest": make_pipeline(
            SimpleImputer(strategy="median"),
            RandomForestClassifier(
                n_estimators=250, max_features=0.5, min_samples_leaf=2,
                n_jobs=-1, random_state=SEED,
            ),
        ),
        "hist_gradient_boosting": make_pipeline(
            SimpleImputer(strategy="median"),
            HistGradientBoostingClassifier(
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
            scoring={"acc": "accuracy", "prec": "precision", "rec": "recall", "f1": "f1"},
            n_jobs=1, error_score="raise",
        )
        cv_rows.append({
            "model": name,
            "cv_accuracy_mean": float(scores["test_acc"].mean()),
            "cv_precision_mean": float(scores["test_prec"].mean()),
            "cv_recall_mean": float(scores["test_rec"].mean()),
            "cv_f1_mean": float(scores["test_f1"].mean()),
        })

    cv_results = pd.DataFrame(cv_rows).sort_values("cv_f1_mean", ascending=False)
    cv_results.to_csv(RESULTS_DIR / "cross_validation_metrics.csv", index=False)
    candidates = cv_results[cv_results["model"] != "most_frequent_baseline"]
    best_name = str(candidates.iloc[0]["model"])

    holdout_rows = []
    for name, estimator in estimators.items():
        estimator.fit(X_train, y_train)
        predictions = estimator.predict(X_test)
        tn, fp, fn, tp = confusion_matrix(y_test, predictions, labels=[False, True]).ravel()
        holdout_rows.append(metric_row(name, y_test, predictions, tn, fp, fn, tp))
        if name == best_name:
            best_model = estimator
            best_predictions = predictions
            best_proba = estimator.predict_proba(X_test)[:, 1] \
                if hasattr(estimator, "predict_proba") else None

    holdout_results = pd.DataFrame(holdout_rows).sort_values("f1_metal", ascending=False)
    holdout_results.to_csv(RESULTS_DIR / "holdout_metrics.csv", index=False)

    labels = np.array(["non_metal", "metal"], dtype=object)
    cm = confusion_matrix(y_test, best_predictions, labels=[False, True])
    pd.DataFrame(cm, index=[f"true_{label}" for label in labels],
                 columns=[f"pred_{label}" for label in labels]).to_csv(
        RESULTS_DIR / "confusion_matrix.csv")

    detail = clean.iloc[test_idx][["material_id", "formula_pretty", "band_gap"]].copy()
    detail["actual_class"] = np.where(y_test, "metal", "non_metal")
    detail["predicted_class"] = np.where(best_predictions, "metal", "non_metal")
    if best_proba is not None:
        detail["predicted_metal_probability"] = best_proba.round(4)
    detail.sort_values("predicted_metal_probability" if best_proba is not None else "band_gap") \
        .to_csv(RESULTS_DIR / "holdout_predictions.csv", index=False)

    model_path = MODEL_DIR / "metal_classifier.joblib"
    joblib.dump(best_model, model_path)
    sample_metadata = json.loads(SAMPLE_METADATA.read_text(encoding="utf-8"))
    best_holdout = holdout_results[holdout_results["model"] == best_name].iloc[0]
    metadata = {
        "materials_project_database_version": sample_metadata["database_version"],
        "sample_random_seed": sample_metadata["random_seed"],
        "task": f"binary classification: is_metal (metal vs non-metal)",
        "label_construction": "is_metal = (band_gap == 0); MP is_metal kept only as a consistency check",
        "label_vs_mp_is_metal_agreement": label_agreement,
        "random_seed": SEED,
        "group_key": "reduced_formula",
        "split": "GroupShuffleSplit, 80/20, groups are reduced formulas",
        "cv": f"{n_splits}-fold GroupKFold on training partition",
        "selection_metric": "mean grouped-CV F1 (metal = positive class)",
        "feature_count": int(features.shape[1]),
        "feature_source": "formula only; band_gap never an input feature",
        "feature_columns_file": "feature_columns.json",
        "rows_in_input": int(initial_rows),
        "rows_used": int(len(clean)),
        "metal_rows": int(y.sum()),
        "non_metal_rows": int((~y).sum()),
        "train_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "train_groups": int(pd.Series(groups_train).nunique()),
        "test_groups": int(pd.Series(groups[test_idx]).nunique()),
        "best_model_by_cv_f1": best_name,
        "holdout_accuracy": float(best_holdout["accuracy"]),
        "holdout_f1_metal": float(best_holdout["f1_metal"]),
        "python_version": platform.python_version(),
        "pandas_version": pd.__version__,
        "numpy_version": np.__version__,
        "scikit_learn_version": sklearn.__version__,
    }
    (RESULTS_DIR / "feature_columns.json").write_text(json.dumps(list(features.columns), indent=2), encoding="utf-8")
    with (RESULTS_DIR / "experiment_metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)

    print("Rows input / used:", initial_rows, "/", len(clean))
    print("Class balance: metal", int(y.sum()), "| non-metal", int((~y).sum()))
    print("Label vs MP is_metal agreement:", f"{label_agreement:.4f}")
    print("Train / test rows:", len(train_idx), "/", len(test_idx))
    print("\nGrouped CV (train partition):")
    print(cv_results.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print("\nHoldout metrics:")
    print(holdout_results.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
    print("\nSelected model:", best_name)
    print("Holdout confusion matrix (rows=true, cols=pred):\n", pd.DataFrame(
        cm, index=["true_non_metal", "true_metal"], columns=["pred_non_metal", "pred_metal"]).to_string())
    print("Saved model:", model_path)


if __name__ == "__main__":
    main()
