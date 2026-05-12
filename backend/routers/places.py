import json

from fastapi import APIRouter, HTTPException
from connection import get_conn

router = APIRouter(prefix="/places", tags=["places"])


@router.get("")
def get_places():
    """Return census place boundaries for map rendering."""
    query = """
        SELECT
            place_name,
            statefp,
            place_type,
            ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.001)) AS geom
        FROM census_places
        WHERE statefp IN ('06', '32')
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
                return [
                    {
                        "place_name": row[0],
                        "statefp": row[1],
                        "place_type": row[2],
                        "geom": json.loads(row[3]),
                    }
                    for row in rows
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))