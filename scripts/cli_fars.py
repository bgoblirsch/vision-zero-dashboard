import argparse
import subprocess
from pathlib import Path

from pipeline.etl.fars_pipeline import run_fars_pipeline
from pipeline.etl.enrich.enrich_crash_locations import enrich_crash_locations
from pipeline.logger import get_logger

logger = get_logger(__name__)

def run_fars_validation() -> None:
    logger.info("[PIPELINE][FARS] Running validation checks...")
    subprocess.run(
        ["bash", "scripts/validate_fars.sh"],
        check=True,
    )

def main() -> None:
    parser = argparse.ArgumentParser(description="Run FARS pipeline")
    parser.add_argument(
        "--raw-root",
        type=Path,
        default=Path("data/raw/fars"),
        help="Root directory for raw FARS data",
    )
    parser.add_argument(
        "--years",
        type=int,
        nargs="*",
        help="Specific years to process (e.g. 2023 2022)",
    )

    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only run validation checks; no extraction or loading."
    )

    parser.add_argument(
        "--enrich-only",
        action="store_true",
        help="Only run spatial enrichment; no extraction or loading."
    )

    args = parser.parse_args()

    if args.validate_only:
        run_fars_validation()
        logger.info("[PIPELINE][FARS] Validation Completed. Passed all blocking checks.")
        return
    
    if args.enrich_only:
        enrich_crash_locations()
        return

    run_fars_pipeline(
        raw_root=args.raw_root,
        requested_years=args.years,
    )

if __name__ == "__main__":
    main()