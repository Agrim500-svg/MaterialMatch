# MaterialMind Phase 6: Combined Discovery Engine

**Status:** Initial Python orchestration layer implemented  
**Purpose:** A shared entry point that calls the relevant Phase 2–5 capability for a structured user request.

## Routing behavior

| Intent | Components called | Returned result |
|---|---|---|
| `discover_material` | Materials Project record resolution, Phase 2 formation-energy prediction, Phase 3 similarity search, Phase 4 cluster context when the exact record is in the saved sample | Known database values, separately labelled ML estimate, similar materials, and optional exact cluster context |
| `predict_property` | Phase 2 | Composition-only formation-energy estimate for a formula or material ID |
| `find_similar` | Phase 3 | Similar materials using `combined`, `composition`, or `properties` profile |
| `rank_candidates` | Phase 5 ranking, Phase 2 prediction, optional Phase 4 label lookup | Density-ranked eligible candidates with supplementary formation-energy estimates; predictions do not alter the rank |
| `search_image` | Gemini Vision image interpretation, then Phase 3 search | Formula/ID interpretation and local composition-similarity results |

This is a **structured-intent router**, not a natural-language chatbot. A caller says what operation it needs using an `intent`. Natural-language interpretation remains Phase 8, and a web API/upload screen remain Phases 7 and 9. Model predictions, database values, similarity scores, and exploratory clusters are returned in separate fields with source notes; they are not blended into one opaque score.

## Use from Python

```python
from src.discovery.engine import MaterialMindDiscovery

engine = MaterialMindDiscovery()  # Reuse one instance so loaded assets are cached.
result = engine.handle_request({
    "intent": "discover_material",
    "query": "GaAs",
    "k": 10,
})
```

For a new composition when the user explicitly requests a prediction:

```python
result = engine.handle_request({
    "intent": "predict_property",
    "query": "Al2O3",
    "target": "formation_energy_per_atom",
})
```

`predict_property` for a plain chemical formula is fully offline: it validates and
reduces the composition with pymatgen and runs the local Phase 2 model without
touching the Materials Project API.

## Response hygiene

- Similarity/exact-match records never include mp_api bookkeeping columns
  (`fields_not_requested`, `unavailable_fields`), and `elements` is returned as a
  real JSON array (not the CSV string repr).
- Records with unparseable formulas are skipped when the similarity index is
  built, and per-row formula normalization fails soft instead of crashing a
  request. All returned records are JSON-safe (NaN becomes null).

## Testing

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

The suite covers intent dispatch, output contracts (noise column stripping,
element lists, nulls), offline formula prediction, and input validation errors.

## Use from PowerShell

Run commands from the MaterialMind project root:

```powershell
.\.venv\Scripts\python.exe -m src.discovery.run_discovery discover_material GaAs --k 10
.\.venv\Scripts\python.exe -m src.discovery.run_discovery predict_property Al2O3
.\.venv\Scripts\python.exe -m src.discovery.run_discovery find_similar GaAs --profile composition --k 10
.\.venv\Scripts\python.exe -m src.discovery.run_discovery rank_candidates --k 20
.\.venv\Scripts\python.exe -m src.discovery.run_discovery search_image --image .\path\to\image.png --mode auto
```

Add `--output .\result.json` to save JSON instead of printing it. The image route requires `GEMINI_API_KEY` configured as described in `image_based_search.md`.

## Data and interpretation boundaries

- Phase 2 has one trained target: formation energy per atom. Its value is always labelled as a MaterialMind estimate, not a database fact or experimental measurement.
- Phase 3 scores are relative similarities, not probabilities.
- Phase 4 cluster context is returned only when the queried material ID has a saved sample assignment. Clusters are exploratory.
- Phase 5 ranking is based on the current lightweight stable semiconductor criteria and density-first ordering. Adding ML predictions does not change candidate rank.
- Each capability still uses the 10,000-row sample where applicable. Candidate rankings and cluster coverage do not imply full Materials Project coverage.
- Image-assisted structure diagrams currently route by recognized composition; exact 3D structure comparison needs structure data and its own validated search method.

## Current interface boundary

The engine accepts a Python dictionary and returns a JSON-friendly dictionary. `run_discovery.py` is a command-line adapter. The code is ready for a Phase 7 Node/Python API wrapper; the React upload and conversational query experiences are still later work. Keep a `MaterialMindDiscovery` instance alive in a server process so the similarity index and model artifacts load once rather than for every request.
