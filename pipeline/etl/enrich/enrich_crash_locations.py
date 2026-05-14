import time

from pipeline.connection import get_conn
from pipeline.logger import get_logger

logger = get_logger(__name__)


def enrich_crash_locations() -> tuple[int, int]:
    """
    Spatially join fars_crashes against census_places to fill in city_name
    for crashes where FARS recorded no city (Rural / Not Applicable) but
    GPS coordinates fall within a Census place boundary.

    Returns the number of rows updated.
    """
    city_name_query = """
        UPDATE fars_crashes fc
        SET city_name = places.place_name
        FROM census_places places
        WHERE ST_Within(fc.location, places.geom)
          AND fc.location IS NOT NULL
          AND fc.city_name IN ('Unincorporated', 'Not Applicable', 'ERROR')
          OR fc.city_name IS NULL
    """

    place_fips_query = """
        UPDATE fars_crashes fc
        SET place_fips = places.place_fips
        FROM census_places places
        WHERE ST_Within(fc.location, places.geom)
          AND fc.location IS NOT NULL
    """

    start = time.time()
    logger.info("[ENRICH] Starting crash location enrichment...")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(city_name_query)
            city_name_updated = cur.rowcount
            conn.commit()
            logger.info("[ENRICH] city_name updated for %s rows", city_name_updated)

            cur.execute(place_fips_query)
            place_fips_updated = cur.rowcount
            conn.commit()
            logger.info("[ENRICH] place_fips updated for %s rows", place_fips_updated)

    elapsed = time.time() - start
    logger.info("[ENRICH] Complete. duration=%.2fs", elapsed)

    return city_name_updated, place_fips_updated