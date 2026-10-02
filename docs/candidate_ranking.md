# MaterialMind Phase 5: Candidate Ranking

**Status:** Initial transparent ranking prototype complete  
**Data:** 10,000 sampled Materials Project summary records  
**Database release:** `2026.04.13`

## Ranking objective

The initial discovery scope is lightweight stable semiconductors. Following the definitions in `use_case_definition.md`, the workflow applies these eligibility rules:

1. Semiconductor proxy: `is_metal == False` and `0 < band_gap <= 3 eV`.
2. Lightweight: density is at or below the 25th percentile among records meeting the semiconductor proxy.
3. Stable: Materials Project `is_stable == True`.

Eligible records are ranked by **ascending density**. This matches the current use case, which identifies low density as the optimization objective. Band gap and stability determine eligibility; they are not blended into an arbitrary weighted score. `energy_above_hull` is retained for review. The exported ordinal score maps rank 1 to 100 and the last rank to 0; it is a display aid, not a probability or calibrated measure of material quality.

## Results

- Input records: 10,000
- Semiconductor-proxy records: 3,314
- Semiconductor density 25th-percentile cutoff: 3.004680 g/cm³
- Stable lightweight candidates: 78
- All 78 are marked stable in the source data and have `energy_above_hull = 0` in this sample.

| Rank | Material ID | Formula | Density (g/cm³) | Band gap (eV) |
|---:|---|---|---:|---:|
| 1 | mp-aaacczwg | CaAlH5 | 1.7220 | 2.6923 |
| 2 | mp-aaabkrdb | Ca(H2N)2 | 1.7699 | 2.7109 |
| 3 | mp-aaabetuy | BS2 | 1.8413 | 2.5564 |
| 4 | mp-aaabevik | K2Na3SiP3 | 1.9136 | 0.8901 |
| 5 | mp-aaabevma | P2S5 | 1.9214 | 2.5540 |
| 6 | mp-aaabevia | K3AlP2 | 1.9365 | 0.6990 |
| 7 | mp-aaabkptb | K2Sn(H2N)6 | 1.9583 | 2.4109 |
| 8 | mp-aaacqkqj | K2PS3 | 1.9661 | 2.8873 |
| 9 | mp-aaabetym | FePCl8 | 2.0843 | 1.4417 |
| 10 | mp-aaackidz | OF2 | 2.1963 | 2.1241 |

These are database sample candidates for follow-up, not experimentally validated recommendations. A low-density rank alone does not establish suitability, synthesizability, toxicity, or performance in a particular device. The sample is page-based and contains 10,000 records rather than the full active database.

## Reproduce

Run from the project root:

```powershell
.\.venv\Scripts\python.exe src\ranking\rank_candidates.py
```

The script reads the saved use-case sample and its metadata, derives the relative density threshold from the semiconductor-proxy subset, applies the filters, and writes:

- `experiments/candidate_ranking/ranked_candidates.csv` — all eligible records in rank order.
- `experiments/candidate_ranking/top_20_candidates.csv` — first 20 ranked records.
- `experiments/candidate_ranking/ranking_summary.json` — filters, threshold, sample version, funnel counts, and leading candidates.

## Next refinement

Replace relative density ranking with a user/application-defined density limit and an agreed band-gap target/range. For multi-objective ranking, obtain explicit preference weights or show a Pareto frontier rather than silently choosing weights. Phase 2 formation-energy predictions should remain separately labelled and should not replace available Materials Project values; uncertainty and out-of-sample validation are needed before predictions influence candidate rank.
