import time
from psycopg import Connection

from pipeline.logger import get_logger
from pipeline.connection import get_conn

logger = get_logger(__name__)


def derive_city_stats(conn: Connection) -> tuple[int, int]:
    """
    Compute aggregate fatality stats for each city in city_stats and write
    them back. Requires fars_crashes to be fully loaded and subtype-derived.

    Stats computed:
    - avg_fatalities_5yr: average annual total fatalities over the 5 most recent years
    - avg_per_100k_5yr: avg_fatalities_5yr / population * 100,000
    - trend_pct: linear regression slope of per-100k rate over the 5 most recent years
                 (negative = improving, positive = worsening)

    Returns:
        (updated_count, error_count)
    """
    query = """
        WITH ten_years AS (
            SELECT year
            FROM fars_crashes
            GROUP BY year
            ORDER BY year DESC
            LIMIT 10
        ),
        recent_years AS (
            SELECT year FROM ten_years
            ORDER BY year DESC
            LIMIT 5
        ),
        prev_years AS (
            SELECT year FROM ten_years
            ORDER BY year ASC
            LIMIT 5
        ),
        city_annual AS (
            SELECT
                fc.state,
                fc.place_fips,
                fc.year,
                SUM(fc.total_fatalities)      AS fatalities,
                SUM(fc.pedestrian_fatalities) AS ped_fatalities,
                SUM(fc.cyclist_fatalities)    AS cyc_fatalities,
                SUM(fc.motorist_fatalities 
                    + COALESCE(fc.other_fatalities, 0)) AS mot_fatalities
            FROM fars_crashes fc
            WHERE fc.year IN (SELECT year FROM ten_years)
              AND fc.place_fips IS NOT NULL
            GROUP BY fc.state, fc.place_fips, fc.year
        ),
        city_stats_computed AS (
            SELECT
                ca.state,
                ca.place_fips,
                -- current 5yr avgs
                AVG(ca.fatalities)     FILTER (WHERE ca.year IN (SELECT year FROM recent_years)) AS avg_fatalities_5yr,
                AVG(ca.ped_fatalities) FILTER (WHERE ca.year IN (SELECT year FROM recent_years)) AS avg_5yr_pedestrian,
                AVG(ca.cyc_fatalities) FILTER (WHERE ca.year IN (SELECT year FROM recent_years)) AS avg_5yr_cyclist,
                AVG(ca.mot_fatalities) FILTER (WHERE ca.year IN (SELECT year FROM recent_years)) AS avg_5yr_motorist,
                -- per capita current
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.fatalities::numeric / cs.population * 100000)     FILTER (WHERE ca.year IN (SELECT year FROM recent_years))
                END AS avg_per_100k_5yr,
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.ped_fatalities::numeric / cs.population * 100000) FILTER (WHERE ca.year IN (SELECT year FROM recent_years))
                END AS avg_per_100k_pedestrian,
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.cyc_fatalities::numeric / cs.population * 100000) FILTER (WHERE ca.year IN (SELECT year FROM recent_years))
                END AS avg_per_100k_cyclist,
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.mot_fatalities::numeric / cs.population * 100000) FILTER (WHERE ca.year IN (SELECT year FROM recent_years))
                END AS avg_per_100k_motorist,
                -- prev 5yr per capita avgs
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.fatalities::numeric / cs.population * 100000)     FILTER (WHERE ca.year IN (SELECT year FROM prev_years))
                END AS prev_per_100k_5yr,
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.ped_fatalities::numeric / cs.population * 100000) FILTER (WHERE ca.year IN (SELECT year FROM prev_years))
                END AS prev_per_100k_pedestrian,
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.cyc_fatalities::numeric / cs.population * 100000) FILTER (WHERE ca.year IN (SELECT year FROM prev_years))
                END AS prev_per_100k_cyclist,
                CASE WHEN cs.population > 0 THEN
                    AVG(ca.mot_fatalities::numeric / cs.population * 100000) FILTER (WHERE ca.year IN (SELECT year FROM prev_years))
                END AS prev_per_100k_motorist
            FROM city_annual ca
            JOIN city_stats cs
                ON cs.state_fips = ca.state
                AND cs.place_fips = ca.place_fips
                AND cs.population > 0
            GROUP BY ca.state, ca.place_fips, cs.population
        )
        UPDATE city_stats
        SET
            avg_fatalities_5yr     = csc.avg_fatalities_5yr,
            avg_5yr_pedestrian     = csc.avg_5yr_pedestrian,
            avg_5yr_cyclist        = csc.avg_5yr_cyclist,
            avg_5yr_motorist       = csc.avg_5yr_motorist,
            avg_per_100k_5yr       = csc.avg_per_100k_5yr,
            avg_per_100k_pedestrian = csc.avg_per_100k_pedestrian,
            avg_per_100k_cyclist   = csc.avg_per_100k_cyclist,
            avg_per_100k_motorist  = csc.avg_per_100k_motorist,
            trend_pct_change       = CASE WHEN csc.prev_per_100k_5yr > 0 THEN
                                        ROUND((csc.avg_per_100k_5yr - csc.prev_per_100k_5yr) / csc.prev_per_100k_5yr * 100, 1)
                                     END,
            trend_pct_change_pedestrian = CASE WHEN csc.prev_per_100k_pedestrian > 0 THEN
                                           ROUND((csc.avg_per_100k_pedestrian - csc.prev_per_100k_pedestrian) / csc.prev_per_100k_pedestrian * 100, 1)
                                          END,
            trend_pct_change_cyclist    = CASE WHEN csc.prev_per_100k_cyclist > 0 THEN
                                           ROUND((csc.avg_per_100k_cyclist - csc.prev_per_100k_cyclist) / csc.prev_per_100k_cyclist * 100, 1)
                                          END,
            trend_pct_change_motorist   = CASE WHEN csc.prev_per_100k_motorist > 0 THEN
                                           ROUND((csc.avg_per_100k_motorist - csc.prev_per_100k_motorist) / csc.prev_per_100k_motorist * 100, 1)
                                          END
        FROM city_stats_computed csc
        WHERE city_stats.state_fips = csc.state
        AND city_stats.place_fips = csc.place_fips
    """

    try:
        with conn.cursor() as cur:
            cur.execute(query)
            updated_count = cur.rowcount
        conn.commit()
        return updated_count, 0
    except Exception:
        conn.rollback()
        logger.exception("[FARS] derive_city_stats failed")
        return 0, 1


def run_derive_city_stats() -> None:
    start = time.time()
    logger.info("[PIPELINE][TRANSFORM] Deriving city stats.")

    with get_conn() as conn:
        updated, errors = derive_city_stats(conn)

    elapsed = time.time() - start
    logger.info(
        "[PIPELINE][TRANSFORM] Finished deriving city stats. updated=%s errors=%s duration=%.2fs",
        updated, errors, elapsed,
    )