import time

from pipeline.connection import get_conn
from pipeline.logger import get_logger

logger = get_logger(__name__)


def enrich_crash_locations() -> None:
    """
    Spatially join fars_crashes against census_places to fill in city_name
    for crashes where FARS recorded no city (Rural / Not Applicable) but
    GPS coordinates fall within a Census place boundary.
    """
    query = """
        UPDATE fars_crashes fc
        SET fips_city_name = places.display_name,
            place_fips = places.place_fips
        FROM census_places places
        WHERE ST_Within(fc.location, places.geom)
          AND fc.location IS NOT NULL
    """

    start = time.time()
    logger.info("[ENRICH] Starting crash location enrichment...")

    with get_conn() as conn:
        with conn.cursor() as cur:
            logger.info("[ENRICH] Assigning display_name and place_fips to fars_crashes that lie within census_places boundaries.")
            cur.execute(query)
            fars_crashes_updated = cur.rowcount
            conn.commit()
            logger.info("[ENRICH] place_fips and city_name updated for %s rows", fars_crashes_updated)

    elapsed = time.time() - start
    logger.info("[ENRICH] Completed crash location enrichment. duration=%.2fs", elapsed)