import csv
import psycopg

from pathlib import Path

from pipeline.logger import get_logger
from pipeline.etl.transform.mappings import STATE_FIPS_MAP

logger = get_logger(__name__)

STATE_NAME_TO_FIPS = {v: k for k, v in STATE_FIPS_MAP.items()}

def sanitize_city_name(city_name: str, state_name: str) -> tuple[str, str]:
    cleaned_city = city_name
    cleaned_state = state_name
    match cleaned_city:
        case "Washington DC":
            cleaned_city = "Washington"
            cleaned_state = "District of Columbia"
        case "Ft. Lauderdale":
            cleaned_city = "Fort Lauderdale"
        case "Macon":
            cleaned_city = "Macon-Bibb County"
        case "New York City":
            cleaned_city = "New York"

    state_code = STATE_NAME_TO_FIPS.get(cleaned_state, "ERROR")
    if state_code == "ERROR":
        logger.error(f"No state code found for state name from vision zero city list: {state_name}")
    return (cleaned_city, state_code)

def load_fars_city_codes():
    logger.info("Populating Vision Zero status to census_places table.")
    data_path = Path("data/vision_zero_cities.csv")
    
    with open(data_path, newline='') as file:
        reader = csv.reader(file)
    
        with psycopg.connect(
            host="localhost",
            dbname="visionzero_db",
            user="visionzero",
        ) as conn:
            with conn.cursor() as cur:
                for row in reader:
                    if not row[0].isdigit():
                        continue

                    city_name = row[1]
                    state_name = row[2]

                    city_name, state_code = sanitize_city_name(city_name, state_name)
                        
                    cur.execute("""
                        UPDATE census_places 
                        SET is_vision_zero = TRUE 
                        WHERE place_name = %(city_name)s 
                        AND state_fips = %(state_code)s
                    """, {
                        "city_name": city_name,
                        "state_code": state_code,
                    })

                    if cur.rowcount == 0:
                        logger.warning(f"No match found for: {city_name}, {state_code}")
            conn.commit()

    logger.info("Loaded Vision Zero city boolean to census_places table.")

if __name__ == "__main__":
    load_fars_city_codes()