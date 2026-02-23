import logging
from pathlib import Path

from etl.db.connection import execute_sql_file

logger = logging.getLogger(__name__)

SQL_ORDER = [
    "001_schemas.sql",
    "002_staging_tables.sql",
    "003_core_dimensions.sql",
    "004_core_fact.sql",
    "005_control_tables.sql",
    "006_indexes.sql",
    "007_partitions.sql",
    "008_views.sql",
]


def initialize_database(conn, sql_dir: Path) -> None:
    logger.info("Inicializando base de datos desde %s", sql_dir)
    for filename in SQL_ORDER:
        filepath = sql_dir / filename
        if not filepath.exists():
            raise FileNotFoundError(f"SQL script no encontrado: {filepath}")
        execute_sql_file(conn, str(filepath))
    logger.info("Base de datos inicializada correctamente")
