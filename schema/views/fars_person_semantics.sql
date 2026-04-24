CREATE OR REPLACE VIEW fars_person_semantics AS
SELECT
    *,
    CASE
        WHEN person_role IN ('Driver', 'Passenger') THEN 'Motorist'
        WHEN person_role = 'Pedestrian' THEN 'Pedestrian'
        WHEN person_role IN ('Bicyclist', 'Other Cyclist') THEN 'Cyclist'
        WHEN person_role = 'Non-motorist Other' THEN 'Other'
        ELSE 'Unknown'
    END AS person_mode
FROM (
  SELECT
    *,
    CASE
        WHEN injury_severity = 4 THEN true
        ELSE false
    END AS is_fatal_person,

    CASE
        WHEN person_type = 1  THEN 'Driver'
        WHEN person_type IN (2, 3, 9) THEN 'Passenger'
        WHEN person_type IN (5, 8, 10, 11, 12, 13) THEN 'Pedestrian'
        WHEN person_type = 6  THEN 'Bicyclist'
        WHEN person_type = 7  THEN 'Other Cyclist'
        WHEN person_type = 4  THEN 'Non-motorist Other'
        WHEN person_type IN (19, 88, 99) THEN 'Unknown'
        ELSE 'Unknown'
    END AS person_role
  FROM fars_person_with_crash
) AS base;