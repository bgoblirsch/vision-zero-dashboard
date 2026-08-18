import json
import time
from pathlib import Path

from psycopg import Connection

from pipeline.logger import get_logger
from pipeline.connection import get_conn

logger = get_logger(__name__)

GRID_SIZE_METERS = 500
BUFFER_SIZE_METERS = 250
HOTSPOT_PERCENTILE_THRESHOLD = 0.85  # top 15% of cells, per city
MIN_YEAR = 2001
OUTPUT_PATH = Path.home() / "Documents/projects/vision-zero-dashboard/exports/hotspots/hotspots.geojson"


def derive_crash_hotspots(conn: Connection) -> dict:
    """
    Bin fatal crashes into a fixed-size grid (in EPSG:5070) per eligible city,
    flag the top-percentile cells per city as hotspots, and emit both a "core"
    polygon (the grid cell itself) and a "buffer" polygon (core cell expanded
    by BUFFER_SIZE_METERS) for each hotspot, tagged via zone_type.

    Eligible cities match the existing export scope: population >= 100k or
    Vision Zero-pledged (per census_places / city_stats).

    Returns:
        A GeoJSON FeatureCollection as a dict.
    """
    query = """
        WITH eligible_cities AS (
            SELECT places.state_fips, places.place_fips
            FROM census_places places
            JOIN city_stats stats
                ON places.state_fips = stats.state_fips
                AND places.place_fips = stats.place_fips
            WHERE stats.population >= 100000
            OR places.is_vision_zero = TRUE
        ),
        crashes_projected_5070 AS (
            SELECT
                fc.crash_id,
                fc.place_fips,
                ST_Transform(fc.location, 5070) AS geom_5070
            FROM fars_crashes fc
            JOIN eligible_cities ec
                ON fc.state = ec.state_fips
                AND fc.place_fips = ec.place_fips
            WHERE fc.year >= %(min_year)s
            AND fc.location IS NOT NULL
        ),
        snapped AS (
            SELECT
                place_fips,
                ST_SnapToGrid(geom_5070, %(grid_size)s) AS cell_origin
            FROM crashes_projected_5070
        ),
        cell_counts AS (
            SELECT
                place_fips,
                cell_origin,
                COUNT(*) AS crash_count
            FROM snapped
            GROUP BY place_fips, cell_origin
        ),
        ranked_cells AS (
            SELECT
                place_fips,
                cell_origin,
                PERCENT_RANK() OVER (
                    PARTITION BY place_fips
                    ORDER BY crash_count
                ) AS pct_rank
            FROM cell_counts
        ),
        hotspot_cells AS (
            SELECT place_fips, cell_origin
            FROM ranked_cells
            WHERE pct_rank >= %(threshold)s
        ),
        cell_geoms AS (
            SELECT
                place_fips,
                ST_MakeEnvelope(
                    ST_X(cell_origin) - %(half_grid)s, ST_Y(cell_origin) - %(half_grid)s,
                    ST_X(cell_origin) + %(half_grid)s, ST_Y(cell_origin) + %(half_grid)s,
                    5070
                ) AS core_geom
            FROM hotspot_cells
        ),
        merged_by_city AS (
            SELECT
                place_fips,
                ST_Union(core_geom) AS core_geom
            FROM cell_geoms
            GROUP BY place_fips
        ),
        zones AS (
            SELECT
                place_fips,
                ST_Transform(core_geom, 4326) AS core_geom_4326,
                ST_Transform(
                    ST_Buffer(core_geom, %(buffer_size)s, 'join=mitre'),
                    4326
                ) AS buffer_geom_4326
            FROM merged_by_city
        ),
        features AS (
            SELECT
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(core_geom_4326, %(precision)s)::json,
                    'properties', json_build_object(
                        'place_fips', place_fips,
                        'zone_type', 'core'
                    )
                ) AS feature
            FROM zones
            UNION ALL
            SELECT
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(buffer_geom_4326, %(precision)s)::json,
                    'properties', json_build_object(
                        'place_fips', place_fips,
                        'zone_type', 'buffer'
                    )
                )
            FROM zones
        )
        SELECT
            json_build_object(
                'type', 'FeatureCollection',
                'features', json_agg(feature)
            ) AS geojson
        FROM features
    """

    params = {
        "min_year": MIN_YEAR,
        "grid_size": GRID_SIZE_METERS,
        "half_grid": GRID_SIZE_METERS / 2,
        "buffer_size": BUFFER_SIZE_METERS,
        "threshold": HOTSPOT_PERCENTILE_THRESHOLD,
        "precision": 5,
    }

    with conn.cursor() as cur:
        cur.execute(query, params)
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("derive_crash_hotspots query returned no rows")
    return row[0]


def run_derive_crash_hotspots() -> None:
    start = time.time()
    logger.info("[PIPELINE][TRANSFORM] Deriving crash hotspots.")

    try:
        with get_conn() as conn:
            geojson = derive_crash_hotspots(conn)

        feature_count = len(geojson.get("features", []))

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w") as f:
            json.dump(geojson, f)

        elapsed = time.time() - start
        logger.info(
            "[PIPELINE][TRANSFORM] Finished deriving crash hotspots. features=%s output=%s duration=%.2fs",
            feature_count, OUTPUT_PATH, elapsed,
        )
    except Exception:
        logger.exception("[FARS] derive_crash_hotspots failed")


if __name__ == "__main__":
    run_derive_crash_hotspots()