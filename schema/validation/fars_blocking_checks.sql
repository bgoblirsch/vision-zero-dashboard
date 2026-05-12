-- run with (from project root): 
-- psql -v ON_ERROR_STOP=1 -f schema/validation/fars_blocking_checks.sql

\set QUIET on

-- duplicates
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM fars_crashes
        GROUP BY st_case, year
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Blocking check failed: duplicate (st_case, year) values found';
    END IF;
END $$;

-- missing critical fields
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM fars_crashes
        WHERE year IS NULL
           OR st_case IS NULL
           OR state IS NULL
        LIMIT 1
    ) THEN
        RAISE EXCEPTION
            'Blocking check failed: missing required fields (year, st_case, or state)';
    END IF;
END $$;

-- invalid date range
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM fars_crashes
        WHERE crash_date IS NOT NULL
          AND (
              crash_date < DATE '1987-01-01'
              OR crash_date > DATE '2023-12-31'
          )
        LIMIT 1
    ) THEN
        RAISE EXCEPTION
            'Blocking check failed: crash_date outside expected range (1987–2023)';
    END IF;
END $$;

-- negative fatality values !!! TODO !!! - fatality logic not yet implemented
-- DO $$ 
-- BEGIN
--     IF EXISTS (
--         SELECT 1
--         FROM fars_crashes
--         WHERE total_fatalities < 0
--             OR motorist_fatalities < 0
--             OR cyclist_fatalities < 0
--             OR pedestrian_fatalities < 0
--         LIMIT 1
--     ) THEN
--         RAISE EXCEPTION
--             'Blocking check failed: negative fatality value encountered.';
--     END IF;
-- END $$;

-- fatality sum check !!! TODO !!! - fatality count logic not implemented yet
-- DO $$
-- BEGIN
--     IF EXISTS (
--         SELECT 1
--         FROM fars_crashes
--         WHERE total_fatalities
--             <> (motorist_fatalities
--                 + cyclist_fatalities
--                 + pedestrian_fatalities)
--     ) THEN
--         RAISE EXCEPTION
--             'Blocking check failed: total_fatalities does not equal sum of fatality subtypes';
--     END IF;
-- END $$;

-- max fatality check
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM fars_crashes
        WHERE total_fatalities > 30
    ) THEN
        RAISE EXCEPTION
            'Blocking check failed: implausible total_fatalities (>30) detected';
    END IF;
END $$;

\echo '==========================='
\echo 'All blocking checks passed.'
\echo '==========================='