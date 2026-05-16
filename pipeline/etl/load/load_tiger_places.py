import time
from pathlib import Path

import geopandas as gpd
from psycopg import Connection

from pipeline.etl.transform.mappings import DISPLAY_NAME_MAP, STATE_FIPS_MAP
from pipeline.connection import get_conn
from pipeline.logger import get_logger
from scripts.load_vision_zero_cities import load_vision_zero_cities


logger = get_logger(__name__)

BATCH_SIZE = 500


def insert_tiger_place(conn: Connection, record: dict) -> bool:
    insert_query = """
        INSERT INTO census_places (
            state_fips,
            place_fips,
            state_name,
            place_name,
            display_name,
            place_type,
            geom,
            point_geom
        )
        VALUES (
            %(state_fips)s,
            %(place_fips)s,
            %(state_name)s,
            %(place_name)s,
            %(display_name)s,
            %(place_type)s,
            ST_SetSRID(ST_GeomFromWKB(%(geom)s), 4326),
            ST_SetSRID(ST_MakePoint(%(intpt_lon)s, %(intpt_lat)s), 4326)
        )
        ON CONFLICT (state_fips, place_fips) DO NOTHING
        RETURNING 1;
    """
    with conn.cursor() as cur:
        cur.execute(insert_query, record)
        return cur.fetchone() is not None


def load_tiger_place_features(conn: Connection, gdf: gpd.GeoDataFrame) -> tuple[int, int, int]:
    insert_count = 0
    skip_count = 0
    error_count = 0

    batch_processed = 0
    batch_inserted = 0
    batch_skipped = 0
    batch_errors = 0

    for idx, feature in enumerate(gdf.itertuples(), start=1):
        batch_processed += 1
        logger.debug(f"Display name match: {feature.NAME} -> {DISPLAY_NAME_MAP.get(str(feature.NAME))}")
        record = {
            "state_fips": feature.STATEFP,
            "place_fips": feature.PLACEFP,
            "state_name": STATE_FIPS_MAP.get(str(feature.STATEFP)),
            "place_name": feature.NAME,
            "display_name": DISPLAY_NAME_MAP.get(str(feature.NAME), feature.NAME),
            "place_type": feature.LSAD,
            "geom": feature.geometry.wkb,         # type: ignore
            "intpt_lon": float(feature.INTPTLON), # type: ignore
            "intpt_lat": float(feature.INTPTLAT), # type: ignore
            # above warnings are pylance complaints because itertuples loses type info
        }

        try:
            inserted = insert_tiger_place(conn, record)
        except Exception:
            conn.rollback()
            error_count += 1
            batch_errors += 1
            logger.exception(
                f"[LOAD][TIGER] Failed to insert place {feature.NAME} ({feature.STATEFP}/{feature.PLACEFP})"
            )
        else:
            if inserted:
                insert_count += 1
                batch_inserted += 1
            else:
                skip_count += 1
                batch_skipped += 1

            if idx % BATCH_SIZE == 0:
                conn.commit()
                logger.info(
                    "(batch committed) +%s processed | +%s inserted | +%s skipped | +%s errors",
                    batch_processed,
                    batch_inserted,
                    batch_skipped,
                    batch_errors,
                )
                batch_processed = batch_inserted = batch_skipped = batch_errors = 0

    return insert_count, skip_count, error_count


def load_tiger_places(shapefiles: list[Path]) -> tuple[int, int, int]:
    start = time.time()
    logger.info("[LOAD][TIGER] Starting place ingestion...")

    total_inserted = total_skipped = total_errors = 0

    with get_conn() as conn:
        for shp_path in shapefiles:
            logger.info(f"[LOAD][TIGER] Loading {shp_path.name}")
            try:
                gdf = gpd.read_file(shp_path)
                insert_count, skip_count, error_count = load_tiger_place_features(conn, gdf)
                conn.commit()
                total_inserted += insert_count
                total_skipped += skip_count
                total_errors += error_count
                logger.info(
                    f"[LOAD][TIGER] {shp_path.name} — inserted={insert_count}, "
                    f"skipped={skip_count}, errors={error_count}"
                )
            except Exception as e:
                logger.error(f"[TIGER] Failed to load {shp_path.name}: {e}")
                raise

        fix_consolidated_governments(conn)
        fix_city_point_locations(conn)
        cleanup_boundary_polygons(conn)

    load_vision_zero_cities()

    elapsed = time.time() - start
    logger.info(
        "[LOAD][TIGER] Ingestion complete. inserted=%s | skipped=%s | errors=%s | duration=%.2fs",
        total_inserted, total_skipped, total_errors, elapsed,
    )

    return total_inserted, total_skipped, total_errors


def fix_city_point_locations(conn) -> None:
    logger.info("[TIGER] Applying point geometry overrides...")
    POINT_GEOM_OVERRIDES = [
        # (state_fips, place_fips, lon, lat)
        ("06", "67000", -122.4194, 37.7749)
    ]
    with conn.cursor() as cur:
        for state_fips, place_fips, lon, lat in POINT_GEOM_OVERRIDES:
            cur.execute("""
                UPDATE census_places
                SET point_geom = ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)
                WHERE state_fips = %(state_fips)s
                AND place_fips = %(place_fips)s
            """, {"state_fips": state_fips, "place_fips": place_fips, "lon": lon, "lat": lat})
        conn.commit()
    logger.info("[TIGER] Point geometry overrides applied.")


def cleanup_boundary_polygons(conn) -> None:
    with conn.cursor() as cur:
        # remove Farallon Island from San Francisco boundary
        cur.execute("""
            UPDATE census_places
            SET geom = (
                SELECT geom
                FROM (
                    SELECT (ST_Dump(geom)).geom, ST_Area((ST_Dump(geom)).geom) AS area
                    FROM census_places
                    WHERE state_fips = '06' AND place_fips = '67000'
                ) parts
                ORDER BY area DESC
                LIMIT 1
            )
            WHERE state_fips = '06' AND place_fips = '67000'
        """)
        conn.commit()
    logger.info("[TIGER] City boundaries cleaned up.")


def fix_consolidated_governments(conn) -> None:
    """
    Union balance area geometries with excluded incorporated places
    for consolidated city-county governments.
    """
    logger.info("[TIGER] Fixing consolidated government boundaries...")

    with conn.cursor() as cur:
        # Louisville: union balance area with excluded incorporated places
        cur.execute("""
            UPDATE census_places
            SET 
                geom = (
                    SELECT ST_Union(ARRAY_AGG(geom))
                    FROM census_places
                    WHERE state_fips = '21' 
                    AND place_fips IN (
                        '48006', 
                        '48000', 
                        '40222', 
                        '70284', 
                        '48558', 
                        '01504', 
                        '51978', 
                        '84486', 
                        '02656', 
                        '28342', 
                        '31348', 
                        '56550', 
                        '66486', 
                        '81372',
                        '05392',
                        '22204',
                        '37576',
                        '37630',
                        '42598',
                        '48648',
                        '80913',
                        '81624',
                        '05068',
                        '05464',
                        '10198',
                        '22474',
                        '38814',
                        '50412',
                        '52842',
                        '56928',
                        '69384',
                        '74082',
                        '32523',
                        '38170',
                        '38818',
                        '07858',
                        '31402',
                        '39304',
                        '56730',
                        '57658',
                        '65208',
                        '65766',
                        '84576'
                    )
                ),
                point_geom = (
                    SELECT point_geom
                    FROM census_places
                    WHERE state_fips = '21' AND place_fips = '48000'
                )
            WHERE state_fips = '21' AND place_fips = '48006'
        """)
        conn.commit()
    logger.info("[TIGER] Consolidated government boundaries fixed.")