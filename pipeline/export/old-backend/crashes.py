from fastapi import APIRouter, HTTPException

from connection import get_conn
from backend.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/crashes", tags=["crashes"])


@router.get("/meta")
def get_crashes_meta():
    """Return metadata about the FARS dataset, including year range."""
    query = """
        SELECT MIN(year) AS min_year, MAX(year) AS max_year
        FROM fars_crashes
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                row = cur.fetchone()
                assert row is not None
                return {"min_year": row[0], "max_year": row[1]}
    except Exception as e:
        logger.error("get_crashes_meta failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/{state_fips}/{place_fips}/by-year")
def get_city_crashes_by_year(state_fips: str, place_fips: str):
    """Return annual crash fatality totals by subtype for a given city."""
    query = """
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
                cur.execute(query, {"state_fips": state_fips, "place_fips": place_fips})
                assert cur.description is not None
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
    except Exception as e:
        logger.error(
            "get_city_crashes_by_year failed for state=%s place=%s: %s",
            state_fips, place_fips, e
        )
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/{state_fips}/{place_fips}")
def get_crash_points(state_fips: str, place_fips: str):
    """Return crash points for a specified city by FIPS code."""
    query = """
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
    """

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, {"state_fips": state_fips, "place_fips": place_fips})
                assert cur.description is not None
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
    except Exception as e:
        logger.error("get_crash_points() failed for state=%s city=%s: %s", state_fips, place_fips, e)
        raise HTTPException(status_code=500, detail=str(e))