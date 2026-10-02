# MaterialMind Phase 1: Dataset Analysis

**Retrieved:** 2026-10-02  
**Source:** Materials Project summary endpoint using the official `mp-api` Python client  
**Database release:** `2026.04.13`  
**Active summary records at retrieval:** 154,377  
**Exploratory sample:** 10,000 records; random seed 42

## Method

The exploration script counts non-deprecated summary records, then requests ten 1,000-record pages chosen reproducibly across the active collection. It requests only identifiers, basic composition/structure descriptors, and four candidate numeric properties. The resulting sample is saved to `data/raw/materials_sample.csv`.

The sample is spread across the paginated collection, but it is a page sample rather than a uniform independent draw of 10,000 individual records. Treat the statistics as exploratory. The API snapshot can change; rerun the script to record a new database release, record count, and sample.

## Data quality and coverage

- 10,000 rows retrieved; no duplicate `material_id` values.
- 1,887 repeated `formula_pretty` values. These are repeated formulas, not duplicate material IDs; different structures/polymorphs can share a formula.
- All four candidate properties are populated for all 10,000 rows.
- Active collection count was 154,377 at retrieval. The unfiltered endpoint count was 163,211 and includes deprecated records, so analyses should filter `deprecated=False`.
- Formula element counts range from 1 to 8. The sample is mostly ternary and quaternary records: 4,400 have 3 elements and 3,103 have 4.

## Candidate property summaries

| Property | Mean | Median | 10th percentile | 90th percentile | Sample observation |
|---|---:|---:|---:|---:|---|
| Density (g/cm³) | 5.255 | 4.418 | 2.329 | 9.271 | Broad continuous range; no missing values |
| Band gap (eV) | 0.910 | 0.000 | 0.000 | 3.141 | 5,084 values are exactly zero; a mixed metal/semiconductor distribution |
| Formation energy (eV/atom) | -1.309 | -1.299 | -2.701 | 0.014 | 9,999 distinct values; no missing values |
| Energy above hull (eV/atom) | 0.152 | 0.066 | 0.000 | 0.365 | 8,025 distinct values; strongly concentrated near zero with a long upper tail |

`is_metal` is true for 5,091 records and false for 4,909. This is consistent with the mixed distribution of the band-gap field. Band-gap prediction should account for the large zero-value group and may need a two-stage metal/positive-gap approach or a semiconductor-only scope.

Pearson correlations in this sample:

| | Density | Band gap | Formation energy | Energy above hull |
|---|---:|---:|---:|---:|
| Density | 1.000 | -0.358 | 0.242 | -0.139 |
| Band gap | -0.358 | 1.000 | -0.425 | -0.149 |
| Formation energy | 0.242 | -0.425 | 1.000 | 0.293 |
| Energy above hull | -0.139 | -0.149 | 0.293 | 1.000 |

These are descriptive correlations only; they do not show causal relationships or establish model predictability.

## Initial target recommendation

**Recommend `formation_energy_per_atom` as the first property-prediction target for Phase 2**, subject to checking the selected feature representation and a baseline evaluation.

Reasons:

1. It is present for all sampled records and has 9,999 distinct values in 10,000 rows, so the initial regression task will not be dominated by missing labels or a large point mass at a single value.
2. It is scientifically relevant to material stability and aligns with the discovery platform’s screening goals.
3. Composition-based descriptors are a natural input representation for an initial interpretable baseline.

Important modeling constraint: do not use `energy_above_hull`, `formation_energy_per_atom`, or other target-derived energy values as input features when predicting formation energy. Begin with composition-only features (for example, stoichiometric and elemental statistics) to avoid target leakage. Evaluate the recommendation in Phase 2 against a simple baseline and inspect errors across material classes.

Band gap remains a strong later candidate, especially for semiconductor-focused searches, but its 50.84% exact-zero share in this sample makes a single regression formulation less straightforward. Density is also a viable alternative and can be revisited if lightweight materials become the initial application focus.

## Reproducibility

- Script: `explore_dataset.py`
- Raw sample: `data/raw/materials_sample.csv`
- Random seed: `42`
- Page size: `1,000`
- Selected page indices: `6, 22, 26, 28, 35, 57, 62, 70, 139, 151`
- Database version: `2026.04.13`
- Environment package versions should be captured before model training.
