# MaterialMatch — AI-Powered Materials Discovery Platform

[![Live App](https://img.shields.io/badge/Live_App-material--match--chi.vercel.app-success?logo=vercel&logoColor=white)](https://material-match-chi.vercel.app)
[![API Status](https://img.shields.io/badge/API_Status-Live%20on%20Render-009688?logo=render&logoColor=white)](https://materialmatch.onrender.com/api/health)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/Pytest-43%20passed-success?logo=pytest)](https://pytest.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 🚀 **Live Production Deployment**:
> - **Web Application**: [https://material-match-chi.vercel.app](https://material-match-chi.vercel.app)
> - **FastAPI Discovery Engine API**: [https://materialmatch.onrender.com](https://materialmatch.onrender.com/api/health)

An end-to-end, machine-learning-powered computational materials discovery and screening platform. MaterialMatch predicts crystallographic, electronic, and thermodynamic properties in milliseconds directly from chemical stoichiometry, discovers latent compositional analogs across a 10,000-record Materials Project benchmark, projects topological manifold landscapes, and supports multimodal vision ingestion alongside a grounded scientific AI co-pilot.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Machine Learning Architecture & Results](#machine-learning-architecture--results)
  - [Feature Engineering (153 Descriptors)](#feature-engineering-153-descriptors)
  - [Leakage Prevention Strategy](#leakage-prevention-strategy)
  - [Model Holdout Benchmark Results](#model-holdout-benchmark-results)
- [System Architecture & Stack](#system-architecture--stack)
- [Project Directory Structure](#project-directory-structure)
- [Quickstart & Local Setup](#quickstart--local-setup)
- [Future Scope & Roadmap](#future-scope--roadmap)
- [Author & Attribution](#author--attribution)

---

## Overview

Traditional materials discovery relies heavily on *ab initio* Density Functional Theory (DFT) calculations ($O(N^3)$ computational scaling) or experimental wet-lab synthesis, both of which take days to months per candidate.

**MaterialMatch** accelerates pre-screening by deploying trained machine learning models to infer four critical physical properties from chemical composition alone:
1. **Material Type Classification** (Metal vs. Non-Metal)
2. **Band Gap ($E_g$)** via a two-stage conditional regression pipeline
3. **Formation Energy per Atom ($\Delta E_f$)**
4. **Theoretical Mass Density ($\rho$)**

All predictions run in under **50 ms**, empowering materials scientists, battery researchers, and semiconductor engineers to filter candidate spaces of thousands of materials down to the most promising candidates before commissioning high-fidelity DFT calculations or lab synthesis.

---

## Key Features

- **Composition-Only Property Prediction**: Fast inference without requiring pre-computed 3D crystallographic structures.
- **Two-Stage Band Gap Pipeline**: Eliminates the common physical pathology of predicting small positive band gaps for metals by conditionally gating the regressor behind the binary classifier.
- **Latent Similarity & Analog Search**: High-dimensional vector retrieval blending element-fraction cosine similarity and standardized Magpie descriptor Euclidean distance.
- **Topological Manifold Landscape**: 2D Principal Component Analysis (PCA) projection capturing $>95\%$ of dataset variance and K-Means exploratory clustering across 10,000 Materials Project records.
- **High-Throughput Candidate Screening**: Multi-constraint filtering with interactive controls for density ceiling ($\le 2.0$, $\le 2.5$, $\le 3.0\text{ g/cm}^3$), band gap windows ($0.0\text{ to }15.0\text{ eV}$), and thermodynamic stability along the convex hull ($E_{\text{hull}} = 0$).
- **Multimodal Visual Ingestion**: Gemini Vision ingestion capable of extracting chemical formulas and Materials Project IDs directly from structure diagrams, phase plots, and published papers.
- **Tool-Grounded Scientific Co-Pilot**: An AI assistant connected directly to the local backend engine and ML models, preventing hallucinated numbers.
- **Responsive Mobile & Desktop UI**: Designed with Google's Stitch design tokens, sub-millisecond local formula parsing, and fluid 120Hz/60Hz touch momentum scrolling on mobile devices.

---

## Machine Learning Architecture & Results

### Feature Engineering (153 Descriptors)

Models are trained on **153 composition-derived descriptors** computed via `pymatgen`:
- **118 Elemental Fractions**: Stoichiometric fraction for each element in the periodic table ($Z = 1$ to $118$).
- **5 Stoichiometric Statistics**: Number of constituent elements, minimum elemental fraction, maximum elemental fraction, sum of squared fractions, and composition entropy ($-\sum f_i \ln f_i$).
- **30 Magpie-like Elemental Property Statistics**: Mean, standard deviation, minimum, maximum, and range across 6 fundamental atomic attributes:
  - Atomic number ($Z$)
  - Atomic mass ($m_a$)
  - Pauling electronegativity ($\chi$)
  - Atomic radius ($r_a$)
  - Periodic table row
  - Periodic table group

### Leakage Prevention Strategy
To guarantee that models learn true cross-compositional chemical relationships rather than memorizing polymorphs of identical formulas, the data split enforces a **GroupShuffleSplit based on the reduced Hill formula**:
- **80% Training / 20% Holdout** test split.
- Polymorphic crystal structures (e.g., rutile vs. anatase $\text{TiO}_2$) are strictly confined to the same fold.
- Zero target leakage: descriptors are derived solely from chemical stoichiometry, never from relaxed DFT geometries.

### Model Holdout Benchmark Results

Evaluated on the independent **20% holdout test set** (2,000 records) from the Materials Project benchmark:

| Target Property | Task Type | Winning Model Architecture | Holdout MAE | Holdout RMSE | Holdout $R^2$ / Accuracy | Baseline Comparison |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Material Type** | Binary Classification | `HistGradientBoostingClassifier` | — | — | **82.76% Acc** (F1: 0.821, Prec: 88.2%, Rec: 76.7%) | Majority Baseline: 51.38% |
| **Mass Density ($\rho$)** | Regression | `RandomForestRegressor` | **0.368 g/cm³** | 0.586 g/cm³ | **$R^2 = 0.961$** | Mean Baseline MAE: 2.303 g/cm³ |
| **Formation Energy ($\Delta E_f$)** | Regression | `RandomForestRegressor` | **0.178 eV/atom** | 0.308 eV/atom | **$R^2 = 0.918$** | Mean Baseline MAE: 0.917 eV/atom |
| **Band Gap ($E_g$)** | Conditional Regression | `HistGradientBoostingRegressor` | **0.786 eV** | 1.060 eV | **$R^2 = 0.531$** | Mean Baseline MAE: 1.292 eV |

#### Why a Two-Stage Pipeline for Band Gap?
In materials databases, metals exhibit an exact band gap of $0.0\text{ eV}$, creating a severe zero-inflated target distribution that breaks standard regression. MaterialMatch solves this:
$$\text{Predicted } E_g = \begin{cases} 0.00\text{ eV} & \text{if Classifier predicts Metal} \\ \max(0.00, \text{Regressor}(X)) & \text{if Classifier predicts Non-Metal} \end{cases}$$

---

## System Architecture & Stack

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite SPA                     │
│  Home / Discover · Analysis · Explore · Candidates · AI│
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (Envelope format)
┌───────────────────────────▼────────────────────────────┐
│                  FastAPI Backend                       │
│  /api/predict · /api/discover · /api/similar · /api/rank│
│  /api/search-image · /api/chat · /api/landscape/*       │
└──────┬────────────────────┬────────────────────┬───────┘
       │                    │                    │
┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
│  ML Models  │      │ Vector DB   │      │ Gemini 3.8  │
│  4 Joblib   │      │ 10k Samples │      │ Vision & LLM│
│  Pipelines  │      │ KDTree / PCA│      │ Co-Pilot    │
└─────────────┘      └─────────────┘      └─────────────┘
```

- **Frontend**: React 19, Vite 8, Tailwind CSS 4, React Router 7, JetBrains Mono & Plus Jakarta Sans typography.
- **Backend**: FastAPI, Uvicorn, Pydantic v2.
- **Machine Learning & Materials Science**: `scikit-learn`, `pymatgen`, `numpy`, `pandas`, `joblib`.
- **Testing**: `pytest` (43 tests covering edge cases, routing, and numerical stability), `oxlint` (clean frontend linting).

---

## Project Directory Structure

```
MaterialMatch/
├── backend/
│   ├── app.py                     # FastAPI application endpoints and request routing
│   └── envelope.py                # Standardized API response schema wrapper
├── data/
│   └── raw/
│       └── lightweight_semiconductor_sample.csv # 10,000-record benchmark dataset
├── docs/
│   └── frontend.md                # Frontend architecture and integration contract
├── experiments/                   # Model training and benchmark notebooks
│   ├── band_gap_regression/       # Two-stage band gap experiment logs
│   ├── density_regression/        # Density regression logs
│   ├── metal_classification/      # Metal classifier training logs
│   └── property_prediction/       # Formation energy experiment logs
├── frontend/                      # React SPA
│   ├── src/
│   │   ├── api/client.js          # API client with timeout and retry fallbacks
│   │   ├── components/            # Reusable UI components and charts
│   │   ├── pages/                 # Home, Analysis, Explore, Candidates, Assistant
│   │   └── utils/formatters.js    # Chemical formula and stoichiometry parsers
│   ├── package.json
│   └── vite.config.js
├── models/                        # Serialized production ML model artifacts (.joblib)
│   ├── metal_classifier.joblib
│   ├── band_gap_nonmetal.joblib
│   ├── formation_energy_per_atom.joblib
│   └── density.joblib
├── src/                           # Core Python business logic
│   ├── conversation/              # Gemini co-pilot engine and routing
│   ├── discovery/                 # Candidate discovery orchestration
│   ├── features/                  # 153 composition descriptor generator
│   ├── image_search/              # Multimodal visual recognition pipeline
│   ├── ranking/                   # Candidate constraint screening
│   └── similarity/                # Composition and property neighbor search
├── tests/                         # Pytest test suite (43 passing tests)
├── .env.example                   # Environment variable template
├── .gitignore                     # Repository ignore rules
└── README.md
```

---

## Quickstart & Local Setup

### Prerequisites
- **Python 3.10+** (Python 3.11 or 3.12 recommended)
- **Node.js 18+** and **npm**
- **Git**

### 1. Clone Repository & Setup Environment
```bash
git clone https://github.com/Agrim500-svg/MaterialMatch.git
cd MaterialMatch

# Create and activate Python virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install backend dependencies
pip install fastapi uvicorn scikit-learn pymatgen pandas numpy joblib httpx python-multipart pytest
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Gemini API key (required for Vision and AI Assistant features):
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_VISION_MODEL=gemini-3.8-flash
```

### 3. Run the Backend Service
```bash
uvicorn backend.app:app --reload --port 8000
```
*Backend runs at `http://127.0.0.1:8000` (Interactive Swagger docs at `http://127.0.0.1:8000/docs`).*

### 4. Run the Frontend Service
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

### 5. Running Tests
```bash
# Backend pytest suite (43 tests)
pytest

# Frontend linter
cd frontend
npm run lint
```

---

## Future Scope & Roadmap

1. **Crystal-Structure-Informed Graph Neural Networks (GNNs)**:
   - Integrate ALIGNN (Atomistic Line Graph Neural Network) and CHGNet to allow users to upload `.cif` or `POSCAR` structure files, predicting anisotropic elastic tensors, phonon stability, and electronic band structures with sub-chemical accuracy.
2. **Generative Crystal Discovery via Diffusion**:
   - Incorporate conditional generative models (e.g. CDVAE, MatterGen) to generate *de novo* candidate crystal lattices targeting specific band gap and formation energy targets.
3. **Active Learning & Automated DFT Verification**:
   - Closed-loop active learning connecting local low-confidence predictions to cloud DFT runners (Quantum ESPRESSO / VASP / PySCF) to continuously retrain and refine model boundaries.
4. **Pareto-Optimal Multi-Objective Screening**:
   - Implementation of genetic algorithms (NSGA-II) for materials optimization (e.g. maximizing conductivity while minimizing mass density and toxicity).
5. **Thermodynamic Phase Diagram Construction**:
   - Direct convex-hull phase diagram generation (Grand Canonical energy landscapes) to evaluate competing decomposition pathways at finite temperatures ($T > 0\text{ K}$).

---

## Author & Attribution

- **Creator & Lead Developer**: **Agrim Karmakar**
- **Dataset Attribution**: Computational benchmark records sourced from the **Materials Project** (MP release 2026.04).
- **License**: MIT License — free for academic, research, and commercial exploration.
