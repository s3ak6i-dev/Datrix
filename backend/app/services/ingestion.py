"""
Handles file ingestion: format detection, reading, schema inference.
Supports CSV, JSON, JSONL, Parquet, Excel.
"""
from pathlib import Path
import polars as pl


DTYPE_MAP = {
    pl.Int8: "integer", pl.Int16: "integer", pl.Int32: "integer", pl.Int64: "integer",
    pl.UInt8: "integer", pl.UInt16: "integer", pl.UInt32: "integer", pl.UInt64: "integer",
    pl.Float32: "float", pl.Float64: "float",
    pl.Boolean: "boolean",
    pl.Utf8: "string", pl.String: "string",
    pl.Date: "date", pl.Datetime: "datetime",
    pl.List: "list", pl.Struct: "struct",
}


def read_file(path: Path) -> pl.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pl.read_csv(path, infer_schema_length=10000, try_parse_dates=True, ignore_errors=True)
    if suffix in (".json", ".jsonl"):
        try:
            return pl.read_ndjson(path)
        except Exception:
            return pl.read_json(path)
    if suffix == ".parquet":
        return pl.read_parquet(path)
    if suffix in (".xlsx", ".xls"):
        import pandas as pd
        pdf = pd.read_excel(path)
        return pl.from_pandas(pdf)
    raise ValueError(f"Unsupported file format: {suffix}")


def infer_schema(df: pl.DataFrame) -> list[dict]:
    schema = []
    for name, dtype in df.schema.items():
        base = type(dtype)
        mapped = DTYPE_MAP.get(base, str(dtype))
        schema.append({
            "name": name,
            "dtype": mapped,
            "nullable": df[name].null_count() > 0,
        })
    return schema
