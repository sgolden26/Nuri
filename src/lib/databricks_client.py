from __future__ import annotations

from databricks import sql
import pandas as pd

# Marketplace: Dotlas restaurants in the United States (Unity Catalog 3-part name)
DOTLAS_RESTAURANTS_TABLE = (
    "dotlas_restaurants_in_the_united_states.samples.us_restaurants"
)


def _sql_string_literal(value: str) -> str:
    """Single-quoted SQL literal; doubles embedded quotes."""
    return "'" + value.replace("'", "''") + "'"


def _normalize_server_hostname(host: str) -> str:
    """Strip whitespace and optional https:// prefix (connector expects hostname only)."""
    h = host.strip()
    if h.lower().startswith("https://"):
        h = h[8:]
    elif h.lower().startswith("http://"):
        h = h[7:]
    return h.rstrip("/")


class DatabricksClient:
    def __init__(self, server_hostname, http_path, access_token):
        self.server_hostname = _normalize_server_hostname(server_hostname)
        self.http_path = (http_path or "").strip()
        self.access_token = (access_token or "").strip()

    def query(self, query: str) -> pd.DataFrame:
        """Run a SQL query and return results as a Pandas DataFrame"""
        with sql.connect(
            server_hostname=self.server_hostname,
            http_path=self.http_path,
            access_token=self.access_token,
        ) as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                result = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description]

        return pd.DataFrame(result, columns=columns)

    def get_table_sample(self, table_name: str, limit: int = 1000) -> pd.DataFrame:
        query = f"SELECT * FROM {table_name} LIMIT {limit}"
        return self.query(query)

    def get_dotlas_restaurants(
        self, limit: int | None = 1000, city: str | None = None
    ) -> pd.DataFrame:
        """Pull the Dotlas US restaurants Marketplace dataset.

        If ``city`` is set (e.g. ``"San Francisco"``), only rows matching that
        city (case-insensitive) are returned. Pass ``limit=None`` for no SQL
        ``LIMIT`` (all matching rows). With a city filter, ``limit`` caps how
        many rows are returned.

        If ``city`` is omitted, you must pass a positive ``limit`` (random US
        sample); a full scan of the US table is not allowed.
        """
        if city is None:
            if limit is None:
                raise ValueError(
                    "When city is None, pass a positive limit (full US table is too large)."
                )
            return self.get_table_sample(DOTLAS_RESTAURANTS_TABLE, limit)

        lit = _sql_string_literal(city)
        where = f"WHERE LOWER(TRIM(city)) = LOWER(TRIM({lit}))"
        limit_sql = f" LIMIT {int(limit)}" if limit is not None else ""
        query = f"SELECT * FROM {DOTLAS_RESTAURANTS_TABLE} {where}{limit_sql}"
        return self.query(query)


if __name__ == "__main__":
    import os
    import sys
    from pathlib import Path

    from dotenv import load_dotenv

    _root = Path(__file__).resolve().parents[2]
    load_dotenv(_root / ".env", override=True)

    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    host = os.environ.get("DATABRICKS_HOST")
    http_path = os.environ.get("DATABRICKS_HTTP_PATH")
    token = os.environ.get("DATABRICKS_TOKEN")
    if not host or not http_path or not token:
        print(
            "Set environment variables: DATABRICKS_HOST, DATABRICKS_HTTP_PATH, "
            "DATABRICKS_TOKEN",
            file=sys.stderr,
        )
        sys.exit(1)
    df = DatabricksClient(host, http_path, token).get_dotlas_restaurants(limit=limit)
    print(df.to_string())
    print(f"\nRows: {len(df)}", file=sys.stderr)