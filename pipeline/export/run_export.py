import os
from pathlib import Path
from dotenv import load_dotenv

from pipeline.export.export_crashes_metadata import export_crashes_metadata
from pipeline.export.export_cities import export_cities
from pipeline.export.export_boundaries import export_boundaries
from pipeline.export.export_crashes import export_crashes
from pipeline.export.export_annual_fatalities import export_annual_fatalities
from pipeline.logger import get_logger

logger = get_logger(__name__)

load_dotenv()

OUTPUT_DIR = Path(os.getenv("EXPORT_OUTPUT_DIR", "export_output"))

def log_export_size(out_dir: Path):
    total_bytes = sum(f.stat().st_size for f in out_dir.rglob("*") if f.is_file())
    total_mb = total_bytes / (1024 * 1024)
    file_count = sum(1 for f in out_dir.rglob("*") if f.is_file())
    logger.info("Export size: %.1f MB across %d files", total_mb, file_count)

def main():
    logger.info("[EXPORT] Starting export — output dir: %s", OUTPUT_DIR)
    export_crashes_metadata(OUTPUT_DIR)
    export_cities(OUTPUT_DIR)
    export_boundaries(OUTPUT_DIR)
    export_annual_fatalities(OUTPUT_DIR)
    export_crashes(OUTPUT_DIR)
    logger.info("[EXPORT] Export complete")
    log_export_size(OUTPUT_DIR)

if __name__ == "__main__":
    main()