"""Qualitative evaluation using stable GaAs (mp-2534) as a known reference."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

from dotenv import load_dotenv
from mp_api.client import MPRester

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = PROJECT_ROOT / "experiments" / "similarity"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv(PROJECT_ROOT / ".env")

sys.path.insert(0, str(PROJECT_ROOT))
from src.similarity.material_similarity import MaterialSimilarityIndex, PROPERTY_COLUMNS


def main() -> None:
    # Save the exact reference record used for this evaluation.
    with MPRester() as mpr:
        docs = mpr.materials.summary.search(
            material_ids=["mp-2534"],
            deprecated=False,
            fields=["material_id", "formula_pretty", *PROPERTY_COLUMNS, "is_stable", "is_metal"],
        )
    if not docs:
        raise RuntimeError("GaAs reference mp-2534 was not found in Materials Project.")
    doc = docs[0]
    reference = {
        "material_id": str(doc.material_id),
        "formula_pretty": doc.formula_pretty,
        **{field: getattr(doc, field, None) for field in PROPERTY_COLUMNS},
        "is_stable": getattr(doc, "is_stable", None),
        "is_metal": getattr(doc, "is_metal", None),
    }
    (RESULTS_DIR / "gaas_reference.json").write_text(json.dumps(reference, indent=2), encoding="utf-8")

    index = MaterialSimilarityIndex.from_csv()
    known_analogs = {"GaP", "InAs", "AlAs", "GaSb", "InP", "AlP"}
    rank_rows = []
    for profile in ("composition", "properties", "combined"):
        ranked = index.search(reference, k=len(index.materials), profile=profile)
        ranked.head(20).to_csv(RESULTS_DIR / f"gaas_top20_{profile}.csv", index=False)
        ranked["rank"] = range(1, len(ranked) + 1)
        for formula in sorted(known_analogs):
            matches = ranked[ranked["formula_pretty"] == formula]
            rank_rows.append({
                "profile": profile,
                "known_analog_formula": formula,
                "sample_count": int(len(matches)),
                "best_rank": int(matches["rank"].min()) if len(matches) else None,
                "best_similarity_score": float(matches.iloc[0]["similarity_score"]) if len(matches) else None,
                "best_material_id": str(matches.iloc[0]["material_id"]) if len(matches) else None,
            })
        print(f"\n{profile} profile - top 10")
        print(ranked.head(10)[[
            "material_id", "formula_pretty", "similarity_score",
            "composition_similarity", "property_similarity", "shared_elements",
        ]].to_string(index=False, float_format=lambda value: f"{value:.3f}"))

    ranks = pd.DataFrame(rank_rows)
    ranks.to_csv(RESULTS_DIR / "gaas_known_analog_ranks.csv", index=False)
    print("\nKnown-analog ranks:")
    print(ranks.to_string(index=False))


if __name__ == "__main__":
    main()

