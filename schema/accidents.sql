-- Creates the PostGIS accidents table.
-- File: schema/accidents.sql
-- Requires: PostGIS extension installed in this database.

CREATE TABLE IF NOT EXISTS accidents (
    accident_id SERIAL PRIMARY KEY,
    st_case INTEGER NOT NULL,
    year INTEGER NOT NULL,
    accident_date DATE,
    state INTEGER NOT NULL,
    state_name VARCHAR(20),
    county INTEGER NOT NULL,
    county_name VARCHAR(40),
    city INTEGER NOT NULL,
    city_name VARCHAR(50),
    road_type VARCHAR(30),
    total_fatalities INTEGER NOT NULL CHECK (total_fatalities >= 0),
    motorist_fatalities INTEGER NOT NULL CHECK (motorist_fatalities >= 0),
    cyclist_fatalities INTEGER NOT NULL CHECK (cyclist_fatalities >= 0),
    pedestrian_fatalities INTEGER NOT NULL CHECK (pedestrian_fatalities >= 0),
    location GEOMETRY(Point, 4326), -- WGS84
    CONSTRAINT accidents_stcase_year_unique UNIQUE (st_case, year)
);

ALTER TABLE accidents
    ADD CONSTRAINT accidents_location_geom_check
        CHECK (location IS NULL OR (ST_GeometryType(location) = 'ST_Point' AND ST_SRID(location) = 4326));

CREATE INDEX IF NOT EXISTS accidents_location_gist_idx ON accidents USING GIST (location);
CREATE INDEX IF NOT EXISTS accidents_date_idx ON accidents (accident_date);
CREATE INDEX IF NOT EXISTS accidents_state_idx ON accidents (state_name);
CREATE INDEX IF NOT EXISTS accidents_county_idx ON accidents (county_name);
CREATE INDEX IF NOT EXISTS accidents_city_idx ON accidents (city_name);

COMMENT ON TABLE accidents IS
'FARS accident-level fatalities, normalized across historical schema changes';

COMMENT ON COLUMN accidents.year IS
'Authoritative FARS reporting year; used as primary temporal key';

COMMENT ON COLUMN accidents.location IS
'WGS84 point geometry; NULL for pre-1999 records without coordinates';