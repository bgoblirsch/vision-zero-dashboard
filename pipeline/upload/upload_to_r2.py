import os
import mimetypes
from pathlib import Path
import boto3
from botocore.config import Config
from dotenv import load_dotenv
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed

from pipeline.logger import get_logger

logger = get_logger(__name__)

load_dotenv()

ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "visionzero-data")
EXPORT_OUTPUT_DIR = Path(os.getenv("EXPORT_OUTPUT_DIR", "exports"))

MIME_OVERRIDES = {
    ".geojson": "application/geo+json",
    ".json": "application/json",
}


def get_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def get_content_type(path: Path) -> str:
    return MIME_OVERRIDES.get(path.suffix, mimetypes.guess_type(path.name)[0] or "application/octet-stream")


def upload_file(client, path, key, content_type, dry_run):
    if dry_run:
        logger.info("[dry-run] %s → %s", path, key)
        return key
    client = get_client()
    client.put_object(
        Bucket=BUCKET_NAME,
        Key=key,
        Body=path.read_bytes(),
        ContentType=content_type,
    )
    return key


def upload_all(dry_run: bool = False):
    client = get_client()
    files = list(EXPORT_OUTPUT_DIR.rglob("*"))
    files = [f for f in files if f.is_file()]
    total = len(files)

    logger.info("Uploading %d files from %s", total, EXPORT_OUTPUT_DIR)

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(upload_file, client, path, str(path.relative_to(EXPORT_OUTPUT_DIR)), get_content_type(path), dry_run): path
            for path in files
        }
        for i, future in enumerate(tqdm(as_completed(futures), total=total, desc="Uploading", ncols=80), 1):
            try:
                future.result()
            except Exception as e:
                logger.error("Failed: %s", e)
                raise
    logger.info("Upload complete")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Log files without uploading")
    args = parser.parse_args()
    upload_all(dry_run=args.dry_run)