import time

from pipeline.connection import get_conn
from pipeline.logger import get_logger

logger = get_logger(__name__)


def enrich_crash_locations() -> int:
    """
    Spatially join fars_crashes against census_places to fill in city_name
    for crashes where FARS recorded no city (Rural / Not Applicable) but
    GPS coordinates fall within a Census place boundary.

    Returns the number of rows updated.
    """
    query = """
        UPDATE fars_crashes fc
        SET city_name = cp.place_name
        FROM census_places cp
        WHERE ST_Within(fc.location, cp.geom)
          AND fc.location IS NOT NULL
          AND (fc.city_name IN ('Unincorporated', 'ERROR') OR fc.city_name is NULL)
    """

    start = time.time()
    logger.info("[ENRICH] Starting crash location enrichment...")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            updated = cur.rowcount
            conn.commit()

    elapsed = time.time() - start
    logger.info(
        "[ENRICH] Complete. updated=%s | duration=%.2fs",
        updated, elapsed,
    )

    return updated