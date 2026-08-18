import time

from pipeline.etl.transform.derive_crash_hotspots import run_derive_crash_hotspots
from pipeline.logger import get_logger

logger = get_logger(__name__)


def main() -> None:
    start = time.time()

    run_derive_crash_hotspots()

    elapsed = time.time() - start
    logger.info("[PIPELINE][HOTSPOTS] Finished running hotspots pipeline. Duration: %.2fs", elapsed)


if __name__ == "__main__":
    main()