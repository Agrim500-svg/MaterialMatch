"""Command-line front door to the combined MaterialMind discovery engine."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from src.discovery.engine import MaterialMindDiscovery


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "intent",
        choices=["discover_material", "predict_property", "find_similar", "rank_candidates", "search_image"],
    )
    parser.add_argument("query", nargs="?", help="Chemical formula or Materials Project ID")
    parser.add_argument("--image", help="Image path for search_image intent")
    parser.add_argument("--mode", choices=["auto", "text", "structure"], default="auto")
    parser.add_argument(
        "--target", default="formation_energy_per_atom",
        help="material_type, band_gap, formation_energy_per_atom, density, or all",
    )
    parser.add_argument("--profile", choices=["composition", "properties", "combined"], default="combined")
    parser.add_argument("--k", type=int, default=10)
    parser.add_argument("--no-predictions", action="store_true", help="Omit supplementary ML predictions in global rankings")
    parser.add_argument("--output", help="Optional JSON output path")
    args = parser.parse_args()

    request = {
        "intent": args.intent,
        "query": args.query,
        "image_path": args.image,
        "mode": args.mode,
        "target": args.target,
        "profile": args.profile,
        "k": args.k,
        "include_predictions": not args.no_predictions,
    }
    result = MaterialMindDiscovery().handle_request(request)
    rendered = json.dumps(result, indent=2, ensure_ascii=False, default=str)
    if args.output:
        output_path = Path(args.output)
        output_path.write_text(rendered, encoding="utf-8")
        print(f"Saved result to {output_path}")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
