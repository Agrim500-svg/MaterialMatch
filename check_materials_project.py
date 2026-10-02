import os
from dotenv import load_dotenv
from mp_api.client import MPRester

load_dotenv()
api_key = os.getenv("MP_API_KEY")

if not api_key:
    raise RuntimeError("MP_API_KEY is missing. Check your .env file.")

with MPRester(api_key) as mpr:
    fields = mpr.materials.summary.available_fields
    print(f"Available summary fields: {len(fields)}")
    print(fields)