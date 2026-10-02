# MaterialMind Phase 4: Clustering and Material Landscape

**Status:** Initial unsupervised clustering workflow complete  
**Corpus:** 10,000 sampled Materials Project summary records  
**Database release:** `2026.04.13`

## What this phase does

The workflow represents each material using composition descriptors plus four available properties: band gap, density, formation energy per atom, and energy above hull. It imputes missing feature values with each feature's median, standardizes the features, and uses PCA to create a lower-dimensional space for clustering. The 2D PCA projection is used only to visualize the landscape; the selected K-Means model is fit in the PCA space retaining 95% of variance.

Composition features include elemental fractions and composition-level statistics. The four property features make this a combined composition-and-property landscape, rather than a composition-only grouping.

## Results on this sample

- All 10,000 rows received a K-Means cluster assignment; no material IDs or labels were missing.
- The composition and property matrix contains 157 features. PCA retains 95% of its variance in 86 components.
- The first two displayed PCA axes explain 12.3% and 6.9% of variance, respectively (19.2% combined). The plot is therefore a useful overview, not a complete view of high-dimensional distances.
- K-Means was compared for `k=2` through `k=8`, using a fixed random seed and a 1,500-row silhouette sample. `k=2` had the highest sampled silhouette (0.2210), so it was selected for this baseline.

| Cluster | Materials | Median band gap (eV) | Median density (g/cm³) | Median formation energy (eV/atom) | Median energy above hull (eV/atom) | Metal fraction |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 6,389 | 0.735 | 3.947 | -1.973 | 0.094 | 0.297 |
| 1 | 3,611 | 0.000 | 7.158 | -0.320 | 0.017 | 0.885 |

Cluster 0 is more insulating on this sample and has a lower median density; Cluster 1 is predominantly metallic and denser. These are post-hoc summaries of groups formed from all input features, not definitions or guarantees about individual materials. In particular, the feature set and sample construction influence the split.

## Density-based exploration

DBSCAN was also explored on the first 10 PCA components, with `min_samples=10`. The tested neighborhood scales produced 4–19 non-noise clusters and 3.65%–17.33% noise. At the largest tested scale, it produced 4 clusters, 3.65% noise, and a sampled non-noise silhouette of 0.2271. This is exploratory: its silhouette is calculated only for non-noise points and cannot be compared directly to K-Means' all-point silhouette as if the evaluations were identical.

## Artifacts

Run from the project root:

```powershell
.\.venv\Scripts\python.exe src\clustering\cluster_materials.py
```

Generated files are in `experiments/clustering/`:

- `cluster_assignments.csv` — one K-Means label and 2D PCA coordinates per material.
- `cluster_summary.csv` — cluster sizes, common elements, and property summaries.
- `kmeans_k_selection.csv` — inertia and sampled silhouette for each tested `k`.
- `dbscan_experiment.csv` — tested DBSCAN scales, cluster/noise counts, and sampled silhouette.
- `material_landscape_clusters.png` and `material_landscape_band_gap.png` — 2D PCA plots.
- `pca_landscape_variance.csv` — variance explained by the displayed axes.
- `clustering_metadata.json` — dataset version, configuration, and selected score.
- `clustering_pipeline.joblib` — fitted preprocessing, PCA, and K-Means objects.

## Limitations and next improvements

This is an exploratory map, not a validated scientific taxonomy or a prediction model; clustering has no classification “accuracy” because the data has no ground-truth cluster labels. A silhouette of 0.221 indicates only modest separation. The 10,000-record sample is not the full Materials Project corpus. Median imputation, feature scaling, selected descriptors, and PCA all affect the geometry. Before using group membership to guide scientific decisions, compare alternate feature sets and sampling strategies, inspect representative materials and outliers, and evaluate stability across resamples. Preserve data provenance when regenerating the corpus.
