import time
import csv

from pathlib import Path

from pipeline.connection import get_conn
from pipeline.logger import get_logger

logger = get_logger(__name__)

KNOWN_CITY_ISSUES_MAP = {
    "Athens-Clarke County unified government (balance)": (-83.375809, 33.935479),
    "Augusta-Richmond County consolidated government (balance)": (-81.968841, 33.4711351),
    "Louisville/Jefferson County metro government (balance)": (-85.754692, 38.250913),
    "Nashville-Davidson metropolitan government (balance)": (-86.78211, 36.16129),
    "Florence-Graham": (-118.24336, 33.96733),
    "Macon-Bibb County": (-83.62853, 32.83435),
    "Urban Honolulu": (-157.8592, 21.30899),
    "Indianapolis": (-86.15802, 39.76847),
    "Methuen Town": (-71.19088, 42.72607),
    "Weymouth Town": (-70.9369, 42.21747),
    "Tonawanda Town": (-78.87973, 43.01837),
}


def enrich_city_points() -> None:
    """
        Assign city point locations to the census_places table using points acquired
        OpenStreetMap nominatim.
    """
    query = """
        UPDATE census_places places
        SET point_geom = ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)
        WHERE places.state_fips = %(state_fips)s
          AND places.place_fips = %(place_fips)s
    """

    start = time.time()
    logger.info("[ENRICH] Starting city point location enrichment...")

    data_path = Path("data/osm_city_points.csv")
    with open(data_path) as file:
        reader = csv.DictReader(file)

        census_places_updated = 0

        with get_conn() as conn:
            with conn.cursor() as cur:
                for row in reader:
                    if row["status"] != "ok" and KNOWN_CITY_ISSUES_MAP.get(row["place_name"]):
                        lon, lat = KNOWN_CITY_ISSUES_MAP[row["place_name"]]
                        cur.execute(query, {"lon": lon, "lat": lat, "state_fips": row["state_fips"], "place_fips": row["place_fips"]})
                        census_places_updated += 1
                        continue
                    if row["status"] != "ok" or row["lon"] == '' or row["lat"] == '':
                        continue

                    lon, lat = float(row["lon"]), float(row["lat"])
                    cur.execute(query, {"lon": lon, "lat": lat, "state_fips": row["state_fips"], "place_fips": row["place_fips"]})
                    census_places_updated += 1
                    conn.commit()
                    
                logger.info("[ENRICH] city point assigned for %s rows", census_places_updated)

    elapsed = time.time() - start
    logger.info("[ENRICH] Completed city point location enrichment. duration=%.2fs", elapsed)