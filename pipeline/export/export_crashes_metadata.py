import json
from pathlib import Path
from connection import get_conn
from logger import get_logger

logger = get_logger(__name__)

def export_crashes_metadata(out_dir: Path):
    query_years = """
        SELECT MIN(year) AS min_year, MAX(year) AS max_year
        FROM fars_crashes
    """

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query_years)
                row = cur.fetchone()
                assert row is not None
                min_year, max_year = row

        meta = {
            "min_year": min_year,
            "max_year": max_year,
        }

        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "crashes_metadata.json"
        out_path.write_text(json.dumps(meta))
        logger.info("[EXPORT] Exported crashes metadata to %s", out_path)

    except Exception as e:
        logger.error("[EXPORT] export_crashes_metadata failed: %s", e)
        raise