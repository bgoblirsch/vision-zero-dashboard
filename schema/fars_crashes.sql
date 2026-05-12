-- Creates the PostGIS crashes table.
-- File: schema/fars_crashes.sql
-- Requires: PostGIS extension installed in this database.

CREATE TABLE IF NOT EXISTS fars_crashes (
    crash_id SERIAL PRIMARY KEY,
    st_case INTEGER NOT NULL,
    year INTEGER NOT NULL,
    crash_date DATE,
    state CHAR(2) NOT NULL,
    state_name VARCHAR(20),
    county CHAR(3) NOT NULL,
    county_name VARCHAR(40),
    city CHAR(4) NOT NULL,
    city_name VARCHAR(80),
    route_code INTEGER,
    road_label VARCHAR(30),
    total_fatalities INTEGER NOT NULL CHECK (total_fatalities >= 0),
    location GEOMETRY(Point, 4326), -- WGS84
    CONSTRAINT crashes_stcase_year_unique UNIQUE (st_case, year)
);

ALTER TABLE fars_crashes
    ADD CONSTRAINT crashes_location_geom_check
        CHECK (location IS NULL OR (ST_GeometryType(location) = 'ST_Point' AND ST_SRID(location) = 4326));

CREATE INDEX IF NOT EXISTS crashes_location_gist_idx ON fars_crashes USING GIST (location);
CREATE INDEX IF NOT EXISTS crashes_date_idx ON fars_crashes (crash_date);
CREATE INDEX IF NOT EXISTS crashes_state_idx ON fars_crashes (state_name);
CREATE INDEX IF NOT EXISTS crashes_county_idx ON fars_crashes (county_name);
CREATE INDEX IF NOT EXISTS crashes_city_idx ON fars_crashes (city_name);

COMMENT ON TABLE fars_crashes IS
'FARS crash-level fatalities, normalized across historical schema changes';

COMMENT ON COLUMN fars_crashes.year IS
'Authoritative FARS reporting year; used as primary temporal key';

COMMENT ON COLUMN fars_crashes.location IS
'WGS84 point geometry; NULL for pre-1999 records without coordinates';