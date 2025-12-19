import time
from pathlib import Path

from etl.extract.fars.extract_fars import download_unzip_fars_year
from etl.extract.fars.ingest_plan_fars import resolve_target_fars_years
from etl.load.load_fars import load_fars_year
from logger import get_logger

logger = get_logger(__name__)

def run_fars_pipeline(
    raw_root: Path,
    requested_years: list[int] | None = None,
) -> None:
    """
    End-to-end FARS pipeline: extract → load.
    """
    start = time.time()

    logger.info("[PIPELINE][FARS] Starting pipeline...")

    total_inserted = 0
    total_skipped = 0
    total_errors = 0
    years_processed = 0

    years = resolve_target_fars_years(requested_years)

    for year in years:
        csv_paths = download_unzip_fars_year(year, raw_root)

        for csv_path in csv_paths:
            if csv_path.name.upper() == "ACCIDENT.CSV":
                insert_count, skip_count, error_count = load_fars_year(csv_path, year)
                total_inserted += insert_count
                total_skipped += skip_count
                total_errors += error_count
        
        years_processed += 1

    elapsed = time.time() - start
    logger.info("[PIPELINE][FARS] Summary: years=%s | inserted=%s | skipped=%s | errors=%s | duration=%.2fs",
                years_processed,
                total_inserted,
                total_skipped,
                total_errors,
                elapsed,
    )
    logger.info("[PIPELINE][FARS] Pipeline completed succesfully")