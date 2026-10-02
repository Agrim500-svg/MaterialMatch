"""Run PCA landscape and K-Means/DBSCAN clustering on the exploration sample."""

from __future__ import annotations

import ast
import json
import platform
import sys
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from dotenv import load_dotenv
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.metrics import silhouette_score
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_CSV = PROJECT_ROOT / "data" / "raw" / "materials_sample.csv"
SAMPLE_METADATA = PROJECT_ROOT / "data" / "raw" / "materials_sample_metadata.json"
RESULTS_DIR = PROJECT_ROOT / "experiments" / "clustering"
PROPERTY_COLUMNS = ["band_gap", "density", "formation_energy_per_atom", "energy_above_hull"]
SEED = 42
SILHOUETTE_SIZE = 1_500

sys.path.insert(0, str(PROJECT_ROOT))
from src.features.composition_features import composition_features


def top_elements(series: pd.Series, limit: int = 5) -> str:
    counts: dict[str, int] = {}
    for value in series.dropna():
        try:
            symbols = ast.literal_eval(value) if isinstance(value, str) else value
        except (ValueError, SyntaxError):
            symbols = []
        for symbol in symbols:
            counts[str(symbol)] = counts.get(str(symbol), 0) + 1
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]
    return ", ".join(f"{symbol} ({count})" for symbol, count in ordered)


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    raw = pd.read_csv(INPUT_CSV)
    clean = raw.drop_duplicates(subset="material_id", keep="first").dropna(
        subset=["formula_pretty"]
    ).reset_index(drop=True)

    composition_records = [composition_features(formula) for formula in clean["formula_pretty"]]
    composition_frame = pd.DataFrame(composition_records)
    composition_columns = list(composition_frame.columns)
    property_frame = clean[PROPERTY_COLUMNS].apply(pd.to_numeric, errors="coerce")
    feature_frame = pd.concat([composition_frame, property_frame], axis=1)
    feature_frame = feature_frame.replace([np.inf, -np.inf], np.nan)

    imputer = SimpleImputer(strategy="median", keep_empty_features=True)
    imputed = imputer.fit_transform(feature_frame)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(imputed)

    landscape_pca = PCA(n_components=2, svd_solver="full")
    landscape_xy = landscape_pca.fit_transform(scaled)
    reduced_pca = PCA(n_components=0.95, svd_solver="full")
    reduced = reduced_pca.fit_transform(scaled)

    sample_rng = np.random.default_rng(SEED)
    silhouette_indices = np.sort(
        sample_rng.choice(len(clean), size=min(SILHOUETTE_SIZE, len(clean)), replace=False)
    )
    k_rows = []
    fitted_models: dict[int, KMeans] = {}
    for k in range(2, 9):
        model = KMeans(n_clusters=k, n_init=10, random_state=SEED)
        labels = model.fit_predict(reduced)
        sampled_silhouette = silhouette_score(
            reduced[silhouette_indices], labels[silhouette_indices], metric="euclidean"
        )
        k_rows.append({
            "k": k,
            "inertia": float(model.inertia_),
            "silhouette_sample": float(sampled_silhouette),
        })
        fitted_models[k] = model

    k_metrics = pd.DataFrame(k_rows)
    k_metrics.to_csv(RESULTS_DIR / "kmeans_k_selection.csv", index=False)
    best_k = int(k_metrics.sort_values("silhouette_sample", ascending=False).iloc[0]["k"])
    best_model = fitted_models[best_k]
    labels = best_model.labels_

    cluster_summary = clean[[
        "material_id", "formula_pretty", "elements", *PROPERTY_COLUMNS,
    ]].copy()
    cluster_summary["cluster"] = labels
    cluster_summary["pca_1"] = landscape_xy[:, 0]
    cluster_summary["pca_2"] = landscape_xy[:, 1]
    cluster_summary.to_csv(RESULTS_DIR / "cluster_assignments.csv", index=False)

    summaries = []
    for cluster_id, group in cluster_summary.groupby("cluster", sort=True):
        item: dict[str, object] = {
            "cluster": int(cluster_id),
            "materials": int(len(group)),
            "top_elements": top_elements(group["elements"]),
        }
        for field in PROPERTY_COLUMNS:
            item[f"median_{field}"] = float(pd.to_numeric(group[field], errors="coerce").median())
        item["metal_fraction"] = float(clean.loc[group.index, "is_metal"].eq(True).mean()) if "is_metal" in clean else np.nan
        item["mean_element_count"] = float(clean.loc[group.index, "nelements"].mean()) if "nelements" in clean else np.nan
        summaries.append(item)
    summaries_df = pd.DataFrame(summaries)
    summaries_df.to_csv(RESULTS_DIR / "cluster_summary.csv", index=False)

    pca_metrics = pd.DataFrame({
        "component": ["PC1", "PC2"],
        "explained_variance_ratio": landscape_pca.explained_variance_ratio_,
    })
    pca_metrics.to_csv(RESULTS_DIR / "pca_landscape_variance.csv", index=False)

    fig, ax = plt.subplots(figsize=(11, 8), constrained_layout=True)
    scatter = ax.scatter(
        landscape_xy[:, 0], landscape_xy[:, 1], c=labels,
        cmap="tab10", s=9, alpha=0.62, linewidths=0, rasterized=True,
    )
    legend = ax.legend(*scatter.legend_elements(), title=f"K-Means cluster (k={best_k})", loc="best")
    ax.add_artist(legend)
    ax.set_xlabel(f"PC1 ({landscape_pca.explained_variance_ratio_[0] * 100:.1f}% variance)")
    ax.set_ylabel(f"PC2 ({landscape_pca.explained_variance_ratio_[1] * 100:.1f}% variance)")
    ax.set_title("Material landscape: composition + Materials Project properties")
    fig.savefig(RESULTS_DIR / "material_landscape_clusters.png", dpi=180)
    plt.close(fig)

    band_gap = pd.to_numeric(clean["band_gap"], errors="coerce").to_numpy()
    fig, ax = plt.subplots(figsize=(11, 8), constrained_layout=True)
    points = ax.scatter(
        landscape_xy[:, 0], landscape_xy[:, 1], c=band_gap,
        cmap="viridis", s=9, alpha=0.68, linewidths=0, rasterized=True,
    )
    fig.colorbar(points, ax=ax, label="Materials Project band gap (eV)")
    ax.set_xlabel(f"PC1 ({landscape_pca.explained_variance_ratio_[0] * 100:.1f}% variance)")
    ax.set_ylabel(f"PC2 ({landscape_pca.explained_variance_ratio_[1] * 100:.1f}% variance)")
    ax.set_title("Material landscape colored by database band gap")
    fig.savefig(RESULTS_DIR / "material_landscape_band_gap.png", dpi=180)
    plt.close(fig)

    # Exploratory DBSCAN on standardized first ten PCA coordinates.
    density_pca = PCA(n_components=min(10, scaled.shape[1]), svd_solver="full")
    density_coordinates = StandardScaler().fit_transform(density_pca.fit_transform(scaled))
    neighbor_distances = NearestNeighbors(n_neighbors=11).fit(density_coordinates).kneighbors(
        density_coordinates
    )[0][:, -1]
    dbscan_rows = []
    for quantile in (0.70, 0.80, 0.90):
        eps = float(np.quantile(neighbor_distances, quantile))
        db_labels = DBSCAN(eps=eps, min_samples=10, n_jobs=-1).fit_predict(density_coordinates)
        non_noise = db_labels != -1
        n_clusters = len(set(db_labels[non_noise]))
        silhouette = np.nan
        if n_clusters >= 2 and non_noise.sum() > 20:
            valid_indices = silhouette_indices[non_noise[silhouette_indices]]
            if len(valid_indices) > 20 and len(set(db_labels[valid_indices])) >= 2:
                silhouette = float(silhouette_score(
                    density_coordinates[valid_indices], db_labels[valid_indices]
                ))
        dbscan_rows.append({
            "neighbor_distance_quantile": quantile,
            "eps": eps,
            "min_samples": 10,
            "clusters_excluding_noise": n_clusters,
            "noise_fraction": float((~non_noise).mean()),
            "silhouette_non_noise_sample": silhouette,
        })
    dbscan_metrics = pd.DataFrame(dbscan_rows)
    dbscan_metrics.to_csv(RESULTS_DIR / "dbscan_experiment.csv", index=False)

    metadata = {
        "source_csv": "data/raw/materials_sample.csv",
        "materials_project_database_version": json.loads(SAMPLE_METADATA.read_text(encoding="utf-8"))["database_version"],
        "rows_input": int(len(raw)),
        "rows_clustered": int(len(clean)),
        "feature_count": int(feature_frame.shape[1]),
        "composition_feature_count": int(len(composition_columns)),
        "property_features": PROPERTY_COLUMNS,
        "preprocessing": "median imputation then StandardScaler; fit to full unsupervised sample",
        "landscape": "2-component PCA on scaled combined feature matrix",
        "clustering_space": "PCA components retaining 95% of variance",
        "silhouette_sample_size": int(len(silhouette_indices)),
        "k_tested": list(range(2, 9)),
        "selected_k_by_sampled_silhouette": best_k,
        "selected_k_sampled_silhouette": float(k_metrics.loc[k_metrics["k"] == best_k, "silhouette_sample"].iloc[0]),
        "random_seed": SEED,
        "python_version": platform.python_version(),
        "numpy_version": np.__version__,
        "pandas_version": pd.__version__,
        "scikit_learn_version": sklearn.__version__,
    }
    (RESULTS_DIR / "clustering_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    joblib.dump({"imputer": imputer, "scaler": scaler, "landscape_pca": landscape_pca,
                 "reduced_pca": reduced_pca, "kmeans": best_model,
                 "feature_columns": list(feature_frame.columns)},
                RESULTS_DIR / "clustering_pipeline.joblib")

    print(f"Rows clustered: {len(clean)}; features: {feature_frame.shape[1]}")
    print(f"PC1/PC2 variance: {landscape_pca.explained_variance_ratio_[0]:.3f} / {landscape_pca.explained_variance_ratio_[1]:.3f}")
    print(f"95% variance retained in {reduced.shape[1]} PCA components")
    print("\nK-Means selection:")
    print(k_metrics.to_string(index=False, float_format=lambda value: f"{value:.4f}"))
    print(f"\nSelected k: {best_k}")
    print("\nCluster summaries:")
    print(summaries_df.to_string(index=False, float_format=lambda value: f"{value:.3f}"))
    print("\nDBSCAN exploration:")
    print(dbscan_metrics.to_string(index=False, float_format=lambda value: f"{value:.4f}"))
    print("\nSaved landscape plots and cluster assignments to", RESULTS_DIR)


if __name__ == "__main__":
    main()
