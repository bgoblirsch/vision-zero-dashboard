from db.connection import get_conn
from logger import get_logger

logger = get_logger(__name__)

try:
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Simple query to check the connection
            cur.execute("SELECT version();")
            version = cur.fetchone()
            if version is None:
                logger.error("No rows returned by SELECT version(); check the connection and query.")
            else:
                logger.info(f"PostgreSQL version: {version[0]}")
except Exception as e:
    logger.error(f"Failed to connect to PostgreSQL: {e}")
    raise