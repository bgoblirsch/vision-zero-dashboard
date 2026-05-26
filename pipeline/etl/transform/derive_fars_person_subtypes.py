import time
from psycopg import Connection

from pipeline.logger import get_logger
from pipeline.connection import get_conn

logger = get_logger(__name__)

BATCH_SIZE: int = 100000

# FARS person_type codes
MOTORIST_CODES    = {1, 2, 3, 9}
PEDESTRIAN_CODES  = {5, 10}
CYCLIST_CODES     = {6, 7}
OTHER_CODES       = {4, 8, 11, 12, 13, 19, 99}

FATAL_SEVERITY = 4


def classify_person_type(person_type: int) -> str | None:
    """
    Map a FARS person_type code to a fatality subtype bucket.
    Returns None for unrecognized codes (logged as warnings upstream).
    """
    if person_type in MOTORIST_CODES:
        return "motorist"
    if person_type in PEDESTRIAN_CODES:
        return "pedestrian"
    if person_type in CYCLIST_CODES:
        return "cyclist"
    if person_type in OTHER_CODES:
        return "other"
    return None


def count_fatalities_by_type(conn: Connection, crash_id: int) -> dict:
    """
    Query fars_persons for a given crash_id and return fatality counts
    broken down by subtype. Only counts rows where injury_severity = 4 (fatal).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT person_type, COUNT(*) 
            FROM fars_persons
            WHERE crash_id = %s AND injury_severity = %s
            GROUP BY person_type
            """,
            (crash_id, FATAL_SEVERITY),
        )
        rows = cur.fetchall()

    counts = {"motorist": 0, "pedestrian": 0, "cyclist": 0, "other": 0}

    for person_type_code, count in rows:
        bucket = classify_person_type(person_type_code)
        if bucket is None:
            logger.warning(
                "Unrecognized person_type code %s for crash_id %s — excluded from subtype counts",
                person_type_code,
                crash_id,
            )
        else:
            counts[bucket] += count

    return counts


def update_crash_subtypes(conn: Connection, crash_id: int, counts: dict) -> None:
    """
    Write subtype fatality counts back to fars_crashes for a given crash_id.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE fars_crashes
            SET
                motorist_fatalities    = %(motorist)s,
                pedestrian_fatalities  = %(pedestrian)s,
                cyclist_fatalities     = %(cyclist)s,
                other_fatalities       = %(other)s
            WHERE crash_id = %(crash_id)s
            """,
            {**counts, "crash_id": crash_id},
        )


def derive_crash_subtypes(conn: Connection, years: list[int] | None = None) -> tuple[int, int]:
    """
    For the specified year(s) (orr every crash in fars_crashes if years is omitted),
    compute subtype fatality counts from fars_persons and write them back. 
    Processes in batches of BATCH_SIZE.

    Returns:
        (updated_count, error_count)
    """
    if years is not None:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT crash_id FROM fars_crashes WHERE year = ANY(%s) ORDER BY crash_id",
                (years,)
            )
            crash_ids = [row[0] for row in cur.fetchall()]
    else:
        with conn.cursor() as cur:
            cur.execute("SELECT crash_id FROM fars_crashes ORDER BY crash_id")
            crash_ids = [row[0] for row in cur.fetchall()]

    total = len(crash_ids)
    updated_count = 0
    error_count = 0

    logger.info("[FARS] Deriving subtype counts for %s crashes", total)

    for idx, crash_id in enumerate(crash_ids, start=1):
        try:
            counts = count_fatalities_by_type(conn, crash_id)
            update_crash_subtypes(conn, crash_id, counts)
            updated_count += 1
        except Exception:
            conn.rollback()
            error_count += 1
            logger.exception(
                "[FARS] Failed to derive subtypes for crash_id=%s", crash_id
            )

        if idx % BATCH_SIZE == 0:
            conn.commit()
            logger.info(
                "[FARS] %s / %s processed | updated=%s errors=%s",
                idx, total, updated_count, error_count,
            )

    conn.commit()
    return updated_count, error_count


def run_derive_fars_subtypes(years: list[int] | None = None) -> None:
    """
    Entry point for the person subtype derivation step.
    Optionally scoped to a single year for incremental runs.
    """
    start = time.time()
    logger.info("[FARS] Starting subtype derivation (years=%s)", years or "all")

    with get_conn() as conn:
        updated, errors = derive_crash_subtypes(conn, years)

    elapsed = time.time() - start
    logger.info(
        "[FARS] Person subtype derivation complete. updated=%s errors=%s duration=%.2fs",
        updated, errors, elapsed,
    )