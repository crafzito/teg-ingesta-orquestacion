import logging
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from etl.config import Config

logger = logging.getLogger(__name__)


def get_connection(config: Config):
    conn = psycopg2.connect(
        host=config.db_host,
        port=config.db_port,
        dbname=config.db_name,
        user=config.db_user,
        password=config.db_password,
    )
    conn.autocommit = False
    return conn


@contextmanager
def transaction(conn):
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def execute_sql_file(conn, filepath: str) -> None:
    logger.info("Ejecutando SQL: %s", filepath)
    with open(filepath, "r", encoding="utf-8") as f:
        sql = f.read()
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
