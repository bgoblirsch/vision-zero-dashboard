#!/usr/bin/env python3
"""
download-fars.py

Usage examples:
  python download_file.py --url "https://example.com/fars_2022.zip" --source fars_2022
  python download_file.py --url "https://example.com/state_crashes.csv" --source ny_2022

This script downloads a file, writes it to data/raw/<source>/ and extracts zip files.
"""
import argparse
import sys
from pathlib import Path
from src.utils.downloader import download_file, extract_if_zip
from src.logger import get_logger

logger = get_logger(__name__)

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "raw"

def main():
    parser = argparse.ArgumentParser(description="Download FARS or other crash data file.")
    parser.add_argument("--url", required=True, help="Direct URL to download (zip/csv/etc).")
    parser.add_argument("--source", required=True, help="Short name for the source, e.g. fars_2022 or nyc_open_data_2022")
    parser.add_argument("--filename", default=None, help="Optional filename to save as (default uses remote name).")
    args = parser.parse_args()

    source_dir = DATA_DIR / args.source
    source_dir.mkdir(parents=True, exist_ok=True)

    # Determine filename
    if args.filename:
        fname = args.filename
    else:
        # try to derive from URL
        fname = args.url.split("?")[0].split("/")[-1] or "downloaded_file"

    dest_path = source_dir / fname

    if dest_path.exists():
        logger.info(f"File already exists: {dest_path}")
        sys.exit(0)

    logger.info(f"Downloading {args.url} -> {dest_path}")
    try:
        download_file(args.url, dest_path)
    except Exception as e:
        logger.error(f"Download failed: {e}")
        if dest_path.exists():
            try:
                dest_path.unlink()
            except Exception:
                pass
        sys.exit(1)

    # If zip, extract
    try:
        extracted = extract_if_zip(dest_path, source_dir)
        if extracted:
            logger.info(f"Extracted {len(extracted)} files to {source_dir}")
            for file in extracted:
                logger.info(f"{file} extracted to {source_dir}")
        else:
            logger.info(f"Saved file to {dest_path}")
    except Exception as e:
        logger.error(f"Extraction failed: {e}")

    print("[DONE]")

if __name__ == "__main__":
    main()