# MaterialMatch Frontend (React)

**Status:** V1 implemented, connected to the real backend  
**Location:** `frontend/` (Vite 8 + React 19 + Tailwind CSS 4 + react-router 7)

## Run

```powershell
# Terminal 1 — backend
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install     # first time only
npm run dev     # http://localhost:5173
```

In development, `/api/*` is proxied to `http://127.0.0.1:8000`
(`frontend/vite.config.js`), so no CORS config is needed locally. For
production, serve the built app (`npm run build` → `frontend/dist/`) behind
the same origin as the API, or set the backend `FRONTEND_ORIGIN` env var.

## Pages

| Route | Page | Backend calls |
|---|---|---|
| `/` | Home / Discover — hero search, feature cards, how-it-works | none (example chip navigates to `/analyze/Si`) |
| `/analyze/:formula` | Material Analysis | `POST /api/discover` (four V1 properties + DB reference + similarity + cluster context), `GET /api/landscape/*` for the landscape tab |
| `/explore` | Explore Materials (tabs: Similarity / Landscape / Image) | `POST /api/similar`, `GET /api/landscape/summary` + `image`, `POST /api/search-image` (multipart) |
| `/candidates` | Candidate Discovery | `POST /api/rank` |
| `/assistant` | AI chat (+ `?material=Si` deep link) | `POST /api/chat` |

## Source map

```
frontend/src/
├── api/client.js          # envelope-aware fetch wrapper + ApiError; single place that knows the backend
├── components/
│   ├── Layout.jsx         # nav bar (collapses to menu on mobile) + footer
│   ├── SearchBar.jsx      # formula search, example chips
│   ├── PropertyCards.jsx  # four V1 cards + database-vs-ML reference block
│   ├── MaterialCard.jsx   # formula + real returned fields + Analyze
│   ├── Tabs.jsx           # pill tabs used for segmented sections
│   └── ui.jsx             # LoadingState, ErrorState (incl. backend-unavailable hint), EmptyState, Badge, ConfidenceIndicator (low-confidence warning at <67%)
└── pages/
    ├── HomePage.jsx
    ├── AnalysisPage.jsx   # properties + Material Discovery tabs + AI CTA
    ├── ExplorePage.jsx    # one workspace at a time: similarity / landscape / image
    ├── CandidatesPage.jsx # V1 fixed screening criteria table; no fake V2 controls
    └── AssistantPage.jsx  # chat + structured material cards + suggestion chips
```

## Data rules honored

- Every number shown comes from a live backend response — no hardcoded ML values, mock scores, or confidence figures.
- ML predictions carry a "Predicted"/"ML" badge; database values are grouped under a separate "Database values" block.
- Material-type confidence shown as "Model confidence" with a bar and a low-confidence note below 67% — never called accuracy.
- Metals show Band Gap **0 eV, "Metal classification"** because the backend's `stage` is `classifier_only`; non-metals show the conditional regression value.
- Loading, error (with retry), invalid formula (400), empty results, and backend-unavailable states are handled explicitly.

## What was intentionally left out

- No V2 parameterized ranking controls (backend `POST /api/rank` only accepts `k` and `include_predictions`; unsupported knobs would be fake).
- No ML logic in React — band-gap routing is read from the backend's `stage` field.
- No changes to ML models, similarity math, clustering, or the formation-energy pipeline. The only backend additions were two read-only landscape endpoints serving the existing Phase 4 artifacts.
