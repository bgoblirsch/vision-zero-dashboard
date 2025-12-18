from pathlib import Path

from utils.downloader import download_file, extract_if_zip
from logger import get_logger

logger = get_logger(__name__)

FARS_BASE_URL = "https://static.nhtsa.gov/nhtsa/downloads/FARS"
FARS_FILENAME_TEMPLATE = "FARS{year}NationalCSV.zip"

def build_fars_url(year: int) -> str:
    return f"{FARS_BASE_URL}/{year}/National/{FARS_FILENAME_TEMPLATE.format(year=year)}"


def download_unzip_fars_year(
        year: int, 
        base_dir: Path, 
        force_extract: bool = False,
) -> list[Path]:
    """
    Download a single FARS dataset for a given year.
    """
    year_dir = base_dir / f"fars_{year}"
    year_dir.mkdir(parents=True, exist_ok=True)

    zip_path = year_dir / f"fars_{year}.zip"

    # -- Download --
    if zip_path.exists():
        logger.info(f"[FARS] {year} already downloaded, skipping download")
    else:
        logger.info(f"[FARS] Downloading {year}...")
        download_file(
            url=build_fars_url(year),
            dest=year_dir / f"fars_{year}.zip"
        )

    # -- Unzip --
    existing_csvs = [
        p for p in year_dir.rglob("*")
        if p.is_file() and p.suffix.casefold() == ".csv"
    ]

    if existing_csvs and not force_extract:
        logger.info(f"[FARS] {year} already extracted with ({len(existing_csvs)} CSVs), skipping unzip.")
    else:
        logger.info(f"[FARS] Extracting {year}...")
        extract_if_zip(file_path=zip_path, extract_to=year_dir)
    
    # -- Rescan for CSVs and return --
    csvs = [
        p for p in year_dir.rglob("*")
        if p.is_file() and p.suffix.casefold() == ".csv"
    ]

    if not csvs:
        raise RuntimeError(f"[FARS] No CSVs found for year {year} after extraction")

    return csvs