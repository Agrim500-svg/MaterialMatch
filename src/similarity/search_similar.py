"""Command-line entry point for MaterialMind similarity search."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
from src.similarity.material_similarity import MaterialSimilarityIndex


def main() -> None:
    parser = argparse.ArgumentParser(description="Find similar Materials Project materials.")
    parser.add_argument("query", help="Materials Project ID or chemical formula, e.g. mp-2534 or GaAs")
    parser.add_argument("--k", type=int, default=10, help="Number of neighbors to return")
    parser.add_argument(
        "--profile",
        choices=["composition", "properties", "combined"],
        default="combined",
        help="Similarity profile (default: combined)",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=PROJECT_ROOT / "data" / "raw" / "materials_sample.csv",
        help="CSV materials corpus",
    )
    args = parser.parse_args()

    index = MaterialSimilarityIndex.from_csv(args.data)
    results = index.search(args.query, k=args.k, profile=args.profile)
    columns = [
        "material_id", "formula_pretty", "band_gap", "density",
        "energy_above_hull", "similarity_score", "composition_similarity",
        "property_similarity", "shared_elements", "similarity_reasons",
    ]
    print(results[columns].to_string(index=False, float_format=lambda value: f"{value:.3f}"))
    print("\nScores are relative similarity measures, not probabilities.")


if __name__ == "__main__":
    main()
