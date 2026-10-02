import math
import os
import random
import pandas as pd
from dotenv import load_dotenv
from mp_api.client import MPRester

RANDOM_SEED = 42
PAGE_SIZE = 1_000
SAMPLE_SIZE = 10_000

load_dotenv()
api_key = os.getenv("MP_API_KEY")
if not api_key:
    raise RuntimeError("MP_API_KEY is missing. Check your .env file.")

fields = [
    "material_id",
    "formula_pretty",
    "elements",
    "nelements",
    "nsites",
    "volume",
    "density",
    "band_gap",
    "formation_energy_per_atom",
    "energy_above_hull",
    "is_stable",
    "is_metal",
]

with MPRester(api_key) as mpr:
    database_version = mpr.db_version
    active_count = mpr.materials.summary.count(criteria={"deprecated": False})
    page_count = math.ceil(active_count / PAGE_SIZE)
    pages_needed = min(math.ceil(SAMPLE_SIZE / PAGE_SIZE), page_count)
    chosen_pages = sorted(random.Random(RANDOM_SEED).sample(range(page_count), pages_needed))

    docs = []
    for page in chosen_pages:
        docs.extend(
            mpr.materials.summary.search(
                deprecated=False,
                _page=page,
                chunk_size=PAGE_SIZE,
                fields=fields,
            )
        )

df = pd.DataFrame([doc.model_dump() for doc in docs])
os.makedirs("data/raw", exist_ok=True)
df.to_csv("data/raw/materials_sample.csv", index=False)

properties = [
    "density",
    "band_gap",
    "formation_energy_per_atom",
    "energy_above_hull",
]
print(f"Materials Project database version: {database_version}")
print(f"Active summary records: {active_count}")
print(f"Random seed: {RANDOM_SEED}")
print(f"Sampled pages ({PAGE_SIZE} records/page): {chosen_pages}")
print(f"Rows downloaded: {len(df)}")
print(f"Duplicate material IDs: {df['material_id'].duplicated().sum()}")
print(f"Duplicate formulas: {df['formula_pretty'].duplicated().sum()}")
print("\nMissing values:")
print(df[properties].isna().sum())
print("\nDistinct non-missing values:")
print(df[properties].nunique())
print("\nProperty summaries:")
print(df[properties].describe(percentiles=[0.1, 0.25, 0.5, 0.75, 0.9]).round(3))
print("\nBand-gap breakdown:")
print(f"Zero band gaps: {(df['band_gap'] == 0).sum()}")
print(f"Positive band gaps: {(df['band_gap'] > 0).sum()}")
print("\nMetal flag counts:")
print(df["is_metal"].value_counts(dropna=False))
print("\nNumeric property correlations:")
print(df[properties].corr().round(3))
print("\nElement-count distribution:")
print(df["nelements"].value_counts().sort_index())
