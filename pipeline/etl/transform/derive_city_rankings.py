import time
from psycopg import Connection

from pipeline.logger import get_logger
from pipeline.connection import get_conn

logger = get_logger(__name__)


def derive_city_rankings(conn: Connection) -> tuple[int, int]:
    """
    Compute rank and percentile for each dashboard city and write them back
    to city_stats. Must be called after derive_city_stats has committed, as
    it reads the per-capita and trend columns written by that pass.

    Rankings are scoped to dashboard cities only (population >= 50k or VZ).
    Two sets of rankings are computed:
    - _all: among all cities (VZ + >= 50k)
    - _vz:  among VZ cities only (null for non-VZ cities)

    Percentile convention: higher = worse.
    A city at the 90th percentile has a higher fatality rate than 90% of peers.

    Cities with null source metrics (insufficient prior period data) receive
    null rank and percentile for that metric.

    Returns:
        (updated_count, error_count)
    """
    query = """
        WITH dashboard AS (
            SELECT
                cs.state_fips,
                cs.place_fips,
                cs.population,
                cs.avg_per_100k_5yr,
                cs.avg_per_100k_pedestrian,
                cs.avg_per_100k_cyclist,
                cs.avg_per_100k_motorist,
                cs.trend_pct_change,
                cs.trend_pct_change_pedestrian,
                cs.trend_pct_change_cyclist,
                cs.trend_pct_change_motorist,
                cp.is_vision_zero
            FROM city_stats cs
            JOIN census_places cp
                ON cs.state_fips = cp.state_fips
                AND cs.place_fips = cp.place_fips
            WHERE cs.population >= 100000
               OR cp.is_vision_zero = TRUE
        ),
        ranked AS (
            SELECT
                state_fips,
                place_fips,
                is_vision_zero,
                population,

                -- source metrics carried through for null checks in UPDATE
                avg_per_100k_5yr,
                avg_per_100k_pedestrian,
                avg_per_100k_cyclist,
                avg_per_100k_motorist,
                trend_pct_change,
                trend_pct_change_pedestrian,
                trend_pct_change_cyclist,
                trend_pct_change_motorist,

                -- rank: all cities (1 = lowest fatality rate = best)
                CASE WHEN avg_per_100k_5yr IS NOT NULL THEN
                    RANK() OVER (ORDER BY avg_per_100k_5yr ASC NULLS LAST, population DESC)::smallint
                END AS rank_per_100k_all,
                CASE WHEN avg_per_100k_pedestrian IS NOT NULL THEN
                    RANK() OVER (ORDER BY avg_per_100k_pedestrian ASC NULLS LAST, population DESC)::smallint
                END AS rank_per_100k_pedestrian_all,
                CASE WHEN avg_per_100k_cyclist IS NOT NULL THEN
                    RANK() OVER (ORDER BY avg_per_100k_cyclist ASC NULLS LAST, population DESC)::smallint
                END AS rank_per_100k_cyclist_all,
                CASE WHEN avg_per_100k_motorist IS NOT NULL THEN
                    RANK() OVER (ORDER BY avg_per_100k_motorist ASC NULLS LAST, population DESC)::smallint
                END AS rank_per_100k_motorist_all,
                CASE WHEN trend_pct_change IS NOT NULL THEN
                    RANK() OVER (ORDER BY trend_pct_change ASC NULLS LAST, population DESC)::smallint
                END AS rank_trend_all,
                CASE WHEN trend_pct_change_pedestrian IS NOT NULL THEN
                    RANK() OVER (ORDER BY trend_pct_change_pedestrian ASC NULLS LAST, population DESC)::smallint
                END AS rank_trend_pedestrian_all,
                CASE WHEN trend_pct_change_cyclist IS NOT NULL THEN
                    RANK() OVER (ORDER BY trend_pct_change_cyclist ASC NULLS LAST, population DESC)::smallint
                END AS rank_trend_cyclist_all,
                CASE WHEN trend_pct_change_motorist IS NOT NULL THEN
                    RANK() OVER (ORDER BY trend_pct_change_motorist ASC NULLS LAST, population DESC)::smallint
                END AS rank_trend_motorist_all,

                -- percentile: all cities (0 = best, 100 = worst)
                ROUND((PERCENT_RANK() OVER (ORDER BY avg_per_100k_5yr        ASC NULLS LAST) * 100)::numeric, 2) AS pct_per_100k_all,
                ROUND((PERCENT_RANK() OVER (ORDER BY avg_per_100k_pedestrian ASC NULLS LAST) * 100)::numeric, 2) AS pct_per_100k_pedestrian_all,
                ROUND((PERCENT_RANK() OVER (ORDER BY avg_per_100k_cyclist    ASC NULLS LAST) * 100)::numeric, 2) AS pct_per_100k_cyclist_all,
                ROUND((PERCENT_RANK() OVER (ORDER BY avg_per_100k_motorist   ASC NULLS LAST) * 100)::numeric, 2) AS pct_per_100k_motorist_all,
                ROUND((PERCENT_RANK() OVER (ORDER BY trend_pct_change            ASC NULLS LAST) * 100)::numeric, 2) AS pct_trend_all,
                ROUND((PERCENT_RANK() OVER (ORDER BY trend_pct_change_pedestrian ASC NULLS LAST) * 100)::numeric, 2) AS pct_trend_pedestrian_all,
                ROUND((PERCENT_RANK() OVER (ORDER BY trend_pct_change_cyclist    ASC NULLS LAST) * 100)::numeric, 2) AS pct_trend_cyclist_all,
                ROUND((PERCENT_RANK() OVER (ORDER BY trend_pct_change_motorist   ASC NULLS LAST) * 100)::numeric, 2) AS pct_trend_motorist_all,

                -- rank: VZ cities only (null for non-VZ)
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_5yr        ASC NULLS LAST)::smallint
                END AS rank_per_100k_vz,
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_pedestrian ASC NULLS LAST)::smallint
                END AS rank_per_100k_pedestrian_vz,
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_cyclist    ASC NULLS LAST)::smallint
                END AS rank_per_100k_cyclist_vz,
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_motorist   ASC NULLS LAST)::smallint
                END AS rank_per_100k_motorist_vz,
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change            ASC NULLS LAST)::smallint
                END AS rank_trend_vz,
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change_pedestrian ASC NULLS LAST)::smallint
                END AS rank_trend_pedestrian_vz,
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change_cyclist    ASC NULLS LAST)::smallint
                END AS rank_trend_cyclist_vz,
                CASE WHEN is_vision_zero THEN
                    RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change_motorist   ASC NULLS LAST)::smallint
                END AS rank_trend_motorist_vz,

                -- percentile: VZ cities only (null for non-VZ)
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_5yr        ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_per_100k_vz,
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_pedestrian ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_per_100k_pedestrian_vz,
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_cyclist    ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_per_100k_cyclist_vz,
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY avg_per_100k_motorist   ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_per_100k_motorist_vz,
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change            ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_trend_vz,
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change_pedestrian ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_trend_pedestrian_vz,
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change_cyclist    ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_trend_cyclist_vz,
                CASE WHEN is_vision_zero THEN
                    ROUND((PERCENT_RANK() OVER (PARTITION BY is_vision_zero ORDER BY trend_pct_change_motorist   ASC NULLS LAST) * 100)::numeric, 2)
                END AS pct_trend_motorist_vz

            FROM dashboard
        )
        UPDATE city_stats cs
        SET
            rank_per_100k_all     = r.rank_per_100k_all,
            rank_per_100k_pedestrian_all = r.rank_per_100k_pedestrian_all,
            rank_per_100k_cyclist_all = r.rank_per_100k_cyclist_all,
            rank_per_100k_motorist_all = r.rank_per_100k_motorist_all,
            rank_trend_all        = r.rank_trend_all,
            rank_trend_pedestrian_all    = r.rank_trend_pedestrian_all,
            rank_trend_cyclist_all    = r.rank_trend_cyclist_all,
            rank_trend_motorist_all    = r.rank_trend_motorist_all,

            -- null out percentile for cities with null source metric;
            -- NULLS LAST means postgres assigns them a pct value but it
            -- would be meaningless, so it is discarded
            pct_per_100k_all            = CASE WHEN r.avg_per_100k_5yr        IS NOT NULL THEN r.pct_per_100k_all END,
            pct_per_100k_pedestrian_all = CASE WHEN r.avg_per_100k_pedestrian IS NOT NULL THEN r.pct_per_100k_pedestrian_all END,
            pct_per_100k_cyclist_all    = CASE WHEN r.avg_per_100k_cyclist    IS NOT NULL THEN r.pct_per_100k_cyclist_all END,
            pct_per_100k_motorist_all   = CASE WHEN r.avg_per_100k_motorist   IS NOT NULL THEN r.pct_per_100k_motorist_all END,
            pct_trend_all               = CASE WHEN r.trend_pct_change            IS NOT NULL THEN r.pct_trend_all END,
            pct_trend_pedestrian_all    = CASE WHEN r.trend_pct_change_pedestrian IS NOT NULL THEN r.pct_trend_pedestrian_all END,
            pct_trend_cyclist_all       = CASE WHEN r.trend_pct_change_cyclist    IS NOT NULL THEN r.pct_trend_cyclist_all END,
            pct_trend_motorist_all      = CASE WHEN r.trend_pct_change_motorist   IS NOT NULL THEN r.pct_trend_motorist_all END,

            rank_per_100k_vz     = r.rank_per_100k_vz,
            rank_per_100k_pedestrian_vz = r.rank_per_100k_pedestrian_vz,
            rank_per_100k_cyclist_vz = r.rank_per_100k_cyclist_vz,
            rank_per_100k_motorist_vz = r.rank_per_100k_motorist_vz,
            rank_trend_vz        = r.rank_trend_vz,
            rank_trend_pedestrian_vz    = r.rank_trend_pedestrian_vz,
            rank_trend_cyclist_vz    = r.rank_trend_cyclist_vz,
            rank_trend_motorist_vz    = r.rank_trend_motorist_vz,

            pct_per_100k_vz            = CASE WHEN r.avg_per_100k_5yr        IS NOT NULL THEN r.pct_per_100k_vz END,
            pct_per_100k_pedestrian_vz = CASE WHEN r.avg_per_100k_pedestrian IS NOT NULL THEN r.pct_per_100k_pedestrian_vz END,
            pct_per_100k_cyclist_vz    = CASE WHEN r.avg_per_100k_cyclist    IS NOT NULL THEN r.pct_per_100k_cyclist_vz END,
            pct_per_100k_motorist_vz   = CASE WHEN r.avg_per_100k_motorist   IS NOT NULL THEN r.pct_per_100k_motorist_vz END,
            pct_trend_vz               = CASE WHEN r.trend_pct_change            IS NOT NULL THEN r.pct_trend_vz END,
            pct_trend_pedestrian_vz    = CASE WHEN r.trend_pct_change_pedestrian IS NOT NULL THEN r.pct_trend_pedestrian_vz END,
            pct_trend_cyclist_vz       = CASE WHEN r.trend_pct_change_cyclist    IS NOT NULL THEN r.pct_trend_cyclist_vz END,
            pct_trend_motorist_vz      = CASE WHEN r.trend_pct_change_motorist   IS NOT NULL THEN r.pct_trend_motorist_vz END

        FROM ranked r
        WHERE cs.state_fips = r.state_fips
          AND cs.place_fips = r.place_fips
    """

    try:
        with conn.cursor() as cur:
            cur.execute(query)
            updated_count = cur.rowcount
        conn.commit()
        return updated_count, 0
    except Exception:
        conn.rollback()
        logger.exception("[FARS] derive_city_rankings failed")
        return 0, 1
    


def run_derive_city_rankings() -> None:
    start = time.time()
    logger.info("[PIPELINE][TRANSFORM] Deriving city rankings.")

    with get_conn() as conn:
        updated, errors = derive_city_rankings(conn)

    elapsed = time.time() - start
    logger.info(
        "[PIPELINE][TRANSFORM] Finished ranking cities. updated=%s errors=%s duration=%.2fs",
        updated, errors, elapsed,
    )