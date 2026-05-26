import csv
import psycopg

from pathlib import Path

from pipeline.logger import get_logger

logger = get_logger(__name__)

def load_fars_city_codes():
    logger.info("Populating fars_city_codes table.")

    data_path = Path("data/fars_city_codes.csv")
    
    with open(data_path, newline='') as file:
        reader = csv.DictReader(file)
    
        with psycopg.connect(
            host="localhost",
            dbname="visionzero_db",
            user="visionzero",
        ) as conn:
            with conn.cursor() as cur:
                for row in reader:
                    state_code = row["state_code"]
                    fars_city_code = row["fars_city_code"]
                    fars_city_name = row["fars_city_name"]
                    cur.execute("""
                        INSERT INTO fars_city_codes (state_code, fars_city_code, fars_city_name)
                        VALUES (%(state_code)s, %(fars_city_code)s, %(fars_city_name)s)
                        ON CONFLICT DO NOTHING
                    """, {
                        "state_code": state_code,
                        "fars_city_code": fars_city_code,
                        "fars_city_name": fars_city_name,
                    })
            conn.commit()

    logger.info("fars_city_codes table populated.")

if __name__ == "__main__":
    load_fars_city_codes()