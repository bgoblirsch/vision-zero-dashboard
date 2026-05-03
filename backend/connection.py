import psycopg
import os

def get_conn():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        dbname=os.getenv("DB_NAME", "visionzero_db"),
        user=os.getenv("DB_USER", "visionzero"),
        password=os.getenv("DB_PASSWORD", ""),
    )