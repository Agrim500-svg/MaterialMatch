"""Filter and rank lightweight stable semiconductor candidates.

This baseline ranks database records by density after applying the explicit
screening rules in docs/use_case_definition.md. The score is ordinal within the
current candidate pool; it is not a probability or a material quality measure.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_CSV = PROJECT_ROOT / "data" / "raw" / "lightweight_semiconductor_sample.csv"
OUTPUT_DIR = PROJECT_ROOT / "experiments" / "candidate_ranking"
GAP_MIN_EXCLUSIVE = 0.0
GAP_MAX_INCLUSIVE = 3.0
TOP_N = 20


def _as_bool(series: pd.Series) -> pd.Series:
    """Parse booleans robustly from CSV bools and common string forms."""
    if pd.api.types.is_bool_dtype(series):
        return series
    normalized = series.astype("string").str.strip().str.lower()
    return normalized.map({"true": True, "false": False, "1": True, "0": False})


def rank_candidates(*, write_outputs: bool = True) -> tuple[pd.DataFrame, dict]:
    data = pd.read_csv(INPUT_CSV)
    required = {
        "material_id", "formula_pretty", "is_metal", "band_gap", "density",
        "is_stable", "energy_above_hull",
    }
    missing = sorted(required - set(data.columns))
    if missing:
        raise ValueError(f"Input is missing required columns: {missing}")

    for column in ("band_gap", "density", "energy_above_hull"):
        data[column] = pd.to_numeric(data[column], errors="coerce")
    data["is_metal"] = _as_bool(data["is_metal"])
    data["is_stable"] = _as_bool(data["is_stable"])

    semiconductor = data.loc[
        data["is_metal"].eq(False)
        & data["band_gap"].gt(GAP_MIN_EXCLUSIVE)
        & data["band_gap"].le(GAP_MAX_INCLUSIVE)
        & data["density"].notna()
    ].copy()
    if semiconductor.empty:
        raise ValueError("No records meet the semiconductor proxy; cannot derive density threshold.")

    density_cutoff = float(semiconductor["density"].quantile(0.25))
    eligible = semiconductor.loc[
        semiconductor["density"].le(density_cutoff)
        & semiconductor["is_stable"].eq(True)
    ].copy()

    # Density is the stated optimization objective. Band gap and stability are
    # eligibility criteria; energy above hull remains visible for inspection.
    eligible = eligible.sort_values(
        ["density", "band_gap", "material_id"],
        ascending=[True, False, True],
        kind="mergesort",
    ).reset_index(drop=True)
    eligible.insert(0, "rank", np.arange(1, len(eligible) + 1))
    if len(eligible) <= 1:
        eligible["relative_density_rank_score"] = 100.0 if len(eligible) else pd.Series(dtype=float)
    else:
        eligible["relative_density_rank_score"] = (
            100 * (1 - (eligible["rank"] - 1) / (len(eligible) - 1))
        ).round(2)
    eligible["ranking_basis"] = "Lower density ranks higher; band gap/stability are eligibility filters"

    keep = [
        "rank", "relative_density_rank_score", "material_id", "formula_pretty",
        "density", "band_gap", "energy_above_hull", "is_stable", "is_metal",
        "ranking_basis",
    ]
    results = eligible[keep]
    metadata_path = PROJECT_ROOT / "data" / "raw" / "lightweight_semiconductor_sample_metadata.json"
    sample_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    summary = {
        "source_csv": str(INPUT_CSV.relative_to(PROJECT_ROOT)),
        "source_database_version": sample_metadata.get("database_version"),
        "rows_input": int(len(data)),
        "semiconductor_proxy_count": int(len(semiconductor)),
        "density_cutoff_g_cm3": density_cutoff,
        "stable_lightweight_candidate_count": int(len(results)),
        "ranked_by": "density ascending",
        "eligibility": {
            "is_metal": False,
            "band_gap_eV": f"({GAP_MIN_EXCLUSIVE}, {GAP_MAX_INCLUSIVE}]",
            "density_g_cm3": f"<= semiconductor-proxy 25th percentile ({density_cutoff:.6f})",
            "is_stable": True,
        },
        "ordinal_score_note": "Relative rank mapped linearly from 100 (first) to 0 (last); not a probability or calibrated quality score.",
        "top_n_exported": min(TOP_N, len(results)),
        "top_candidates": results.head(TOP_N)[["rank", "material_id", "formula_pretty", "density", "band_gap"]].to_dict("records"),
    }

    if write_outputs:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        results.to_csv(OUTPUT_DIR / "ranked_candidates.csv", index=False)
        results.head(TOP_N).to_csv(OUTPUT_DIR / "top_20_candidates.csv", index=False)
        (OUTPUT_DIR / "ranking_summary.json").write_text(
            json.dumps(summary, indent=2, default=float), encoding="utf-8"
        )
    return results, summary


if __name__ == "__main__":
    ranked, report = rank_candidates()
    print(f"Input records: {report['rows_input']}")
    print(f"Semiconductor proxy records: {report['semiconductor_proxy_count']}")
    print(f"Density cutoff: {report['density_cutoff_g_cm3']:.6f} g/cm^3")
    print(f"Stable lightweight candidates ranked: {len(ranked)}")
    print("\nTop 10 by density:")
    print(ranked.head(10).to_string(index=False))
    print(f"\nSaved ranking outputs to {OUTPUT_DIR}")
