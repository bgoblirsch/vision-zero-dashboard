import json

from fastapi import APIRouter, HTTPException
from connection import get_conn

router = APIRouter(prefix="/places", tags=["places"])


@router.get("")
def get_places():
    """Return census place boundaries for map rendering."""
    query = """
        SELECT
            cp.place_name,
            cp.state_fips,
            cp.place_type,
            ST_AsGeoJSON(ST_SimplifyPreserveTopology(cp.geom, 0.001)) AS geom
        FROM census_places cp
        JOIN city_populations pop
            ON cp.state_fips = pop.state_fips
            AND cp.place_fips = pop.place_fips
        WHERE pop.population >= 30000
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
                return [
                    {
                        "place_name": row[0],
                        "state_fips": row[1],
                        "place_type": row[2],
                        "geom": json.loads(row[3]),
                    }
                    for row in rows
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cities")
def get_cities(min_population: int = 25000):
    """Return city markers with population for national map view."""
    query = """
        SELECT
            cp.place_name,
            cp.state_fips,
            cp.place_fips,
            pop.state_name,
            pop.population,
            ST_X(cp.centroid) AS lon,
            ST_Y(cp.centroid) AS lat
        FROM census_places cp
        JOIN city_populations pop
            ON cp.state_fips = pop.state_fips
            AND cp.place_fips = pop.place_fips
        WHERE pop.population >= %(min_population)s
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
                        "lon": float(row[5]),
                        "lat": float(row[6]),
                    }
                    for row in rows
                ]
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


