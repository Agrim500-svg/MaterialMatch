# MaterialMind Phase 3: Similarity Search

**Status:** Initial similarity service and qualitative evaluation complete  
**Corpus:** 10,000 active Materials Project summary records in `data/raw/materials_sample.csv`  
**Database release:** `2026.04.13`

## Goal

Given a Materials Project material ID or chemical formula, return the nearest materials from the local summary corpus and explain the ranking. The initial implementation compares composition and selected database properties. It does not claim that a high score is a probability or proof of scientific equivalence.

## Representations and score definitions

Three profiles are available:

1. **Composition profile**
   - Element-fraction cosine similarity, from 0 to 1.
   - Similarity over 35 composition descriptors (stoichiometry and weighted elemental-property statistics): `1 / (1 + standardized Euclidean distance / sqrt(35))`.
   - Composition score is the mean of those two scores.

2. **Property profile**
   - Standardizes the database values for band gap, density, formation energy per atom, and energy above hull using the local corpus.
   - Property score is `1 / (1 + standardized Euclidean distance / sqrt(4))`.

3. **Combined profile** (default)
   - Equal weighted mean of composition score and property score when reference properties are available.
   - If the reference has no known property values, the score falls back to composition similarity.

Median imputation and scaling are fitted from the local corpus. Candidate records with the query's material ID are excluded. Formula input resolves to a stable local record with low energy above hull when available. If the requested reference is outside the local sample, the service queries Materials Project using the local API key. With no API key, an out-of-sample formula can still be searched composition-only.

The result includes component scores, shared elements, nearby database properties, the reference, the selected profile, and an explicit note: **relative similarity score; not a probability**.

## Qualitative evaluation: GaAs

The reference was stable Materials Project material `mp-2534` (formula GaAs): band gap 0.1839 eV, density 5.0532 g/cm³, energy above hull 0 eV/atom. The sample corpus did not contain GaAs, so the service resolved this reference through Materials Project and searched the saved 10,000-record corpus.

The combined profile ranked:

| Rank | Material | Score | Composition score | Property score | Shared elements |
|---:|---|---:|---:|---:|---|
| 1 | Zn3As2 | 0.749 | 0.631 | 0.867 | As |
| 2 | InAs | 0.741 | 0.580 | 0.903 | As |
| 3 | Ga31Mo6 | 0.698 | 0.656 | 0.739 | Ga |

Known III-V family analog checks found InAs at rank 2 and GaP at rank 26 for the combined profile. For composition-only, InAs ranked 15 and GaP 17. Property-only ranks InAs 42 and GaP 805, illustrating that property similarity can return chemically unrelated materials.

This is a useful qualitative check: the combined profile surfaces InAs near the top, and the separate profiles make the role of chemical composition versus property matching visible. It is not a formal scientific benchmark. The corpus is a 10,000-record sample, and the representation does not include crystal structure, bonding, or electronic-structure details.

## Run a search

From the MaterialMind project root in the active virtual environment:

```powershell
.\.venv\Scripts\python.exe src\similarity\search_similar.py mp-2534 --k 10 --profile combined
```

You can also use a formula:

```powershell
.\.venv\Scripts\python.exe src\similarity\search_similar.py GaAs --k 10 --profile combined
```

Choose `--profile composition` or `--profile properties` to inspect each view separately. The Python service can also be imported as `MaterialSimilarityIndex` from `src.similarity.material_similarity` and reused without rebuilding the index per query.

## Artifacts

- `src/similarity/material_similarity.py`: reusable index and `find_similar_materials` convenience function
- `src/similarity/search_similar.py`: command-line search
- `src/similarity/evaluate_similarity.py`: reproducible GaAs known-analog assessment
- `experiments/similarity/gaas_reference.json`: exact reference values
- `experiments/similarity/gaas_top20_composition.csv`: composition-profile ranking
- `experiments/similarity/gaas_top20_properties.csv`: property-profile ranking
- `experiments/similarity/gaas_top20_combined.csv`: combined ranking
- `experiments/similarity/gaas_known_analog_ranks.csv`: expected-analog rank checks

## Limitations and next steps

- The neighbor corpus is the 10,000-record Phase 1 sample, not all active Materials Project records.
- A material can have multiple structures; the query by formula selects one reference polymorph, while other polymorphs remain eligible neighbors.
- The current inputs omit crystal structures and local atomic environments. Structure-aware descriptors could improve scientific similarity later.
- Similarity scores depend on this corpus, selected properties, feature scaling, and equal weights; they should not be compared across different corpus versions as calibrated values.
- Next, expand the similarity corpus or establish a benchmark set of known material families and get domain feedback on the profiles before integrating search into the discovery engine.
