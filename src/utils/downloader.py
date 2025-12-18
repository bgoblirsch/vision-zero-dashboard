#!/usr/bin/env python3
import requests
import zipfile
from tqdm import tqdm
from pathlib import Path

from logger import get_logger

logger = get_logger(__name__)

def extract_if_zip(file_path: Path, extract_to: Path) -> list[Path]:
    '''
    If the file at "path" is a zip, extracts it to "extract_to" path.
    
    :param path: Description
    :type path: Path
    :param extract_to: Description
    :type extract_to: Path
    '''
    if not file_path.exists():
        raise FileNotFoundError(f"ZIP file does not exist: {file_path}") 
    
    if not zipfile.is_zipfile(file_path):
        return [file_path]
    
    extract_to.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(file_path, "r") as zip:
            zip.extractall(extract_to)
    except zipfile.BadZipFile:
        # Let this propagate — it's specific and useful
        raise

    #csv_files = list(path.parent.glob("*.csv"))
    csv_files = [
        path for path in extract_to.rglob("*")
        if path.is_file() and path.suffix.casefold() == ".csv"
    ]

    if not csv_files:
        raise ValueError(f"No CSV files found after extracting {file_path}")

    for csv in csv_files:
        target = extract_to / csv.name
        if csv.parent != extract_to:
            csv.replace(target)

    return list(extract_to.glob("*.csv"))

def download_file(url: str, dest: Path, chunk_size: int = 8192) -> Path:
    """
    Download a file from "url" to "dest" while streaming bytes with a tqdm progress bar.

    :param url: HTTP(S) URL to download.
    :type url: str
    :param dest: Local filesystem path where the bytes should be written.
    :type dest: Path
    :param chunk_size: Chunk size (in bytes) to read from the response stream.
    :type chunk_size: int
    :returns: The ``Path`` to the downloaded file.
    :rtype: Path
    :raises requests.HTTPError: If the server responds with an unsuccessful status code.
    :raises requests.Timeout: If the request exceeds the timeout.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
    # Stream download with progress bar
        with requests.get(url, stream=True, timeout=60) as req:
            req.raise_for_status()
            total = int(req.headers.get("content-length", 0))
            with open(dest, "wb") as file, tqdm(total=total, unit="B", unit_scale=True, desc=dest.name) as progress_bar:
                for chunk in req.iter_content(chunk_size=chunk_size):
                    write_chunk(file, chunk, progress_bar)
    except Exception:
        if dest.exists():
            dest.unlink(missing_ok=True)
        raise
    return dest

def write_chunk(file, chunk, progress_bar) -> None:
    '''
    Helper for download_file. Writes chunk if it exists.
    
    :param file: File being written to.
    :param chunk: chunk being written.
    :param progress_bar: pdqm progress bar object
    '''
    if chunk:
        file.write(chunk)
        progress_bar.update(len(chunk))