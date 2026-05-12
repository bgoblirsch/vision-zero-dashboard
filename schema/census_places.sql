CREATE TABLE IF NOT EXISTS census_places (
    id SERIAL PRIMARY KEY,
    statefp CHAR(2) NOT NULL,
    placefp CHAR(5) NOT NULL,
    place_name VARCHAR(100) NOT NULL,
    place_type CHAR(2),
    geom GEOMETRY(MultiPolygon, 4326),
    CONSTRAINT census_places_statefp_placefp_unique UNIQUE (statefp, placefp)
);

CREATE INDEX IF NOT EXISTS census_places_geom_idx ON census_places USING GIST (geom);