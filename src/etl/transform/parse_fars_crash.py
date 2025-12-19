from datetime import date

ROUTE_MAP = {
    1: "Interstate",
    2: "US Highway",
    3: "State Highway",
    4: "County Road",
    5: "Local Township",
    6: "Municipal Street",
    7: "Frontage Road",
    8: "Other",
    9: "Unknown",
    10: "Parkway",
    11: "Off-Interstate Business",
    12: "Secondary Route",
    13: "Bureaue of Indian Affairs",
    95: "Other"
}


def map_route_to_road_type(raw_value: str | int | None) -> str:
    """
    Convert FARS ROUTE code into human-readable road_type string.
    Unknown, None, or invalid codes return "Unknown".
    """
    if raw_value in (None, ""):
        return "Unknown"
    try:
        route_int = int(raw_value)
    except (ValueError, TypeError):
        return "Unknown"
    return ROUTE_MAP.get(route_int, "Unknown")


def parse_fars_point(row: dict) -> tuple[float, float] | tuple[None, None]:
    """
    Extract longitude/latitude from FARS row.
    Returns (lon, lat) as floats or (None, None) if missing/invalid.
    """
    raw_lon = row.get("LONGITUD")
    raw_lat = row.get("LATITUDE")

    # -- Missing or blank --
    if not raw_lon or not raw_lat:
        return None, None
    
    raw_lat = raw_lat.strip()
    raw_lon = raw_lon.strip()

    # -- Sentinel values
    if raw_lat in {"0", "9999"} or raw_lon in {"0", "9999"}:
        return None, None

    # --- Detect DMS vs decimal ---
    # DMS has no decimal point and is "too large" to be decimal degrees
    is_dms = "." not in raw_lat and "." not in raw_lon

    try:
        if is_dms:
            lat = dms_to_decimal(int(raw_lat))
            lon = dms_to_decimal(int(raw_lon))
        else:
            lat = float(raw_lat)
            lon = float(raw_lon)
    except ValueError:
        return None, None

    # -- Sanity checks --
    if not (-90 <= lat <= 90):
        return None, None

    if not (-180 <= lon <= 180):
        return None, None

    # FARS longitudes are west → ensure negative
    lon = -abs(lon)

    return lon, lat
    
def dms_to_decimal(value: int) -> float:
    """
    Convert FARS DDMMSSSS format to decimal degrees.
    """
    value = abs(value)

    degrees = value // 1_000_000
    minutes = (value // 10_000) % 100
    seconds = (value % 10_000) / 100

    return degrees + minutes / 60 + seconds / 3600

def parse_fars_date(row: dict) -> date | None:
    try:
        year = int(row["YEAR"])
        month = int(row["MONTH"])
        day = int(row["DAY"])
        if year <= 0 or month <= 0 or day <= 0:
            return None
        
        if year < 100 and year > 23:
            year += 1900

        return date(year, month, day)
    except (ValueError, TypeError):
        return None