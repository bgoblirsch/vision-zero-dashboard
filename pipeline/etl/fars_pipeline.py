import time
from pathlib import Path

from pipeline.etl.extract.fars.extract_fars import download_unzip_fars_year
from pipeline.etl.extract.fars.resolve_fars_years import resolve_target_fars_years

from pipeline.etl.load.load_fars_crashes import load_fars_crash_year
from pipeline.etl.load.load_fars_persons import load_fars_person_year

from pipeline.etl.transform.derive_fars_person_subtypes import run_derive_fars_subtypes
from pipeline.etl.transform.derive_city_stats import run_derive_city_stats

from pipeline.etl.enrich.enrich_crash_locations import enrich_crash_locations

from pipeline.logger import get_logger

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
    ingestion_stats = {
        "crashes": {"inserted": 0, "skipped": 0, "errors": 0},
        "persons": {"inserted": 0, "skipped": 0, "errors": 0},
    }

    years = resolve_target_fars_years(requested_years)

    for year in years:
        csv_paths = download_unzip_fars_year(year, raw_root)

        files = {path.name.upper(): path for path in csv_paths}

        if "ACCIDENT.CSV" in files:
            insert_count, skip_count, error_count = load_fars_crash_year(
                files["ACCIDENT.CSV"], year
            )
            ingestion_stats["crashes"]["inserted"] += insert_count
            ingestion_stats["crashes"]["skipped"] += skip_count
            ingestion_stats["crashes"]["errors"] += error_count
        else:
            logger.error(f"[FARS] {year} missing ACCIDENT.CSV")
            ingestion_stats["crashes"]["errors"] += 1
            continue

        if "PERSON.CSV" in files:
            insert_count, skip_count, error_count = load_fars_person_year(
                files["PERSON.CSV"], year
            )
            ingestion_stats["persons"]["inserted"] += insert_count
            ingestion_stats["persons"]["skipped"] += skip_count
            ingestion_stats["persons"]["errors"] += error_count
        else:
            logger.error(f"[FARS] {year} missing PERSON.CSV")
            ingestion_stats["persons"]["errors"] += 1
            continue
        
        years_processed += 1

    total_inserted = sum(v["inserted"] for v in ingestion_stats.values())
    total_skipped  = sum(v["skipped"] for v in ingestion_stats.values())
    total_errors   = sum(v["errors"] for v in ingestion_stats.values())

    elapsed = time.time() - start
    logger.info("[PIPELINE][FARS] Summary: years=%s | inserted=%s | skipped=%s | errors=%s | duration=%.2fs",
                years_processed,
                total_inserted,
                total_skipped,
                total_errors,
                elapsed,
    )

    # Assign city_name to crashes missing city data
    enrich_crash_locations()

    # Derive person mode/type for all crashes in the specified year(s)
    run_derive_fars_subtypes(years=years)

    # Derive 5 year avg data for cities
    run_derive_city_stats()

    logger.info("[PIPELINE][FARS] Pipeline completed successfully")