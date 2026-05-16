CREATE TABLE IF NOT EXISTS census_places (
    id SERIAL PRIMARY KEY,
    state_fips CHAR(2) NOT NULL,
    place_fips CHAR(5) NOT NULL,
    state_name VARCHAR(50) NOT NULL,
    place_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    is_vision_zero BOOLEAN DEFAULT FALSE,
    place_type CHAR(2),
    geom GEOMETRY(MultiPolygon, 4326),
    centroid GEOMETRY(Point, 4326),
    point_geom GEOMETRY(Point, 4326),
    CONSTRAINT census_places_state_fips_place_fips_unique UNIQUE (state_fips, place_fips)
);

CREATE INDEX IF NOT EXISTS census_places_geom_idx ON census_places USING GIST (geom);
CREATE INDEX IF NOT EXISTS census_places_centroid_idx ON census_places USING GIST (centroid);