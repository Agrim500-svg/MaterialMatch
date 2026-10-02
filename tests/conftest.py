"""Shared fixtures for Phase 5/6 smoke tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

SAMPLE_ROWS = [
    {
        "material_id": "mp-t0001", "formula_pretty": "Si", "elements": "['Si']",
        "band_gap": 0.61, "density": 2.33, "formation_energy_per_atom": -0.052,
        "energy_above_hull": 0.0, "is_metal": False, "is_stable": True,
        "volume": 20.5, "nsites": 2,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
    {
        "material_id": "mp-t0002", "formula_pretty": "SiC", "elements": "['Si', 'C']",
        "band_gap": 1.35, "density": 3.21, "formation_energy_per_atom": -0.33,
        "energy_above_hull": 0.0, "is_metal": False, "is_stable": True,
        "volume": 20.1, "nsites": 2,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
    {
        "material_id": "mp-t0003", "formula_pretty": "GaAs", "elements": "['Ga', 'As']",
        "band_gap": 0.18, "density": 5.05, "formation_energy_per_atom": -0.45,
        "energy_above_hull": 0.0, "is_metal": False, "is_stable": True,
        "volume": 44.7, "nsites": 2,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
    {
        "material_id": "mp-t0004", "formula_pretty": "ZnTe", "elements": "['Zn', 'Te']",
        "band_gap": 2.26, "density": 5.63, "formation_energy_per_atom": -0.51,
        "energy_above_hull": 0.0, "is_metal": False, "is_stable": True,
        "volume": 51.2, "nsites": 2,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
    {
        "material_id": "mp-t0005", "formula_pretty": "InSb", "elements": "['In', 'Sb']",
        "band_gap": 0.0, "density": 5.78, "formation_energy_per_atom": -0.30,
        "energy_above_hull": 0.01, "is_metal": True, "is_stable": False,
        "volume": 62.4, "nsites": 2,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
    {
        "material_id": "mp-t0006", "formula_pretty": "MgO", "elements": "['Mg', 'O']",
        "band_gap": 5.90, "density": 3.58, "formation_energy_per_atom": -2.99,
        "energy_above_hull": 0.0, "is_metal": False, "is_stable": True,
        "volume": 18.9, "nsites": 2,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
    {
        "material_id": "mp-t0007", "formula_pretty": "NaCl", "elements": "['Na', 'Cl']",
        "band_gap": 6.50, "density": 2.17, "formation_energy_per_atom": -1.87,
        "energy_above_hull": 0.0, "is_metal": False, "is_stable": True,
        "volume": 43.8, "nsites": 2,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
    {
        # Empty band_gap exercises NaN -> JSON null handling.
        "material_id": "mp-t0008", "formula_pretty": "Fe2O3", "elements": "['Fe', 'O']",
        "band_gap": None, "density": 5.24, "formation_energy_per_atom": -2.46,
        "energy_above_hull": 0.0, "is_metal": False, "is_stable": True,
        "volume": 50.3, "nsites": 5,
        "fields_not_requested": "['structure', 'tasks']", "unavailable_fields": "[]",
    },
]


@pytest.fixture(scope="session")
def sample_csv(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A tiny local corpus mirroring data/raw/materials_sample.csv columns."""
    path = tmp_path_factory.mktemp("corpus") / "materials_sample.csv"
    pd.DataFrame(SAMPLE_ROWS).to_csv(path, index=False)
    return path


@pytest.fixture()
def engine(sample_csv: Path):
    from src.discovery.engine import MaterialMindDiscovery

    return MaterialMindDiscovery(data_path=sample_csv)
