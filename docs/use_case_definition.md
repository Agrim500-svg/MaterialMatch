# Initial Discovery Use Case: Lightweight Stable Semiconductors

**Status:** Initial screening scope assessed; thresholds are prototype assumptions  
**Materials Project release:** `2026.04.13`  
**Retrieved:** 2026-10-02  
**Active summary records:** 154,377  
**Sample:** 10,000 records; seed `20261002`; ten pages selected across the active collection

## User goal

Find materials that are relatively lightweight, semiconductor-like, and stable according to Materials Project data. The initial screen uses database-derived values; it does not use the formation-energy prediction model.

## Operational filters used for this assessment

- **Semiconductor-like:** `0 < band_gap <= 3 eV` and `is_metal == False`. This is a practical proxy for the first assessment, not a universal definition. Wider-gap insulators and unusual cases may need separate handling.
- **Lightweight:** density at or below the 25th percentile of the semiconductor-like subset. This makes "lightweight" relative to this sample, not an absolute engineering specification.
- **Stable:** Materials Project `is_stable == True`. `energy_above_hull` is retained as a displayed/ranking value. This avoids inventing a numerical stability cutoff at this stage.

These choices can be adjusted when a particular application specifies a density ceiling or acceptable band-gap range.

## Fresh-sample results

| Check | Result |
|---|---:|
| Records retrieved | 10,000 |
| Duplicate material IDs | 0 |
| Missing band gap | 2 |
| Missing density | 0 |
| Missing `is_metal` | 11 |
| Missing `is_stable` | 0 |
| Missing energy above hull | 1 |
| Band gap exactly zero | 5,750 |
| `is_metal == False` | 4,224 |
| Band gap in (0, 3] eV and non-metal | 3,314 |
| Density threshold (subset 25th percentile) | 3.005 g/cm³ |
| Semiconductor-like records below density threshold | 829 |
| Stable semiconductor-like records | 570 |
| Records meeting all three filters | 78 |

The three requested screening properties are available for nearly all of this sample: 99.98% for band gap, 100% for density, and 99.99% for energy above hull. `is_stable` and `is_metal` are also present for all but 0 and 11 records respectively.

The 78 matches are a candidate pool from a 10,000-record sample, not a claim that the full database contains only 78 matches. Material properties are Materials Project computational records; they should be shown as database-derived values, separate from any MaterialMind prediction.

## Initial examples

Among the lowest-density matches in this sample are CaAlH5, Ca(H2N)2, BS2, K2Na3SiP3, and P2S5. These are included as examples produced by the stated filters, not as experimentally validated recommendations.

## Recommendation

The first discovery workflow can begin with direct Materials Project filtering and transparent density-based ranking. No new model is required to support this initial query while the needed database values are available. The current formation-energy model can be displayed as a separately labelled supplementary prediction only after its use is scientifically appropriate.

Before productizing the filters, replace the relative density quartile with a user- or application-defined density ceiling, and confirm the desired band-gap interval. Next, proceed with Phase 3 similarity search using the same composition-based feature representation, then return to the phase plan for candidate ranking.

## Reproducibility and files

- `src/data/assess_discovery_use_case.py`: fetches a fresh sample, profiles data coverage, applies the filters, and writes candidate output
- `data/raw/lightweight_semiconductor_sample.csv`: raw sample with selected Materials Project fields
- `data/raw/lightweight_semiconductor_sample_metadata.json`: database version, seed, pages, requested fields, and screening assumptions
- `experiments/discovery_use_case/coverage_and_filter_summary.json`: coverage, distributions, and candidate funnel
- `experiments/discovery_use_case/property_coverage.csv`: property coverage table
- `experiments/discovery_use_case/top_lightweight_stable_semiconductors.csv`: sample matches ordered by the transparent screening fields
