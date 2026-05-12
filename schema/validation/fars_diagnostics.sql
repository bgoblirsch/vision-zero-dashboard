-- run with (from project root): 
-- psql schema/validation/fars_sanity_checks.sql

\echo 
\echo 'Beginning FARS ingestion sanity checks.'
\echo 

\echo '==================='
\echo '| BLOCKING CHECKS |'
\echo '==================='
\echo

\echo '-------------------------------'
\echo 'Duplicate crash count; expect 0'
\echo '-------------------------------'
\echo 'blocking check'
\echo 

SELECT st_case, year, COUNT(*) 
FROM fars_crashes 
GROUP BY st_case, year 
HAVING COUNT(*) > 1;

\echo '----------------------------------------'
\echo 'Missing value counts for critical fields'
\echo '----------------------------------------'
\echo 'blocking check'
\echo 

SELECT 
    COUNT(*) FILTER (WHERE year IS NULL) AS missing_year,
    COUNT(*) FILTER (WHERE state IS NULL) AS missing_state,
    COUNT(*) FILTER (WHERE st_case IS NULL) AS missing_case 
FROM fars_crashes;

\echo '-----------------------------'
\echo 'Dates outside expected range:'
\echo '-----------------------------'
\echo 'blocking check'
\echo 

SELECT
    year,
    COUNT(*) AS total_records,
    COUNT(*) AS bad_dates
FROM fars_crashes
WHERE crash_date IS NOT NULL
  AND (
      crash_date < DATE '1987-01-01'
      OR crash_date > '2023-12-31'
  )
GROUP BY year
ORDER BY year;

\echo '--------------------------------------'
\echo 'Negative Fatality Check; expect 0 rows'
\echo '--------------------------------------'
\echo 'blocking check'
\echo 

-- SELECT  !!! TODO !!! fatality logic not implemented yet.
--     st_case, 
--     year, 
--     total_fatalities, 
--     motorist_fatalities, 
--     cyclist_fatalities, 
--     pedestrian_fatalities
-- FROM fars_crashes
-- WHERE
--   total_fatalities < 0 OR
--   motorist_fatalities < 0 OR
--   cyclist_fatalities < 0 OR
--   pedestrian_fatalities < 0
-- LIMIT 10;

\echo '------------------'
\echo 'Fatality Sum Check'
\echo '------------------'
\echo 'blocking check (diagnostic not implemented)'
\echo 

\echo '-------------------------------------------------'
\echo 'Max Fatality Check (no crash > 30); expect 0 rows'
\echo '-------------------------------------------------'
\echo 'blocking check'
\echo 

-- SELECT  !!! TODO !!! fatality logic not implemented yet.
--     st_case, 
--     year, 
--     total_fatalities, 
--     motorist_fatalities, 
--     cyclist_fatalities, 
--     pedestrian_fatalities
-- FROM fars_crashes
-- WHERE
--   total_fatalities > 30
-- LIMIT 10;

-- !!! To-Do !!!

\echo
\echo '========================'
\echo '| INFORMATIONAL CHECKS |'
\echo '========================'
\echo
\echo

\echo '------------------------------------------------------'
\echo 'Annual fars crash count by year; expect ~35k-45k each.'
\echo '------------------------------------------------------'
\echo 

SELECT
  year,
  COUNT(*) AS crashes
FROM fars_crashes
GROUP BY year
ORDER BY year;

\echo '-----------------------------------------------------'
\echo 'Total FARS crashes. expect ~1.3 million for 1987-2023'
\echo '-----------------------------------------------------'
\echo 

SELECT COUNT(*)
FROM fars_crashes;

\echo '----------------------------'
\echo 'annual fatality distribution'
\echo '----------------------------'
\echo 

-- SELECT !!! TODO !!! fatality logic not implemented yet.
--     year,
--     SUM(total_fatalities) AS total,
--     SUM(pedestrian_fatalities) AS peds,
--     SUM(cyclist_fatalities) AS cyclists,
--     SUM(motorist_fatalities) AS motorists
-- FROM fars_crashes
-- GROUP BY year
-- ORDER BY year;

\echo '-----------------------------'
\echo 'Invalid State Codes; expect 0'
\echo '-----------------------------'
\echo

SELECT DISTINCT state
FROM fars_crashes
WHERE state NOT BETWEEN 1 AND 56;

\echo '-----------------------------------------'
\echo 'Ensure year and file_year match; expect 0'
\echo '-----------------------------------------'
\echo 

SELECT
    year,
    COUNT(*) AS mismatches
FROM fars_crashes
WHERE crash_date IS NOT NULL
  AND EXTRACT(YEAR FROM crash_date) <> year
GROUP BY year
ORDER BY year;

\echo '---------------------------'
\echo 'Spatial & Date Completeness' 
\echo '---------------------------'
\echo 

SELECT
    year,
    COUNT(*)                         AS total,
    COUNT(*) - COUNT(crash_date)  AS missing_date,
    COUNT(*) - COUNT(location)       AS missing_geometry
FROM fars_crashes
GROUP BY year
ORDER BY year;

\echo '--------------------------'
\echo 'Spatial plausibility check'
\echo '--------------------------'
\echo 

SELECT COUNT(*) AS invalid_points
FROM fars_crashes
WHERE location IS NOT NULL
  AND NOT (
      ST_X(location) BETWEEN -180 AND 180
  AND ST_Y(location) BETWEEN -90 AND 90
  );

\echo '====================='
\echo 'Diagnostics complete.'
\echo '====================='