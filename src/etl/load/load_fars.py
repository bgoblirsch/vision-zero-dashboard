import re
import csv
import time
from pathlib import Path
from psycopg import sql
from psycopg import Connection

from logger import get_logger
from db.connection import get_conn
from etl.transform.parse_fars_crash import parse_fars_date, parse_fars_point
from etl.transform.parse_fars_crash import map_route_to_road_type

logger = get_logger(__name__)

BATCH_SIZE: int = 5000

YEAR_RE = re.compile(r"(19|20)\d{2}")

def count_peds(person_rows) -> int:
    '''
    Stub fns for counting number of fatality types in each FARS case.
    
    :param person_rows: person table joined to accident table
    :return: Number of pedestrian fatalities for a particular FARS case.
    :rtype: int
    '''
    return 9

def count_cyclists(person_rows) -> int:
    return 9

def count_motorists(person_rows) -> int:
    return 9

def open_csv_with_fallback(path: Path):
    try:
        return open(path, newline="", encoding="utf-8-sig")
    except UnicodeDecodeError:
        logger.warning(
            "UTF-8 decode failed for %s; falling back to latin-1",
            path.name,
        )
        return open(path, newline="", encoding="latin-1")

def assemble_fars_case(
        crash_row: dict,
        person_rows: list[dict],
        file_year: int,
) -> dict:
    lon, lat = parse_fars_point(crash_row)
    road_type = map_route_to_road_type(crash_row.get("ROUTE"))
    crash_date = parse_fars_date(crash_row)

    return {
        "st_case": crash_row["ST_CASE"],
        "year": file_year,
        "accident_date": crash_date,
        "state": int(crash_row["STATE"]),
        "state_name": crash_row.get("STATENAME"),
        "county": int(crash_row["COUNTY"]),
        "county_name": crash_row.get("COUNTYNAME"),
        "city": int(crash_row["CITY"]),
        "city_name": crash_row.get("CITYNAME"),
        "road_type": road_type,
        "total_fatalities": int(crash_row.get("FATALS", 0)),
        "pedestrian_fatalities": count_peds(person_rows),
        "cyclist_fatalities": count_cyclists(person_rows),
        "motorist_fatalities": count_motorists(person_rows),
        "lat": lat,
        "lon": lon,
    }

def insert_fars_accident(conn: Connection, record: dict) -> bool:
    """
    Inserts a single row from a FARS CSV into the accidents table.
    Parameters:
        record (dict): a dictionary representing one row from the accident csv, 
                       with minor transformations applied. Ready for insertion into DB.
    """

    insert_query = sql.SQL("""
        INSERT INTO accidents (
            st_case, 
            year,
            accident_date, 
            state, 
            state_name,
            county,
            county_name,
            city,
            city_name,
            road_type, 
            total_fatalities, 
            motorist_fatalities, 
            cyclist_fatalities, 
            pedestrian_fatalities, 
            location
        )
        VALUES (
            %(st_case)s,
            %(year)s,
            %(accident_date)s, 
            %(state)s, 
            %(state_name)s,
            %(county)s,
            %(county_name)s,
            %(city)s,
            %(city_name)s,
            %(road_type)s,
            %(total_fatalities)s,
            %(motorist_fatalities)s,
            %(cyclist_fatalities)s,
            %(pedestrian_fatalities)s,
            CASE
                WHEN %(lon)s::double precision IS NULL 
                  OR %(lat)s::double precision IS NULL
                THEN NULL
                ELSE ST_SetSRID(
                    ST_MakePoint(
                        %(lon)s::double precision,
                        %(lat)s::double precision
                    ), 
                    4326
                )
            END
        )
        ON CONFLICT (st_case, year) DO NOTHING
        RETURNING 1;
    """)

    try:
        with conn.cursor() as cur:
            cur.execute(insert_query, record)
            return cur.fetchone() is not None
    except Exception:
        raise


def extract_year_from_path(file_path: Path) -> int:
    '''
    Extracts the first 4-char year from filename.
    
    :param file_path: Description
    :type file_path: Path
    :return: Description
    :rtype: int
    '''
    match = YEAR_RE.search(file_path.name)
    if not match:
        raise ValueError(f"Could not determine year from filename: {file_path.name}")
    return int(match.group())


def load_fars_rows(
        conn: Connection, 
        reader: csv.DictReader, 
        file_year: int
) -> tuple[int, int, int]:
    """
    Insert rows from a FARS CSV reader into the database.

    Returns:
        (insert_count, error_count)
    """
    insert_count = 0
    skip_count = 0
    error_count = 0

    # -- batch deltas --
    batch_processed = 0
    batch_inserted = 0
    batch_skipped = 0
    batch_errors = 0

    for idx, row in enumerate(reader, start=1):
        batch_processed += 1
        record = assemble_fars_case(
                    file_year=file_year,
                    crash_row=row,
                    person_rows = [], #MVP stub !!!
        )
        try:
            inserted = insert_fars_accident(conn, record)
        except Exception:
            conn.rollback()
            for key, value in record.items():
                if isinstance(value, str):
                    logger.debug("FIELD %s len=%d value=%r", key, len(value), value)
            error_count += 1
            batch_errors += 1
            logger.exception(
                f"[FARS_{file_year}] Failed to insert row {idx} "
                f"(ST_CASE={row.get('ST_CASE')})"
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
    
    return insert_count, skip_count, error_count


def load_fars_year(file_path: Path, year: int) -> tuple[int, int, int]:
    """
    Load a single FARS CSV file into the database.
    """
    start = time.time()
    logger.info(f"[FARS_{year}] Loading {file_path.name}")

    try:
        with open(
            file_path,
            newline="",
            encoding="utf-8-sig",
            errors="replace",
        ) as csvfile:
            reader = csv.DictReader(csvfile)

            with get_conn() as conn:
                insert_count, skip_count, error_count = load_fars_rows(conn=conn, reader=reader, file_year=year)
                conn.commit()
    except Exception as e:
        logger.error(f"[FARS_{year}] Load failed: {e}")
        raise
    else:
        elapsed = time.time() - start
        logger.info(
            f"[FARS_{year}] Completed loading. "
            f"Inserted={insert_count}, skipped={skip_count}, errors={error_count}, "
            f"duration={elapsed:.2f}s"
        )
        return insert_count, skip_count, error_count
    