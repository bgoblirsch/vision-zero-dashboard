import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
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
            COUNT(*) as total_crashes,
            AVG(ST_Y(location::geometry)) as latitude,
            AVG(ST_X(location::geometry)) as longitude
        FROM fars_crashes
        WHERE city_name IS NOT NULL
          AND city != '0000'
          AND location IS NOT NULL
        GROUP BY city, city_name, state_name
        HAVING COUNT(*) >= 50
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
                        "total_crashes": row[3],
                        "latitude": float(row[4]),
                        "longitude": float(row[5]),
                    }
                    for row in rows
                ]
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
    

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
    

@router.get("/points")
def get_crash_points():
    """Return all crash points >= 2001 with location for map rendering."""
    query = """
        SELECT
            ST_X(location) AS lon,
            ST_Y(location) AS lat,
            CASE WHEN city_name = 'Rural' OR city_name = 'Not Applicable' THEN 1 ELSE 0 END AS is_rural,
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
          AND state IN ('06', '32')
    """

    def generate():
        try:
            with get_conn() as conn:
                with conn.cursor("crash_points_cursor") as cur:
                    print("Executing crash points query...")
                    cur.execute(query)
                    print("Query complete. Streaming data.")
                    yield "["
                    first = True
                    while True:
                        rows = cur.fetchmany(1000)
                        if not rows:
                            break
                        for row in rows:
                            if not first:
                                yield ","
                            yield json.dumps([
                                row[0],  # lon
                                row[1],  # lat
                                row[2],  # is_rural
                                row[3],  # st_case
                                row[4],  # year
                                row[5].isoformat() if row[5] else None,  # crash_date
                                row[6],  # state_name
                                row[7],  # city_name
                                row[8],  # road_label
                                row[9],  # total_fatalities
                            ])
                            first = False
                    yield "]"
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(generate(), media_type="application/json")