# /pipeline/tiger_pipeline.py

import time
from pathlib import Path

from pipeline.etl.extract.tiger.extract_tiger_places import download_unzip_tiger_places
from pipeline.etl.load.load_tiger_places import load_tiger_places
from pipeline.etl.load.load_acs_population import load_population_data
from pipeline.etl.enrich.enrich_city_points import enrich_city_points

from pipeline.logger import get_logger

logger = get_logger(__name__)


def run_tiger_pipeline(raw_root: Path) -> None:
    """
    End-to-end TIGER pipeline: extract → load.
    """
    start = time.time()
    logger.info("[PIPELINE][TIGER] Starting pipeline...")

    shapefiles = download_unzip_tiger_places(raw_root)
    inserted, skipped, errors = load_tiger_places(shapefiles)

    elapsed = time.time() - start
    logger.info(
        "[PIPELINE][TIGER] Summary: inserted=%s | skipped=%s | errors=%s | duration=%.2fs",
        inserted, skipped, errors, elapsed,
    )
    logger.info("[PIPELINE][TIGER] Tiger Pipeline completed successfully.")
    

def run_city_pipeline() -> None:
    run_tiger_pipeline(Path("data/raw/tiger/places"))
    load_population_data()
    
    # Assign city points to the census places table
    enrich_city_points()

if __name__ == "__main__":
    run_city_pipeline()