import csv
import time
from pathlib import Path
from psycopg import Connection

from pipeline.logger import get_logger
from pipeline.connection import get_conn

logger = get_logger(__name__)

BATCH_SIZE: int = 5000

def assemble_fars_person(
    person_row: dict,
    crash_id: int,
    file_year: int,
) -> dict:
    return {
        "crash_id": crash_id,
        "crash_year": file_year,
        "vehicle_number": int(person_row["VEH_NO"]),
        "person_number": int(person_row["PER_NO"]),
        "person_age": int(person_row["AGE"]),
        "sex": int(person_row["SEX"]),
        "person_type": int(person_row["PER_TYP"]),
        "injury_severity": int(person_row["INJ_SEV"]),
        "location_code": int(person_row["LOCATION"]),
    }


def load_crash_id_map(conn: Connection, year: int) -> dict[int, int]:
    """
    Map ST_CASE → crash_id for a given year.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT st_case, crash_id
            FROM fars_crashes
            WHERE year = %s
            """,
            (year,),
        )
        return {st_case: crash_id for st_case, crash_id in cur.fetchall()}


def insert_fars_person(conn: Connection, record: dict) -> bool:
    query = """
        INSERT INTO fars_persons (
            crash_id,
            crash_year,
            vehicle_number,
            person_number,
            person_age,
            sex,
            person_type,
            injury_severity,
            location_code
        )
        VALUES (
            %(crash_id)s,
            %(crash_year)s,
            %(vehicle_number)s,
            %(person_number)s,
            %(person_age)s,
            %(sex)s,
            %(person_type)s,
            %(injury_severity)s,
            %(location_code)s
        )
        ON CONFLICT (crash_id, vehicle_number, person_number) DO NOTHING
        RETURNING 1;
    """
    try:
        with conn.cursor() as cur:
            cur.execute(query, record)
            return cur.fetchone() is not None
    except Exception:
        raise

def load_fars_persons_rows(
        conn: Connection, 
        reader:csv.DictReader, 
        file_year: int,
        crash_id_map: dict[int, int]
) -> tuple[int, int, int]:
    
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

        st_case = int(row["ST_CASE"])
        crash_id = crash_id_map.get(st_case)
        if crash_id is None:
            logger.warning(
                "[FARS] %s | Skipping person row %d — ST_CASE %d not found in crashes",
                file_year, idx, st_case,
            )
            skip_count += 1
            batch_skipped += 1
            continue

        record = assemble_fars_person(
                    file_year=file_year,
                    person_row=row,
                    crash_id=crash_id,
        )
        try:
            inserted = insert_fars_person(conn, record)
        except Exception:
            conn.rollback()
            for key, value in record.items():
                if isinstance(value, str):
                    logger.debug("FIELD %s len=%d value=%r", key, len(value), value)
            error_count += 1
            batch_errors += 1
            logger.exception(
                f"[FARS] {file_year} | Failed to insert row {idx} "
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
    

def load_fars_person_year(file_path: Path, year: int) -> tuple[int, int, int]:
    start = time.time()
    logger.info(f"[FARS] Loading {year} {file_path.name}")

    try:
        with open(
            file_path,
            newline="",
            encoding="utf-8-sig",
            errors="replace",
        ) as csvfile:
            reader = csv.DictReader(csvfile)

            with get_conn() as conn:
                crash_id_map = load_crash_id_map(conn, year)
                insert_count, skip_count, error_count = load_fars_persons_rows(
                    conn=conn, 
                    reader=reader, 
                    file_year=year,
                    crash_id_map=crash_id_map)
                conn.commit()
    except Exception as e:
        logger.error(f"[FARS] {year} load failed: {e}")
        raise
    else:
        elapsed = time.time() - start
        logger.info(
            f"[FARS] Completed loading {year}. "
            f"Inserted={insert_count}, skipped={skip_count}, errors={error_count}, "
            f"duration={elapsed:.2f}s"
        )
        return insert_count, skip_count, error_count