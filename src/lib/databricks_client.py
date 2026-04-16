from __future__ import annotations

import os
import re

from databricks import sql
import pandas as pd

# Default 3-part name (may not exist until the Marketplace listing is installed).
# Override with env DOTLAS_RESTAURANTS_TABLE or pass dotlas_restaurants_table= to the client.
_DEFAULT_DOTLAS_TABLE = (
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
    def __init__(
        self,
        server_hostname,
        http_path,
        access_token,
        dotlas_restaurants_table: str | None = None,
    ):
        self.server_hostname = _normalize_server_hostname(server_hostname)
        self.http_path = (http_path or "").strip()
        self.access_token = (access_token or "").strip()
        _from_arg = (dotlas_restaurants_table or "").strip()
        _from_env = (os.environ.get("DOTLAS_RESTAURANTS_TABLE") or "").strip()
        self.dotlas_restaurants_table = _from_arg or _from_env or _DEFAULT_DOTLAS_TABLE

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

    @staticmethod
    def _raise_if_missing_table(err: Exception, *, table: str) -> None:
        if "TABLE_OR_VIEW_NOT_FOUND" not in str(err):
            raise err
        raise RuntimeError(
            "Unity Catalog could not find that table. Set the real 3-part name: "
            "(1) In the notebook setup cell, set _DOTLAS_FROM_NOTEBOOK = 'catalog.schema.table', "
            "or (2) In .env, use DOTLAS_RESTAURANTS_TABLE=catalog.schema.table on a line that "
            "does NOT start with # (commented lines are ignored by load_dotenv). "
            f"Attempted table: {table}. Original error: {err}"
        ) from err

    def get_table_sample(self, table_name: str, limit: int = 1000) -> pd.DataFrame:
        query = f"SELECT * FROM {table_name} LIMIT {limit}"
        try:
            return self.query(query)
        except Exception as e:
            self._raise_if_missing_table(e, table=table_name)

    def find_tables_in_information_schema(
        self,
        name_contains: str = "us_restaurant",
        *,
        limit: int = 200,
    ) -> pd.DataFrame:
        """List tables whose name matches ``name_contains`` (Unity Catalog metadata).

        Uses ``system.information_schema.tables``. Requires SQL warehouse access;
        if this fails, use Catalog Explorer in the Databricks UI instead.
        """
        if not re.fullmatch(r"[a-zA-Z0-9_]+", name_contains):
            raise ValueError("name_contains must be letters, digits, or underscore only")
        like = _sql_string_literal(f"%{name_contains}%")
        lim = int(limit)
        query = f"""
        SELECT table_catalog, table_schema, table_name
        FROM system.information_schema.tables
        WHERE table_name ILIKE {like}
        ORDER BY table_catalog, table_schema, table_name
        LIMIT {lim}
        """
        return self.query(query)

    def get_dotlas_restaurants(
        self, limit: int | None = 1000, city: str | None = None
    ) -> pd.DataFrame:
        """Pull the Dotlas US restaurants Marketplace dataset.

        If ``city`` is set (e.g. ``"San Francisco"``), only rows matching that
        city (case-insensitive) are returned. If ``limit`` is ``None``, a cap
        is still applied: ``DOTLAS_DEFAULT_CITY_LIMIT`` (default 25000) to avoid
        timeouts. Pass a positive ``limit`` to override that cap.

        If ``city`` is omitted, you must pass a positive ``limit`` (random US
        sample); a full scan of the US table is not allowed.
        """
        if city is None:
            if limit is None:
                raise ValueError(
                    "When city is None, pass a positive limit (full US table is too large)."
                )
            return self.get_table_sample(self.dotlas_restaurants_table, limit)

        lit = _sql_string_literal(city)
        where = f"WHERE LOWER(TRIM(city)) = LOWER(TRIM({lit}))"
        if limit is not None:
            effective_limit = int(limit)
        else:
            # Unbounded city scans can time out; default cap when limit is omitted.
            effective_limit = int(os.environ.get("DOTLAS_DEFAULT_CITY_LIMIT", "25000"))
        limit_sql = f" LIMIT {effective_limit}"
        query = f"SELECT * FROM {self.dotlas_restaurants_table} {where}{limit_sql}"
        try:
            return self.query(query)
        except Exception as e:
            self._raise_if_missing_table(e, table=self.dotlas_restaurants_table)


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