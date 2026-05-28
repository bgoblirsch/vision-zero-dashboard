import json
from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row

from connection import get_conn
from backend.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("")
def get_cities(min_population: int = 100000):
    """Return cities, their locations, and their stats."""
    query = """
        SELECT
            places.place_name,
            places.display_name,
            places.state_fips,
            places.place_fips,
            stats.state_name,
            stats.population,
            places.is_vision_zero,
            ST_X(places.point_geom) AS lon,
            ST_Y(places.point_geom) AS lat,
            stats.avg_fatalities_5yr,
            stats.avg_5yr_pedestrian,
            stats.avg_5yr_cyclist,
            stats.avg_5yr_motorist,
            stats.avg_per_100k_5yr,
            stats.avg_per_100k_pedestrian,
            stats.avg_per_100k_cyclist,
            stats.avg_per_100k_motorist,
            stats.avg_per_100k_5yr,
            stats.trend_pct_change,
            stats.trend_pct_change_pedestrian,
            stats.trend_pct_change_cyclist,
            stats.trend_pct_change_motorist,
            stats.rank_per_100k_all,
            stats.rank_per_100k_pedestrian_all,
            stats.rank_per_100k_cyclist_all,
            stats.rank_per_100k_motorist_all,
            stats.rank_trend_all,
            stats.rank_trend_pedestrian_all,
            stats.rank_trend_cyclist_all,
            stats.rank_trend_motorist_all,
            stats.pct_per_100k_all,
            stats.pct_per_100k_pedestrian_all,
            stats.pct_per_100k_cyclist_all,
            stats.pct_per_100k_motorist_all,
            stats.pct_trend_all,
            stats.pct_trend_pedestrian_all,
            stats.pct_trend_cyclist_all,
            stats.pct_trend_motorist_all,
            stats.rank_per_100k_vz,
            stats.rank_per_100k_pedestrian_vz,
            stats.rank_per_100k_cyclist_vz,
            stats.rank_per_100k_motorist_vz,
            stats.rank_trend_vz,
            stats.rank_trend_pedestrian_vz,
            stats.rank_trend_cyclist_vz,
            stats.rank_trend_motorist_vz,
            stats.pct_per_100k_vz,
            stats.pct_per_100k_pedestrian_vz,
            stats.pct_per_100k_cyclist_vz,
            stats.pct_per_100k_motorist_vz,
            stats.pct_trend_vz,
            stats.pct_trend_pedestrian_vz,
            stats.pct_trend_cyclist_vz,
            stats.pct_trend_motorist_vz
        FROM census_places places
        JOIN city_stats stats
            ON places.state_fips = stats.state_fips
            AND places.place_fips = stats.place_fips
        WHERE stats.population >= %(min_population)s
            OR places.is_vision_zero = TRUE
        ORDER BY stats.population DESC
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, {"min_population": min_population})
                assert cur.description is not None
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        logger.error("get_cities failed: %s", e)
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
        logger.error("get_city_extent failed | state_id: %s | city_id: %s | %s", state_fips, place_fips, e)
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
        logger.error("get_city_boundary failed | state_id: %s | city_id: %s | %s", state_fips, place_fips, e)
        raise HTTPException(status_code=500, detail=str(e))