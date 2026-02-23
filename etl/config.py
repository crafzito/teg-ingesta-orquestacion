import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    log_level: str
    batch_size: int
    sql_dir: Path
    project_root: Path
    watch_input_dir: Path
    watch_poll_seconds: int
    watch_skip_ddl_after_first: bool


def load_config(env_path: str | None = None) -> Config:
    project_root = Path(__file__).resolve().parent.parent
    if env_path:
        load_dotenv(env_path)
    else:
        for candidate in [project_root / ".env", project_root / ".env.example"]:
            if candidate.exists():
                load_dotenv(candidate)
                break

    watch_input_raw = os.getenv("WATCH_INPUT_DIR", "input")
    watch_input_path = Path(watch_input_raw)
    if not watch_input_path.is_absolute():
        watch_input_path = project_root / watch_input_path

    return Config(
        db_host=os.getenv("DB_HOST", "localhost"),
        db_port=int(os.getenv("DB_PORT", "5432")),
        db_name=os.getenv("DB_NAME", "teg_etl"),
        db_user=os.getenv("DB_USER", "etl_user"),
        db_password=os.getenv("DB_PASSWORD", "etl_pass"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        batch_size=int(os.getenv("BATCH_SIZE", "1000")),
        sql_dir=project_root / "sql",
        project_root=project_root,
        watch_input_dir=watch_input_path,
        watch_poll_seconds=int(os.getenv("WATCH_POLL_SECONDS", "300")),
        watch_skip_ddl_after_first=os.getenv("WATCH_SKIP_DDL_AFTER_FIRST", "true").lower() == "true",
    )
