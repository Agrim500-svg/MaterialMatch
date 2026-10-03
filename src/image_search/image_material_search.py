"""Interpret material-related images and route recognized queries to search.

Text/formula extraction and visual interpretation use Gemini Vision. The
retrieval step reuses the local composition/property similarity index; it does
not claim exact crystal-structure matching because the local corpus has no CIFs.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv
from PIL import Image
from pymatgen.core import Composition

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "data" / "raw" / "materials_sample.csv"
DEFAULT_MODEL = "gemini-3.8-flash"
MAX_IMAGE_BYTES = 15 * 1024 * 1024
SUPPORTED_MIME_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "image_kind": {
            "type": "string",
            "enum": ["material_text_or_chart", "crystal_structure_diagram", "other_or_unclear"],
        },
        "visible_text": {"type": "array", "items": {"type": "string"}},
        "material_ids": {"type": "array", "items": {"type": "string"}},
        "formulas": {"type": "array", "items": {"type": "string"}},
        "elements": {"type": "array", "items": {"type": "string"}},
        "approximate_composition": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "observations": {"type": "array", "items": {"type": "string"}},
        "uncertainties": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "image_kind", "visible_text", "material_ids", "formulas", "elements",
        "approximate_composition", "confidence", "observations", "uncertainties",
    ],
}

PROMPT = """You are the image interpretation stage for a materials search tool.
Inspect the image and return only information visible or reasonably inferable
from it. Do not invent a material identity, formula, database ID, or atom label.

For a screenshot, chart, or table: transcribe visible chemistry formulas and
Materials Project identifiers such as mp-1234. Preserve strings exactly and
also normalize obvious chemical formula text into formulas when clear.

For a crystal structure diagram: report visible element labels and, only when
the diagram makes it clear, an approximate composition formula. Do not infer
3D coordinates, space group, or exact polymorph from a 2D drawing. State drawing
ambiguity, unlabeled atoms, occlusion, or uncertain stoichiometry in
uncertainties. If no material can be identified, leave formulas and IDs empty.

Confidence is a rough model self-assessment, not a calibrated probability.
"""


def _load_image(image_path: str | Path) -> tuple[bytes, str]:
    path = Path(image_path)
    if not path.is_file():
        raise FileNotFoundError(f"Image file does not exist: {path}")
    payload = path.read_bytes()
    if not payload:
        raise ValueError("The uploaded image is empty.")
    if len(payload) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 15 MiB Phase 1 upload limit.")
    try:
        with Image.open(path) as image:
            image.verify()
            mime_type = SUPPORTED_MIME_TYPES.get(str(image.format).upper())
    except Exception as exc:
        raise ValueError("Image must be a valid PNG, JPEG, or WebP file.") from exc
    if not mime_type:
        raise ValueError("Image must be PNG, JPEG, or WebP.")
    return payload, mime_type


def _json_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert pandas rows to JSON-safe records: noise dropped, elements parsed, NaN to null."""
    from src.similarity.material_similarity import clean_material_records

    return json.loads(clean_material_records(frame).to_json(orient="records"))


def _gemini_interpret(image_bytes: bytes, mime_type: str, mode: str) -> dict[str, Any]:
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Add your Gemini API key to the local .env file."
        )
    mode_text = {
        "auto": "Determine whether this is a material screenshot or a crystal structure diagram.",
        "text": "Treat this as a screenshot/chart/table and focus on OCR of formulas and material IDs.",
        "structure": "Treat this as a crystal structure diagram and carefully report visible atom labels and composition.",
    }[mode]
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={
            "model": os.getenv("GEMINI_VISION_MODEL", DEFAULT_MODEL),
            "input": [
                {"type": "text", "text": f"{PROMPT}\n\nRequested mode: {mode_text}"},
                {
                    "type": "image",
                    "data": base64.b64encode(image_bytes).decode("ascii"),
                    "mime_type": mime_type,
                },
            ],
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": RESPONSE_SCHEMA,
            },
            "generation_config": {"thinking_level": os.getenv("GEMINI_THINKING_LEVEL", "low")},
        },
        timeout=90,
    )
    if not response.ok:
        detail = response.text[:1000]
        raise RuntimeError(f"Gemini image interpretation failed ({response.status_code}): {detail}")
    body = response.json()
    from src.conversation.assistant import _extract_output_text

    output_text = _extract_output_text(body)
    if not output_text:
        raise RuntimeError("Gemini returned no structured image interpretation.")
    try:
        result = json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Gemini returned malformed JSON for image interpretation.") from exc
    return result


def search_material_image(
    image_path: str | Path,
    *,
    mode: str = "auto",
    k: int = 10,
    data_path: str | Path = DEFAULT_DATA,
) -> dict[str, Any]:
    """Interpret an image and search the local corpus for recognized IDs/formulas."""
    if mode not in {"auto", "text", "structure"}:
        raise ValueError("mode must be 'auto', 'text', or 'structure'.")
    if k < 1:
        raise ValueError("k must be positive.")
    image_bytes, mime_type = _load_image(image_path)
    interpretation = _gemini_interpret(image_bytes, mime_type, mode)

    # Import lazily so uploading/validating and interpretation do not pay the
    # cost of constructing a similarity index until a query was actually found.
    from src.similarity.material_similarity import MaterialSimilarityIndex

    search_index: MaterialSimilarityIndex | None = None
    searches: list[dict[str, Any]] = []
    queries = [("material_id", value) for value in interpretation.get("material_ids", [])]
    queries += [("formula", value) for value in interpretation.get("formulas", [])]
    seen: set[tuple[str, str]] = set()
    local_materials: pd.DataFrame | None = None

    for query_type, raw_query in queries:
        query = str(raw_query).strip()
        key = (query_type, query.casefold())
        if not query or key in seen:
            continue
        seen.add(key)
        if search_index is None:
            search_index = MaterialSimilarityIndex.from_csv(data_path)
        if query_type == "material_id":
            if local_materials is None:
                local_materials = pd.read_csv(data_path)
            exact = local_materials[local_materials["material_id"].astype(str).str.casefold() == query.casefold()]
        else:
            if local_materials is None:
                local_materials = pd.read_csv(data_path)
            try:
                reduced_query = Composition(query).reduced_formula
                exact = local_materials.loc[
                    local_materials["formula_pretty"].map(
                        lambda formula: Composition(str(formula)).reduced_formula == reduced_query
                    )
                ]
            except Exception:
                exact = pd.DataFrame()
        try:
            neighbors = search_index.search(query, k=k, profile="composition")
            searches.append({
                "query_type": query_type,
                "query": query,
                "exact_local_matches": _json_records(exact.head(3)),
                "similar_materials": _json_records(neighbors),
                "retrieval_note": "Composition similarity over the local sample; score is relative, not a probability.",
            })
        except (ValueError, TypeError) as exc:
            searches.append({
                "query_type": query_type,
                "query": query,
                "exact_local_matches": _json_records(exact.head(3)),
                "similar_materials": [],
                "retrieval_note": str(exc),
            })

    if interpretation.get("image_kind") == "crystal_structure_diagram":
        structure_note = (
            "Diagram interpreted for visible labels/composition only. The local search corpus has no atomic coordinates/CIFs, "
            "so exact crystal-structure matching is not performed."
        )
    else:
        structure_note = None
    if not searches:
        status = "no_search_query_recognized"
    else:
        status = "search_results_available"
    return {
        "status": status,
        "source_image": Path(image_path).name,
        "interpretation": interpretation,
        "searches": searches,
        "structure_matching_note": structure_note,
        "confidence_note": "Vision confidence is model self-assessment and is not calibrated.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", help="Path to a PNG, JPEG, or WebP image")
    parser.add_argument("--mode", choices=["auto", "text", "structure"], default="auto")
    parser.add_argument("--k", type=int, default=10, help="Similar materials per recognized formula/ID")
    parser.add_argument("--output", help="Optional path to save the JSON result")
    args = parser.parse_args()
    result = search_material_image(args.image, mode=args.mode, k=args.k)
    rendered = json.dumps(result, indent=2, default=str)
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
        print(f"Saved image-search result to {args.output}")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
