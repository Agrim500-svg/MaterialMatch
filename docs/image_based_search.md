# Image-Based Material Search: Initial Implementation

**Status:** Python image-search module implemented; requires a Gemini API key for live image interpretation.  
**Supported image inputs:** screenshots/charts/tables with material text, and crystal-structure diagrams.  
**Retrieval corpus:** local 10,000-record Materials Project sample (`2026.04.13`).

## User flow

1. The caller supplies a PNG, JPEG, or WebP image (maximum 15 MiB).
2. Gemini Vision classifies the image and returns structured fields: visible text, material IDs, formulas, visible elements, confidence estimate, observations, and uncertainties.
3. Recognized Materials Project IDs are looked up in the local corpus. Recognized formulas are shown as exact composition matches where available, then sent through the Phase 3 composition-similarity search.
4. The response preserves interpretation uncertainty and marks similarity scores as relative, not probabilities.

For crystal diagrams, this first implementation recognizes visible labels/composition and searches by composition. It does **not** compare crystal coordinates or claim to identify the exact polymorph. The current local CSV does not include `structure`/CIF data, and a 2D illustration generally does not fully specify a 3D structure. Structure-aware image retrieval needs a structure corpus plus a validated conversion or embedding method.

## Setup

The image interpreter sends the uploaded image to the Gemini API. Do not use it for confidential images unless that is acceptable for your deployment. The project currently has an `MP_API_KEY` for Materials Project access but no configured `GEMINI_API_KEY`.

Keep the existing local `.env` and add the Gemini settings below; do not replace the file, since it already contains the Materials Project key. Keep `.env` untracked. `.env.example` is only a template:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_VISION_MODEL=gemini-3.8-flash
```

The image module uses existing project dependencies (`requests`, `Pillow`, `python-dotenv`, `pymatgen`, `pandas`, and the Phase 3 similarity dependencies); it does not add a new image package.

## Run from the project root

Screenshot, chart, or table:

```powershell
.\.venv\Scripts\python.exe src\image_search\image_material_search.py .\path\to\image.png --mode text --k 10
```

Crystal-structure diagram:

```powershell
.\.venv\Scripts\python.exe src\image_search\image_material_search.py .\path\to\structure.png --mode structure --k 10
```

Use `--mode auto` to let the vision model choose. Add `--output .\image_search_result.json` to save the structured result. The module can also be called from a future API or UI:

```python
from src.image_search.image_material_search import search_material_image

result = search_material_image("diagram.png", mode="structure", k=10)
```

## Current limitations

- Live interpretation cannot run until `GEMINI_API_KEY` is configured; keys are never printed or written into outputs.
- Formula/ID recognition quality has not yet been benchmarked against a labeled image set. The model's confidence field is self-reported and uncalibrated.
- Composition-similarity retrieval is useful for narrowing a search, but it is not exact image matching.
- Crystal diagrams can omit labels, depth, unit-cell boundaries, or coordinates; the output must be checked by the user.
- The Phase 3 local index represents only the sampled 10,000 materials. An ID outside that sample may need the existing Materials Project API credential to resolve.

## Next step

Add an upload endpoint in Phase 7 and an upload/preview/search-results flow in Phase 9. Before launch, collect a small labeled set of screenshot and structure-diagram examples and measure formula/ID extraction accuracy and retrieval relevance.
