import json
from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row
from connection import get_conn

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("")
def get_cities(min_population: int = 50000):
    """Return city markers with population for national map view."""
    query = """
        SELECT
            places.place_name,
            places.state_fips,
            places.place_fips,
            pop.state_name,
            pop.population,
            places.is_vision_zero,
            ST_X(places.point_geom) AS lon,
            ST_Y(places.point_geom) AS lat
        FROM census_places places
        JOIN city_populations pop
            ON places.state_fips = pop.state_fips
            AND places.place_fips = pop.place_fips
        WHERE pop.population >= %(min_population)s
            OR places.is_vision_zero = TRUE
        ORDER BY pop.population DESC
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, {"min_population": min_population})
                rows = cur.fetchall()
                return [
                    {
                        "place_name": row[0],
                        "state_fips": row[1],
                        "place_fips": row[2],
                        "state_name": row[3],
                        "population": row[4],
                        "is_vision_zero": row[5],
                        "lon": float(row[6]),
                        "lat": float(row[7]),
                    }
                    for row in rows
                ]
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/{state_fips}/{place_fips}/extent")
def get_city_extent(state_fips: str, place_fips: str):
    """Return bounding box for a given city."""
    query = """
        SELECT
            ST_XMin(ST_Extent(geom)) AS min_lon,
            ST_YMin(ST_Extent(geom)) AS min_lat,
            ST_XMax(ST_Extent(geom)) AS max_lon,
            ST_YMax(ST_Extent(geom)) AS max_lat
        FROM census_places
        WHERE state_fips = %(state_fips)s
          AND place_fips = %(place_fips)s
        GROUP BY state_fips, place_fips
    """
    try:
        with get_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(query, {"state_fips": state_fips, "place_fips": place_fips})
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Place not found")
                return row
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/{state_fips}/{place_fips}/boundary")
def get_city_boundary(state_fips: str, place_fips: str):
    """Return a given city's boundary."""
    query = """
        SELECT
            place_name,
            state_fips,
            place_fips,
            ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001)) AS geom
        FROM census_places
        WHERE state_fips = %(state_fips)s
          AND place_fips = %(place_fips)s
    """
    try:
        with get_conn() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(query, {"state_fips": state_fips, "place_fips": place_fips})
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="City not found")
                return {
                    "place_name": row["place_name"],
                    "state_fips": row["state_fips"],
                    "place_fips": row["place_fips"],
                    "geom": json.loads(row["geom"]),
                }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))