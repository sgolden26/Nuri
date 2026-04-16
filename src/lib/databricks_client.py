from databricks import sql
import pandas as pd

# Marketplace: Dotlas restaurants in the United States (Unity Catalog 3-part name)
DOTLAS_RESTAURANTS_TABLE = (
    "dotlas_restaurants_in_the_united_states.samples.us_restaurants"
)


class DatabricksClient:
    def __init__(self, server_hostname, http_path, access_token):
        self.server_hostname = server_hostname
        self.http_path = http_path
        self.access_token = access_token

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

    def get_dotlas_restaurants(self, limit: int = 1000) -> pd.DataFrame:
        """Pull the Dotlas US restaurants Marketplace dataset."""
        return self.get_table_sample(DOTLAS_RESTAURANTS_TABLE, limit)


if __name__ == "__main__":
    import os
    import sys

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