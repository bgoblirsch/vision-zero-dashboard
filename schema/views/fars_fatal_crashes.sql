CREATE OR REPLACE VIEW fars_fatal_crashes AS
SELECT
    crash_id,
    year,
    BOOL_OR(is_fatal_person) AS is_fatal_crash
FROM fars_person_semantics
GROUP BY crash_id, year;
