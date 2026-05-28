import json
from collections import defaultdict
from pathlib import Path
from connection import get_conn
from logger import get_logger

logger = get_logger(__name__)

def _serialize(val):
    """Handle date serialization for JSON."""
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return val

def export_crashes(out_dir: Path, min_population: int = 100000):
    query_cities = """
        SELECT places.state_fips, places.place_fips
        FROM census_places places
        JOIN city_stats stats
            ON places.state_fips = stats.state_fips
            AND places.place_fips = stats.place_fips
        WHERE stats.population >= %(min_population)s
           OR places.is_vision_zero = TRUE
    """
    query_crashes = """
        SELECT
            ST_X(location) AS lon,
            ST_Y(location) AS lat,
            st_case,
            year,
            crash_date,
            state_name,
            fars_city_name,
            fips_city_name,
            road_label,
            total_fatalities,
            motorist_fatalities,
            pedestrian_fatalities,
            cyclist_fatalities,
            other_fatalities
        FROM fars_crashes
        WHERE year >= 2001
          AND location IS NOT NULL
          AND state = %(state_fips)s
          AND place_fips = %(place_fips)s
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
                    cur.execute(query_crashes, {"state_fips": state_fips, "place_fips": place_fips})
                    assert cur.description is not None
                    columns = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()

                # Partition by year in Python — one DB round trip per city
                by_year = defaultdict(list)
                for row in rows:
                    record = {col: _serialize(val) for col, val in zip(columns, row)}
                    by_year[record["year"]].append(record)

                city_dir = out_dir / "crashes" / state_fips / place_fips
                city_dir.mkdir(parents=True, exist_ok=True)
                for year, points in by_year.items():
                    out_path = city_dir / f"{year}.json"
                    out_path.write_text(json.dumps(points))

                if i % 50 == 0 or i == total:
                    logger.info("[EXPORT] Crash export progress: %d/%d cities", i, total)

    except Exception as e:
        logger.error("[EXPORT] export_crashes failed: %s", e)
        raise