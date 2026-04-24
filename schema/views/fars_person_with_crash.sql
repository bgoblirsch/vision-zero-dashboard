CREATE OR REPLACE VIEW fars_person_with_crash AS
SELECT
    -- identifiers
    p.person_id,
    p.crash_id,

    -- temporal
    a.year,
    a.crash_date,

    -- person facts
    p.person_type,
    p.injury_severity

FROM fars_persons_clean p
JOIN fars_crashes_clean a
  ON p.crash_id = a.crash_id;