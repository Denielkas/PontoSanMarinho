import psycopg2
import os

def get_db():
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "localhost"),
        database=os.getenv("PG_DB", "bateponto"),
        user=os.getenv("PG_USER", "postgres"),
        password=os.getenv("PG_PASS", "123456"),
        port=os.getenv("PG_PORT", 5432)
    )
