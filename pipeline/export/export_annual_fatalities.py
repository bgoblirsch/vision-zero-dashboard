import json
from pathlib import Path

from pipeline.connection import get_conn
from pipeline.logger import get_logger

logger = get_logger(__name__)

def export_annual_fatalities(out_dir: Path, min_population: int = 100000):
    query_cities = """
        SELECT places.state_fips, places.place_fips
        FROM census_places places
        JOIN city_stats stats
            ON places.state_fips = stats.state_fips
            AND places.place_fips = stats.place_fips
        WHERE stats.population >= %(min_population)s
           OR places.is_vision_zero = TRUE
    """
    query_by_year = """
        SELECT
            year,
            SUM(total_fatalities)        AS total_fatalities,
            SUM(motorist_fatalities)     AS motorist_fatalities,
            SUM(pedestrian_fatalities)   AS pedestrian_fatalities,
            SUM(cyclist_fatalities)      AS cyclist_fatalities,
            SUM(other_fatalities)        AS other_fatalities
        FROM fars_crashes
        WHERE state = %(state_fips)s
          AND place_fips = %(place_fips)s
        GROUP BY year
        ORDER BY year
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query_cities, {"min_population": min_population})
                cities = cur.fetchall()

            total = len(cities)
            for i, (state_fips, place_fips) in enumerate(cities, 1):
                with conn.cursor() as cur:
                    cur.execute(query_by_year, {"state_fips": state_fips, "place_fips": place_fips})
                    assert cur.description is not None
                    columns = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()

                data = [dict(zip(columns, row)) for row in rows]

                city_dir = out_dir / "cities" / state_fips / place_fips
                city_dir.mkdir(parents=True, exist_ok=True)
                out_path = city_dir / "annual_fatalities.json"
                out_path.write_text(json.dumps(data))

                if i % 50 == 0 or i == total:
                    logger.info("[EXPORT] Annual fatality export progress: %d/%d cities", i, total)

    except Exception as e:
        logger.error("[EXPORT] export_annual_fatalities failed: %s", e)
        raise