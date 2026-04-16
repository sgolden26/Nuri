"""
Scratch pad for the Dotlas US restaurants dataset (pandas).

Requires: pip install -r requirements.txt
Env: DATABRICKS_HOST, DATABRICKS_HTTP_PATH, DATABRICKS_TOKEN

Run from repo root:
  python scripts/dotlas_playground.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

# Allow `import databricks_client` without installing the repo as a package
_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env", override=True)
_LIB = _ROOT / "src" / "lib"
if str(_LIB) not in sys.path:
    sys.path.insert(0, str(_LIB))

from databricks_client import DatabricksClient  # noqa: E402

# When CITY is set: ROWS=None loads every matching row (no SQL LIMIT).
# When CITY is None: set ROWS to a number (random US sample).
ROWS = None
CITY = "San Francisco"  # set to None for a random US sample (no city filter)


def load_df():
    host = os.environ.get("DATABRICKS_HOST")
    http_path = os.environ.get("DATABRICKS_HTTP_PATH")
    token = os.environ.get("DATABRICKS_TOKEN")
    if not host or not http_path or not token:
        print(
            "Set DATABRICKS_HOST, DATABRICKS_HTTP_PATH, DATABRICKS_TOKEN",
            file=sys.stderr,
        )
        sys.exit(1)
    client = DatabricksClient(host, http_path, token)
    return client.get_dotlas_restaurants(limit=ROWS, city=CITY)


if __name__ == "__main__":
    df = load_df()

    print(df.head(10))
    print()
    df.info()

    # --- add filters, plots, exports, etc. below ---
    # Example:
    # print(df["column_name"].value_counts())
