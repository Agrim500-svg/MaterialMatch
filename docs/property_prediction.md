# MaterialMind Prediction Models: V1 Four-Output Layer

**Status:** V1 four-target layer implemented and tested
**User-facing outputs:** Material Type (Metal/Non-Metal), Band Gap (eV), Formation Energy (eV/atom), Density (g/cm³)
**Materials Project release:** `2026.04.13`
**Training data:** reproducible 10,000-record active summary sample from `data/raw/materials_sample.csv`

## V1 architecture

```
Material formula
   -> 153 composition descriptors (src/features/composition_features.py)
      -> metal/non-metal classifier (models/metal_classifier.joblib)
            Metal  -> band_gap = 0 eV (classifier_only)
            Non-Metal -> conditional non-metal band-gap regressor (models/band_gap_nonmetal.joblib)
      -> formation energy regressor (models/formation_energy_per_atom.joblib)
      -> density regressor (models/density.joblib)
```

All four models consume the same feature matrix; band_gap, is_metal, and density
are never input features (assertion-checked in every training script).

## Model 1: Metal/Non-Metal classifier

- **Label:** `is_metal = (band_gap == 0)`; agrees with MP `is_metal` at 99.93%
  (7 tiny-gap pseudo-metals, band_gap ~1e-6 eV differ). Label is constructed
  from band_gap only; band_gap is never an input feature.
- **Class balance:** 5,084 metals / 4,916 non-metals in the sample.
- **Model:** Random Forest (250 trees), selected by 5-fold GroupKFold mean F1
  on the training partition.
- **Split:** GroupShuffleSplit 80/20, reduced-formula groups, seed 42
  (8,011 train / 1,989 test).

| Metric | Holdout |
|---|---:|
| Accuracy | 0.8200 |
| Precision (metal) | 0.8632 |
| Recall (metal) | 0.7720 |
| F1 (metal) | 0.8151 |
| Confusion matrix (holdout) | TN=842, FP=125, FN=233, TP=789 |

Classification probability is a **model self-confidence estimate**, not accuracy.

## Model 2: Conditional non-metal band-gap regression

- **Scope:** only the 4,916 records with band_gap > 0 (3,933 train / 983 test).
- **Model:** HistGradientBoosting, selected by 5-fold GroupKFold mean MAE.
- **Target distribution (eV):** median 1.449, p25 0.538, p75 2.802, max 8.758.

| Model | Holdout MAE (eV) | RMSE (eV) | R² |
|---|---:|---:|---:|
| HistGradientBoosting (selected) | 0.786 | 1.060 | 0.531 |
| Random Forest | 0.787 | 1.076 | 0.517 |
| Ridge | 0.943 | 1.203 | 0.396 |
| Mean baseline | 1.292 | 1.548 | ~0.00 |

"Weak spot": near-degenerate non-metals (tiny true gaps predicted as wide-gap).
Full residuals in `experiments/band_gap_regression/holdout_predictions_and_errors.csv`.

## Model 3: Density regression

- **Scope:** unconditional; all 10,000 rows (8,011 train / 1,989 test).
- **Model:** HistGradientBoosting, selected by 5-fold GroupKFold mean MAE.

| Model | Holdout MAE (g/cm³) | RMSE (g/cm³) | R² |
|---|---:|---:|---:|
| HistGradientBoosting (selected) | 0.381 | 0.582 | 0.962 |
| Random Forest | 0.368 | 0.586 | 0.961 |
| Ridge | 0.460 | 0.667 | 0.949 |
| Mean baseline | 2.303 | 2.964 | ~0.00 |

Largest errors on unusually dense actinides (elemental Pu; see
`experiments/density_regression/holdout_predictions_and_errors.csv`).

## Reproduction

```powershell
.\.venv\Scripts\python.exe -m src.models.train_metal_classifier
.\.venv\Scripts\python.exe -m src.models.train_band_gap_regression
.\.venv\Scripts\python.exe -m src.models.train_density_regression
```

## Limitations (whole V1 layer)

1. 10,000-record sample, not the full Materials Project corpus.
2. Composition-only features cannot distinguish polymorphs or encode structure.
3. The band-gap classifier boundary inherits 7 noisy tiny-gap labels.
4. Band-gap magnitude is the weakest model (holdout R² = 0.531) — screening-grade only.
5. No output is an experimental measurement or a DFT result; all are ML estimates.

The remainder of this page documents the original Phase 2 formation-energy experiment.

---

# Phase 2 original record: Formation-Energy Prediction

**Status:** Initial supervised-learning experiment complete  
**Target:** `formation_energy_per_atom` (eV/atom)  
**Materials Project release:** `2026.04.13`  
**Training data:** reproducible 10,000-record active summary sample from `data/raw/materials_sample.csv`

## Question

Can composition-only information predict Materials Project formation energy per atom well enough to support an initial screening workflow?

## Data preparation

The run started with 10,000 summary records. It removed duplicate material IDs (none in this sample), rows without a formula or target, and non-finite target values. All 10,000 rows remained. No target imputation, property-based filtering, or outlier removal was applied. Repeated formulas were retained because different structures with the same composition can have different formation energies.

The target is the Materials Project summary property `formation_energy_per_atom`, in eV/atom. The input descriptors were calculated from `formula_pretty` only:

- 118 elemental fraction features
- 5 stoichiometric features: number of elements, minimum and maximum fraction, sum of squared fractions, and composition entropy
- 30 weighted elemental-property statistics: mean, standard deviation, minimum, maximum, and range for atomic number (`Z`), atomic mass, Pauling electronegativity, atomic radius, periodic-table row, and group

Some elemental properties are not tabulated for every element. Missing descriptor values are median-imputed inside each model pipeline. The imputer is fit separately within each CV fold, preventing validation data from influencing preprocessing. In particular, the target, `energy_above_hull`, density, and band gap are not model inputs.

## Split and evaluation

Records sharing a reduced formula were kept in the same partition. This avoids training on one structure and testing on another structure with the same composition.

- Holdout: `GroupShuffleSplit`, 80/20, seed 42
- Training partition: 8,011 rows and 6,490 composition groups
- Holdout partition: 1,989 rows and 1,623 composition groups
- Model selection: five-fold `GroupKFold` on the training partition
- Metrics: MAE, RMSE (eV/atom), and R²

### Grouped cross-validation results

| Model | Mean MAE | MAE SD | Mean RMSE | Mean R² |
|---|---:|---:|---:|---:|
| HistGradientBoosting | 0.1801 | 0.0068 | 0.2984 | 0.9229 |
| Random Forest | 0.1848 | 0.0087 | 0.3216 | 0.9104 |
| Ridge | 0.2866 | 0.0035 | 0.4139 | 0.8522 |
| Mean baseline | 0.9353 | 0.0113 | 1.0776 | -0.0003 |

### Holdout results

| Model | MAE (eV/atom) | RMSE (eV/atom) | R² |
|---|---:|---:|---:|
| HistGradientBoosting (selected by CV) | 0.1810 | 0.2970 | 0.9238 |
| Random Forest | 0.1780 | 0.3077 | 0.9182 |
| Ridge | 0.2993 | 0.4289 | 0.8411 |
| Mean baseline | 0.9169 | 1.0760 | -0.0002 |

The model selected by cross-validation has a holdout MAE of 0.1810 eV/atom. Random Forest has a slightly lower holdout MAE by 0.0030 eV/atom, while HistGradientBoosting has lower RMSE and won on mean grouped-CV MAE. The results are close, so this is an initial model choice rather than evidence that it is universally superior.

## Error analysis

The holdout error distribution has a longer tail than the MAE alone shows: the selected model's RMSE is 0.2970 eV/atom, and the largest absolute errors range from about 1.4 to 3.5 eV/atom. Several difficult examples have unusually positive formation energies or complex chemistries. Composition-only features do not encode crystal structure, coordination, or polymorph differences, so these cases are expected limitations of this representation. See `experiments/property_prediction/holdout_predictions_and_errors.csv` for every holdout prediction sorted by absolute error.

## Saved artifacts

- `src/features/composition_features.py`: formula parsing and 153 composition descriptors
- `src/models/train_property_prediction.py`: cleaning, group split, CV, evaluation, error analysis, and model serialization
- `src/models/predict_property.py`: reusable inference function; labels outputs as MaterialMind ML estimates
- `data/processed/formation_energy_dataset.csv`: identifiers, reduced-formula groups, target, and feature matrix
- `experiments/property_prediction/cross_validation_metrics.csv`: grouped CV metrics
- `experiments/property_prediction/holdout_metrics.csv`: holdout metrics for all four models
- `experiments/property_prediction/holdout_predictions_and_errors.csv`: test predictions and residuals
- `experiments/property_prediction/split_assignments.csv`: fixed train/test assignment by record
- `experiments/property_prediction/experiment_metadata.json`: split, feature, target, and software metadata
- `experiments/property_prediction/feature_columns.json`: ordered input-feature names
- `models/formation_energy_per_atom.joblib`: selected fitted pipeline

Example inference, run from the project root:

```powershell
.\.venv\Scripts\python.exe src\models\predict_property.py
```

The example formulas print ML-estimated formation energies. They are not experimental measurements or database values.

## Limitations and next steps

1. The experiment uses a 10,000-record sample, not all 154,377 active summary records.
2. The random pages are spread across the collection but still form a page-based sample.
3. The model has no uncertainty estimate and should not be treated as a scientific measurement.
4. Formula-only descriptors cannot distinguish polymorphs with identical composition.
5. The sample and labels are Materials Project computational data, not a curated set of experimental measurements.
6. Before promoting this as a discovery capability, validate on a larger data snapshot and consider a composition- or time-based external split. Then compare structure-aware features and quantify uncertainty.

Reproduce the experiment using the recorded environment and sample metadata. The sample release, seed, and selected pages are in `data/raw/materials_sample_metadata.json`.
