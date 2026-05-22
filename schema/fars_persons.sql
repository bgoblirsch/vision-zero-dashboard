-- Creates the PostGIS persons table.
-- File: schema/fars_persons.sql

CREATE TABLE IF NOT EXISTS fars_persons (
    person_id SERIAL PRIMARY KEY,
    crash_id INTEGER NOT NULL REFERENCES fars_crashes(crash_id),
    st_case INTEGER NOT NULL,
    crash_year INTEGER NOT NULL,
    vehicle_number INTEGER NOT NULL,
    person_number INTEGER NOT NULL,
    person_age INTEGER,
    sex INTEGER, 
    person_type INTEGER NOT NULL,
    injury_severity INTEGER NOT NULL,
    location_code INTEGER NOT NULL,
    CONSTRAINT persons_stcase_veh_per_year_unique UNIQUE (crash_id, person_number, vehicle_number)
);