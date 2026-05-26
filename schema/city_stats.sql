CREATE TABLE IF NOT EXISTS city_stats (
    id SERIAL PRIMARY KEY,
    place_name VARCHAR(100),
    state_name VARCHAR(50),
    state_fips CHAR(2),
    place_fips CHAR(5),
    population INTEGER,
    avg_fatalities_5yr NUMERIC(8,2),
    avg_5yr_pedestrian NUMERIC(8,2),
    avg_5yr_cyclist NUMERIC(8,2),
    avg_5yr_motorist NUMERIC(8,2),
    avg_per_100k_5yr NUMERIC(8,2),
    avg_per_100k_pedestrian NUMERIC(8,2),
    avg_per_100k_cyclist NUMERIC(8,2),
    avg_per_100k_motorist NUMERIC(8,2),
    trend_pct_change NUMERIC(10,4),
    trend_pct_change_pedestrian NUMERIC(10,4),
    trend_pct_change_cyclist NUMERIC(10,4),
    trend_pct_change_motorist NUMERIC(10,4),

    -- rankings: all dashboard cities (population >= 50k or VZ)
    rank_per_100k_all SMALLINT,
    rank_per_100k_pedestrian_all SMALLINT,
    rank_per_100k_cyclist_all SMALLINT,
    rank_per_100k_motorist_all SMALLINT,
    rank_trend_all SMALLINT,
    rank_trend_pedestrian_all SMALLINT,
    rank_trend_cyclist_all SMALLINT,
    rank_trend_motorist_all SMALLINT,

    -- percentiles: all dashboard cities
    pct_per_100k_all NUMERIC(5,2),
    pct_per_100k_pedestrian_all NUMERIC(5,2),
    pct_per_100k_cyclist_all NUMERIC(5,2),
    pct_per_100k_motorist_all NUMERIC(5,2),
    pct_trend_all NUMERIC(5,2),
    pct_trend_pedestrian_all NUMERIC(5,2),
    pct_trend_cyclist_all NUMERIC(5,2),
    pct_trend_motorist_all NUMERIC(5,2),

    -- rankings: VZ cities only (null for non-VZ)
    rank_per_100k_vz SMALLINT,
    rank_per_100k_pedestrian_vz SMALLINT,
    rank_per_100k_cyclist_vz SMALLINT,
    rank_per_100k_motorist_vz SMALLINT,
    rank_trend_vz SMALLINT,
    rank_trend_pedestrian_vz SMALLINT,
    rank_trend_cyclist_vz SMALLINT,
    rank_trend_motorist_vz SMALLINT,

    -- percentiles: VZ cities only (null for non-VZ)
    pct_per_100k_vz NUMERIC(5,2),
    pct_per_100k_pedestrian_vz NUMERIC(5,2),
    pct_per_100k_cyclist_vz NUMERIC(5,2),
    pct_per_100k_motorist_vz NUMERIC(5,2),
    pct_trend_vz NUMERIC(5,2),
    pct_trend_pedestrian_vz NUMERIC(5,2),
    pct_trend_cyclist_vz NUMERIC(5,2),
    pct_trend_motorist_vz NUMERIC(5,2),
    
    CONSTRAINT city_stats_state_fips_place_fips_unique UNIQUE (state_fips, place_fips)
);