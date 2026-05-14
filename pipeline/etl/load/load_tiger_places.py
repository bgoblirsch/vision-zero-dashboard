import time
from pathlib import Path

import geopandas as gpd
from psycopg import Connection

from pipeline.connection import get_conn
from pipeline.logger import get_logger

logger = get_logger(__name__)

BATCH_SIZE = 500


def insert_tiger_place(conn: Connection, record: dict) -> bool:
    insert_query = """
        INSERT INTO census_places (
            state_fips,
            place_fips,
            place_name,
            place_type,
            geom
        )
        VALUES (
            %(state_fips)s,
            %(place_fips)s,
            %(place_name)s,
            %(place_type)s,
            ST_SetSRID(ST_GeomFromWKB(%(geom)s), 4326)
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
        record = {
            "state_fips": feature.STATEFP,
            "place_fips": feature.PLACEFP,
            "place_name": feature.NAME,
            "place_type": feature.LSAD,
            "geom": feature.geometry.wkb,
            # above is a pylance complaint because itertuples loses type info and 
            # does not know that feature.geometry is a shapely geometry
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


def ingest_tiger_places(shapefiles: list[Path]) -> tuple[int, int, int]:
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

        with conn.cursor() as cur:
            cur.execute("UPDATE census_places SET centroid = ST_Centroid(geom)")
            conn.commit()
        logger.info("[LOAD][TIGER] Centroids computed.")

    elapsed = time.time() - start
    logger.info(
        "[LOAD][TIGER] Ingestion complete. inserted=%s | skipped=%s | errors=%s | duration=%.2fs",
        total_inserted, total_skipped, total_errors, elapsed,
    )

    return total_inserted, total_skipped, total_errors