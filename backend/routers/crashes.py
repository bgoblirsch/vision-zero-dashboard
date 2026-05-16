from fastapi import APIRouter, HTTPException
from connection import get_conn

router = APIRouter(prefix="/crashes", tags=["crashes"])
    

@router.get("/city/{city_id}/by-year")
def get_city_fatalities_by_year(city_id: int):
    """Return total fatal crashes by year for a given city."""
    query = """
        SELECT
            year,
            SUM(total_fatalities) as total_fatalities
        FROM fars_crashes
        WHERE city = %(city_id)s
        GROUP BY year
        ORDER BY year
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, {"city_id": city_id})
                rows = cur.fetchall()
                return [
                    {
                        "year": row[0],
                        "total_fatalities": row[1],
                    }
                    for row in rows
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/points/{state_fips}/{place_fips}")
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
            city_name,
            road_label,
            total_fatalities
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
                return cur.fetchall()
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))