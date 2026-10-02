"""Profile a lightweight-semiconductor discovery use case on a fresh MP sample."""

from __future__ import annotations

import json
import math
import os
import random
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from mp_api.client import MPRester

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
RESULTS_DIR = PROJECT_ROOT / "experiments" / "discovery_use_case"
SAMPLE_SIZE = 10_000
PAGE_SIZE = 1_000
SEED = 20261002
FIELDS = [
    "material_id",
    "formula_pretty",
    "is_metal",
    "band_gap",
    "density",
    "is_stable",
    "energy_above_hull",
]


def main() -> None:
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("MP_API_KEY")
    if not api_key:
        raise RuntimeError("MP_API_KEY is missing. Check the project .env file.")

    with MPRester(api_key) as mpr:
        database_version = mpr.db_version
        active_count = mpr.materials.summary.count(criteria={"deprecated": False})
        page_count = math.ceil(active_count / PAGE_SIZE)
        pages_needed = min(math.ceil(SAMPLE_SIZE / PAGE_SIZE), page_count)
        pages = sorted(random.Random(SEED).sample(range(page_count), pages_needed))
        docs = []
        for page in pages:
            docs.extend(
                mpr.materials.summary.search(
                    deprecated=False,
                    _page=page,
                    chunk_size=PAGE_SIZE,
                    fields=FIELDS,
                )
            )

    df = pd.DataFrame([doc.model_dump() for doc in docs])
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    sample_path = RAW_DIR / "lightweight_semiconductor_sample.csv"
    df.to_csv(sample_path, index=False)

    metadata = {
        "source": "Materials Project summary endpoint via official mp-api client",
        "retrieved_on": "2026-10-02",
        "database_version": database_version,
        "active_summary_records_at_retrieval": active_count,
        "sample_rows": int(len(df)),
        "sampling_method": "10 randomly selected API pages across active non-deprecated summary records",
        "random_seed": SEED,
        "page_size": PAGE_SIZE,
        "sampled_pages": pages,
        "fields": FIELDS,
        "assumptions": {
            "semiconductor_proxy": "0 < band_gap <= 3 eV and is_metal == False (operational semiconductor proxy)",
            "lightweight_cutoff": "25th percentile of density within semiconductor-proxy subset",
            "stability_screen": "Materials Project is_stable == True",
        },
    }
    (RAW_DIR / "lightweight_semiconductor_sample_metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )

    numeric_properties = ["band_gap", "density", "energy_above_hull"]
    missing = df[FIELDS].isna().sum().to_dict()
    semiconductors = df[(df["band_gap"] > 0) & (df["band_gap"] <= 3.0) & (df["is_metal"] == False)].copy()
    density_q25 = float(semiconductors["density"].quantile(0.25)) if len(semiconductors) else None
    lightweight = semiconductors[semiconductors["density"] <= density_q25] if density_q25 is not None else semiconductors
    stable = semiconductors[semiconductors["is_stable"] == True]
    final_candidates = lightweight[lightweight["is_stable"] == True]

    summary = {
        "database_version": database_version,
        "active_summary_records": active_count,
        "sample_rows": int(len(df)),
        "missing_values": {key: int(value) for key, value in missing.items()},
        "duplicate_material_ids": int(df["material_id"].duplicated().sum()),
        "band_gap_distribution_eV": df["band_gap"].describe(
            percentiles=[0.1, 0.25, 0.5, 0.75, 0.9]
        ).to_dict(),
        "density_distribution_g_cm3": df["density"].describe(
            percentiles=[0.1, 0.25, 0.5, 0.75, 0.9]
        ).to_dict(),
        "energy_above_hull_distribution_eV_per_atom": df["energy_above_hull"].describe(
            percentiles=[0.1, 0.25, 0.5, 0.75, 0.9]
        ).to_dict(),
        "metal_flag_counts": {str(key): int(value) for key, value in df["is_metal"].value_counts(dropna=False).items()},
        "is_stable_counts": {str(key): int(value) for key, value in df["is_stable"].value_counts(dropna=False).items()},
        "positive_band_gap_count": int((df["band_gap"] > 0).sum()),
        "band_gap_zero_count": int((df["band_gap"] == 0).sum()),
        "semiconductor_proxy_count": int(len(semiconductors)),
        "semiconductor_density_q25_g_cm3": density_q25,
        "lightweight_semiconductor_proxy_count": int(len(lightweight)),
        "stable_semiconductor_proxy_count": int(len(stable)),
        "lightweight_stable_semiconductor_count": int(len(final_candidates)),
        "final_candidate_stable_fraction": float(final_candidates["is_stable"].mean()) if len(final_candidates) else None,
    }
    (RESULTS_DIR / "coverage_and_filter_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    if len(final_candidates):
        final_candidates.sort_values(["density", "energy_above_hull", "band_gap"]).to_csv(
            RESULTS_DIR / "top_lightweight_stable_semiconductors.csv", index=False
        )
    pd.DataFrame({
        "property": numeric_properties,
        "missing": [missing[property_name] for property_name in numeric_properties],
        "available": [int(df[property_name].notna().sum()) for property_name in numeric_properties],
    }).to_csv(RESULTS_DIR / "property_coverage.csv", index=False)

    print(f"Database version: {database_version}")
    print(f"Active records: {active_count}; sample rows: {len(df)}; duplicate IDs: {summary['duplicate_material_ids']}")
    print("Missing values:")
    print(df[FIELDS].isna().sum().to_string())
    print("\nCandidate funnel:")
    print(f"Band gap in (0, 3] eV and non-metal proxy: {len(semiconductors)}")
    print(f"Density <= semiconductor subset Q25 ({density_q25:.3f} g/cm3): {len(lightweight)}")
    print(f"MP is_stable == True among semiconductor proxy: {len(stable)}")
    print(f"All three criteria: {len(final_candidates)}")
    print("\nNumeric summaries:")
    print(df[numeric_properties].describe(percentiles=[0.1, 0.25, 0.5, 0.75, 0.9]).round(3))
    print("\nTop candidates (lowest density first):")
    print(final_candidates.sort_values(["density", "energy_above_hull"]).head(10)[
        ["material_id", "formula_pretty", "band_gap", "density", "energy_above_hull", "is_stable"]
    ].to_string(index=False, float_format=lambda value: f"{value:.3f}"))


if __name__ == "__main__":
    main()

