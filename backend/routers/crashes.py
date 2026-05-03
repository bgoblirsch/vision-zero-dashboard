from fastapi import APIRouter, HTTPException
from connection import get_conn

router = APIRouter(prefix="/crashes", tags=["crashes"])

@router.get("/cities")
def get_cities():
    """Return a list of distinct cities with crash data."""
    query = """
        SELECT
            city,
            city_name,
            state_name,
            COUNT(*) as total_crashes
        FROM fars_crashes_clean
        WHERE city_name IS NOT NULL
          AND city != 0
        GROUP BY city, city_name, state_name
        HAVING COUNT(*) >= 100
        ORDER BY city_name
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
                return [
                    {
                        "city": row[0],
                        "city_name": row[1],
                        "state_name": row[2],
                    }
                    for row in rows
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/city/{city_id}/by-year")
def get_city_fatalities_by_year(city_id: int):
    """Return total fatal crashes by year for a given city."""
    query = """
        SELECT
            year,
            SUM(total_fatalities) as total_fatalities
        FROM fars_crashes_clean
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