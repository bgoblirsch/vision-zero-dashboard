import os
import psycopg
from contextlib import contextmanager
from logger import get_logger

logger = get_logger(__name__)

DB_HOST = os.environ["PGHOST"]
DB_NAME = os.environ["PGDATABASE"]
DB_USER = os.environ["PGUSER"]
DB_PASS = os.environ["PGPASSWORD"]
DB_PORT = os.environ.get("PGPORT", 5432)

@contextmanager
def get_conn():
    """
    Context manager that yields a PostgreSQL connection.
    Automatically commits if successful and rolls back on errors.
    """
    conn = psycopg.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT,
    )
    try:
        yield conn
        conn.commit()
    except Exception as e:
        logger.error(f"Failed to create PostgreSQL connection: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()