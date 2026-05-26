# /pipeline/etl/extract/tiger/extract_tiger_places.py

from pathlib import Path

from pipeline.etl.transform.mappings import STATE_FIPS_MAP
from pipeline.utils.downloader import download_file, extract_if_zip
from pipeline.logger import get_logger

logger = get_logger(__name__)

TIGER_BASE_URL = "https://www2.census.gov/geo/tiger/TIGER2023/PLACE"
TIGER_FILENAME_TEMPLATE = "tl_2023_{fips}_place.zip"


def build_tiger_url(fips: str) -> str:
    return f"{TIGER_BASE_URL}/{TIGER_FILENAME_TEMPLATE.format(fips=fips)}"


def download_unzip_tiger_places(
        base_dir: Path,
        force_extract: bool = False,
) -> list[Path]:
    """
    Download and extract TIGER place shapefiles for all states.
    """
    shapefiles = []

    for fips, state_name in STATE_FIPS_MAP.items():
        state_dir = base_dir / f"tiger_places_{fips}"
        state_dir.mkdir(parents=True, exist_ok=True)

        zip_path = state_dir / f"tl_2023_{fips}_place.zip"

        # -- Download --
        if zip_path.exists():
            logger.info(f"[TIGER] {state_name} already downloaded, skipping download")
        else:
            logger.info(f"[TIGER] Downloading {state_name}...")
            download_file(
                url=build_tiger_url(fips),
                dest=zip_path
            )

        # -- Unzip --
        existing_shp = [
            p for p in state_dir.rglob("*")
            if p.is_file() and p.suffix.casefold() == ".shp"
        ]

        if existing_shp and not force_extract:
            logger.info(f"[TIGER] {state_name} already extracted, skipping unzip.")
        else:
            logger.info(f"[TIGER] Extracting {state_name}...")
            extract_if_zip(file_path=zip_path, extract_to=state_dir, expected_extension=".shp")

        # -- Rescan for shapefiles and collect --
        shp_files = [
            p for p in state_dir.rglob("*")
            if p.is_file() and p.suffix.casefold() == ".shp"
        ]

        if not shp_files:
            raise RuntimeError(f"[TIGER] No shapefiles found for {state_name} ({fips}) after extraction")

        shapefiles.extend(shp_files)

    return shapefiles

if __name__ == "__main__":
    from pathlib import Path
    base_dir = Path("data/raw/tiger/places")
    shapefiles = download_unzip_tiger_places(base_dir)
    print(f"Downloaded {len(shapefiles)} shapefiles")