-- Creates the PostGIS persons table.
-- File: schema/persons_clean.sql

CREATE TABLE IF NOT EXISTS fars_persons_clean (
    person_id SERIAL PRIMARY KEY,
    crash_id INT NOT NULL REFERENCES fars_crashes_clean(crash_id), -- is this correct?
    crash_year INT NOT NULL,
    person_age INT,
    sex INT, 
    person_type INT NOT NULL,
    injury_severity INT NOT NULL,
    location_code INT NOT NULL
);