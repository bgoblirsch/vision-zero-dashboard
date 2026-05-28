import json
from pathlib import Path
from connection import get_conn
from logger import get_logger

logger = get_logger(__name__)

def export_boundaries(out_dir: Path, min_population: int = 100000):
    query_cities = """
        SELECT places.state_fips, places.place_fips
        FROM census_places places
        JOIN city_stats stats
            ON places.state_fips = stats.state_fips
            AND places.place_fips = stats.place_fips
        WHERE stats.population >= %(min_population)s
           OR places.is_vision_zero = TRUE
    """
    query_boundary = """
        SELECT
            place_name,
            state_fips,
            place_fips,
            ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001)) AS geom
        FROM census_places
        WHERE state_fips = %(state_fips)s
          AND place_fips = %(place_fips)s
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query_cities, {"min_population": min_population})
                cities = cur.fetchall()

            total = len(cities)
            write_count = 0
            for i, (state_fips, place_fips) in enumerate(cities, 1):
                with conn.cursor() as cur:
                    cur.execute(query_boundary, {"state_fips": state_fips, "place_fips": place_fips})
                    row = cur.fetchone()
                    if not row:
                        logger.warning("No boundary found for %s/%s", state_fips, place_fips)
                        continue

                    place_name, state_fips, place_fips, geom_json = row
                    feature = {
                        "type": "Feature",
                        "properties": {
                            "place_name": place_name,
                            "state_fips": state_fips,
                            "place_fips": place_fips,
                        },
                        "geometry": json.loads(geom_json),
                    }

                city_dir = out_dir / "cities" / state_fips / place_fips
                city_dir.mkdir(parents=True, exist_ok=True)
                out_path = city_dir / "boundary.geojson"
                out_path.write_text(json.dumps(feature))
                write_count += 1

            logger.info("[EXPORT] Boundaries exported for %d cities", write_count)

    except Exception as e:
        logger.error("[EXPORT] export_boundaries failed: %s", e)
        raise