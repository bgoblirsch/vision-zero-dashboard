import json
import re

from pathlib import Path

from pipeline.connection import get_conn
from pipeline.logger import get_logger

logger = get_logger(__name__)

SUFFIX_PATTERN = re.compile(
    r'\s+(city and borough|consolidated government|metropolitan government|unified government|urban county|municipality|borough|village|town|city|CDP)$',
    re.IGNORECASE
)


def strip_place_suffix(name: str) -> str:
    return SUFFIX_PATTERN.sub("", name).strip()


def load_population_data():
    logger.info("[LOAD] Loading city_stats table with ACS population data.")
    data_path = Path("data/acs2023_populations.json")
    
    with open(data_path) as file:
        data = json.load(file)
    
    # First row is headers: ["NAME", "B01003_001E", "state", "place"]
    headers = data[0]
    rows = data[1:]

    with get_conn() as conn:
        with conn.cursor() as cur:
            for row in rows:
                record = dict(zip(headers, row))
                state_code = record["state"]
                if state_code == "72":
                    continue
                split = record["NAME"].split(",")
                place_name = strip_place_suffix(split[0])
                state_name = split[-1].strip()
                
                cur.execute("""
                    INSERT INTO city_stats (place_name, state_name, state_fips, place_fips, population)
                    VALUES (%(name)s, %(state_name)s, %(state_code)s, %(place)s, %(pop)s)
                    ON CONFLICT DO NOTHING
                """, {
                    "name": place_name,
                    "state_name": state_name,
                    "state_code": state_code,
                    "place": record["place"],
                    "pop": int(record["B01003_001E"]),
                })
        conn.commit()

    logger.info("[LOAD] Finished loading city_stats table with ACS population data.")

if __name__ == "__main__":
    load_population_data()