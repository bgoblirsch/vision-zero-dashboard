#!/usr/bin/env python3
"""
preview_fars.py

Preview CSV files in a FARS data folder.
"""
import pandas as pd
import argparse
from pathlib import Path
from logger import get_logger

logger = get_logger(__name__)

# Path to the folder where FARS CSVs were extracted
parser = argparse.ArgumentParser(description="Preview CSV files in a data folder")
parser.add_argument(
    "--folder",
    type=str,
    required=True,
    help="Path to the folder containing CSV files to preview"
)
args = parser.parse_args()

FOLDER = Path(args.folder).resolve()

def main():
    csv_files = [file for file in FOLDER.iterdir() if file.suffix.lower() == ".csv"]
    if not csv_files:
        logger.warning(f"No CSV files found in {FOLDER}")
        return

    for csv_file in csv_files:
        print(f"\n=== Previewing {csv_file.name} ===")
        try:
            df = pd.read_csv(csv_file, low_memory=False)
        except Exception as e:
            logger.error(f"Failed to read {csv_file}: {e}")
            continue

        # Show columns
        print("Columns:", df.columns.tolist())

        # Show number of rows
        print("Number of rows:", len(df))

        # Show first 5 rows
        print("\nFirst 5 rows:")
        print(df.head())

        # Optional: show count of missing values per column
        print("\nMissing values per column:")
        print(df.isna().sum())

if __name__ == "__main__":
    main()
