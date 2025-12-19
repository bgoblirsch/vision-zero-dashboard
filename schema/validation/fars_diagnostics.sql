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
FROM accidents 
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
FROM accidents;

\echo '-----------------------------'
\echo 'Dates outside expected range:'
\echo '-----------------------------'
\echo 'blocking check'
\echo 

SELECT
    year,
    COUNT(*) AS total_records,
    COUNT(*) AS bad_dates
FROM accidents
WHERE accident_date IS NOT NULL
  AND (
      accident_date < DATE '1987-01-01'
      OR accident_date > '2023-12-31'
  )
GROUP BY year
ORDER BY year;

\echo '-----------------------'
\echo 'Negative Fatality Check'
\echo '-----------------------'
\echo 'blocking check (diagnostic not implemented)'
\echo 

\echo '------------------'
\echo 'Fatality Sum Check'
\echo '------------------'
\echo 'blocking check (diagnostic not implemented)'
\echo 

\echo '------------------'
\echo 'Max Fatality Check'
\echo '------------------'
\echo 'blocking check (diagnostic not implemented)'
\echo 


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
FROM accidents
GROUP BY year
ORDER BY year;

\echo '---------------------------------------------------'
\echo 'Total FARS crashes. expect ~1 million for 1987-2023'
\echo '---------------------------------------------------'
\echo 

SELECT COUNT(*)
FROM accidents;

\echo '----------------------------'
\echo 'annual fatality distribution'
\echo '----------------------------'
\echo 

SELECT
    year,
    SUM(total_fatalities) AS total,
    SUM(pedestrian_fatalities) AS peds,
    SUM(cyclist_fatalities) AS cyclists,
    SUM(motorist_fatalities) AS motorists
FROM accidents
GROUP BY year
ORDER BY year;

\echo '----------------------------------------'
\echo 'Year and file_year match check; expect 0'
\echo '----------------------------------------'
\echo 

SELECT
    year,
    COUNT(*) AS mismatches
FROM accidents
WHERE accident_date IS NOT NULL
  AND EXTRACT(YEAR FROM accident_date) <> year
GROUP BY year
ORDER BY year;

\echo '------------------------------'
\echo 'Invalide State Codes; expect 0'
\echo '------------------------------'
\echo

SELECT DISTINCT state
FROM accidents
WHERE state NOT BETWEEN 1 AND 56;

\echo '---------------------------'
\echo 'Spatial & Date Completeness' 
\echo '---------------------------'
\echo 

SELECT
    year,
    COUNT(*)                         AS total,
    COUNT(*) - COUNT(accident_date)  AS missing_date,
    COUNT(*) - COUNT(location)       AS missing_geometry
FROM accidents
GROUP BY year
ORDER BY year;

\echo '--------------------------'
\echo 'Spatial plausibility check'
\echo '--------------------------'
\echo 

SELECT COUNT(*) AS invalid_points
FROM accidents
WHERE location IS NOT NULL
  AND NOT (
      ST_X(location) BETWEEN -180 AND 180
  AND ST_Y(location) BETWEEN -90 AND 90
  );

