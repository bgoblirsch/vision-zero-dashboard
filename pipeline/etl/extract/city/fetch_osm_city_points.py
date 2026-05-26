import csv
import time
import requests
from pipeline.connection import get_conn

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "VisionZeroDashboard/1.0 (brandon.goblirsch@gmail.com.com)"}
OUTPUT_CSV = "data/osm_city_points.csv"


def fetch_nominatim_point(place_name: str, state_name: str) -> tuple[float, float] | None:
    params = {
        "city": place_name,
        "state": state_name,
        "country": "us",
        "featuretype": "city",
        "format": "json",
        "limit": 1,
    }
    try:
        res = requests.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=10)
        res.raise_for_status()
        results = res.json()
        if results:
            return float(results[0]["lon"]), float(results[0]["lat"])
    except Exception as e:
        print(f"Error geocoding {place_name}, {state_name}: {e}")
    return None


def main():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT cp.state_fips, cp.place_fips, cp.place_name, cp.state_name
                FROM census_places cp
                JOIN city_stats cs 
                    ON cp.state_fips = cs.state_fips 
                    AND cp.place_fips = cs.place_fips
                WHERE cs.population > 100000
                ORDER BY cp.state_fips, cp.place_fips
            """)
            places = cur.fetchall()

    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["state_fips", "place_fips", "place_name", "state_name", "lon", "lat", "status"])

        for state_fips, place_fips, place_name, state_name in places:
            result = fetch_nominatim_point(place_name, state_name)
            if result:
                lon, lat = result
                status = "ok"
                print(f"OK: {place_name}, {state_name} -> {lon}, {lat}")
            else:
                lon, lat = None, None
                status = "failed"
                print(f"FAILED: {place_name}, {state_name}")

            writer.writerow([state_fips, place_fips, place_name, state_name, lon, lat, status])
            time.sleep(1)  # Nominatim rate limit


if __name__ == "__main__":
    main()