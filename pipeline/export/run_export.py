import os
from pathlib import Path
from export_crashes_metadata import export_crashes_metadata
from export_cities import export_cities
from export_boundaries import export_boundaries
from export_crashes import export_crashes
from export_annual_fatalities import export_annual_fatalities
from logger import get_logger

logger = get_logger(__name__)

OUTPUT_DIR = Path(os.getenv("EXPORT_OUT_DIR", "export_output"))

def main():
    logger.info("[EXPORT] Starting export — output dir: %s", OUTPUT_DIR)
    export_crashes_metadata(OUTPUT_DIR)
    export_cities(OUTPUT_DIR)
    export_boundaries(OUTPUT_DIR)
    export_annual_fatalities(OUTPUT_DIR)
    export_crashes(OUTPUT_DIR)
    logger.info("[EXPORT] Export complete")

if __name__ == "__main__":
    main()