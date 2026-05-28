import json
from pathlib import Path
from connection import get_conn
from logger import get_logger

logger = get_logger(__name__)

def export_cities(out_dir: Path, min_population: int = 100000):
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

        cities = [dict(zip(columns, row)) for row in rows]

        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "cities.json"
        out_path.write_text(json.dumps(cities))
        logger.info("[EXPORT] Exported stats and metrics for %d cities", len(cities))

    except Exception as e:
        logger.error("[EXPORT] export_cities failed: %s", e)
        raise