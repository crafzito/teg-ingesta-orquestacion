"""
Polling file watcher para procesamiento automatico del ETL.

Escanea un directorio de entrada buscando archivos de ventas (obligatorio)
y opcionalmente clientes (tabla maestra) depositados por SAP.

Convencion de nombres requerida:
    ventas_YYYYMMDD_HHMMSS.csv              (obligatorio, cada hora)
    clientes_YYYYMMDD_HHMMSS.csv            (opcional, solo cuando cambia la maestra)

Uso:
    python -m etl --watch
    python -m etl.watcher
    python -m etl.watcher --poll-seconds 60
"""

import argparse
import logging
import re
import signal
import time
from pathlib import Path

from etl.config import Config, load_config
from etl.db.connection import get_connection
from etl.run import run_pipeline, setup_logging

logger = logging.getLogger("etl.watcher")

FILE_PATTERN = re.compile(r"^(clientes|ventas)_(\d{8}_\d{6})\.csv$", re.IGNORECASE)

_shutdown_requested = False


def _handle_signal(signum, _frame):
    global _shutdown_requested
    logger.info(
        "Senal de parada recibida (signal %d). Finalizando tras el ciclo actual...",
        signum,
    )
    _shutdown_requested = True


def discover_pending(input_dir: Path) -> list[tuple[str, Path, Path | None]]:
    """
    Escanea input_dir buscando archivos de ventas (primario) y opcionalmente
    archivos de clientes con el mismo timestamp.

    Retorna lista de (timestamp_key, ventas_path, clientes_path_or_None)
    ordenada cronologicamente.
    """
    clientes: dict[str, Path] = {}
    ventas: dict[str, Path] = {}

    if not input_dir.exists():
        logger.warning("Directorio de entrada no existe: %s", input_dir)
        return []

    for f in input_dir.iterdir():
        if not f.is_file():
            continue
        m = FILE_PATTERN.match(f.name)
        if not m:
            continue
        file_type = m.group(1).lower()
        ts_key = m.group(2)
        if file_type == "clientes":
            clientes[ts_key] = f
        else:
            ventas[ts_key] = f

    # Clientes sin ventas son huerfanos reales (no se procesan solos)
    orphan_cli = set(clientes.keys()) - set(ventas.keys())
    for ts in orphan_cli:
        logger.warning("Archivo clientes huerfano (sin ventas pareja): %s", clientes[ts].name)

    # Ventas es el archivo primario; clientes es opcional
    pending = []
    for ts_key in sorted(ventas.keys()):
        clientes_path = clientes.get(ts_key)  # None si no existe
        pending.append((ts_key, ventas[ts_key], clientes_path))

    return pending


def get_processed_timestamps(config: Config) -> set[str]:
    """
    Consulta core.etl_batch para obtener timestamps ya procesados
    (COMPLETED o FAILED).
    """
    processed = set()
    conn = get_connection(config)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT batch_id FROM core.etl_batch WHERE batch_id LIKE 'watch_%%'"
            )
            for (batch_id,) in cur.fetchall():
                ts = batch_id.replace("watch_", "", 1)
                processed.add(ts)
    except Exception:
        logger.debug("No se pudo consultar etl_batch (puede que no exista aun)")
    finally:
        conn.close()
    return processed


def is_file_stable(path: Path, wait_seconds: int = 5) -> bool:
    """
    Verifica que un archivo no se esta escribiendo actualmente.
    Compara el tamano en dos puntos separados por wait_seconds.
    """
    try:
        size_1 = path.stat().st_size
        if size_1 == 0:
            return False
        time.sleep(wait_seconds)
        size_2 = path.stat().st_size
        return size_1 == size_2
    except OSError:
        return False


def _poll_cycle(
    config: Config,
    input_dir: Path,
    env_path: str | None,
    ddl_done: bool,
) -> bool:
    """
    Un ciclo de polling: descubrir archivos, filtrar procesados,
    ejecutar pipeline para cada lote nuevo.

    Retorna True si DDL ya fue ejecutado al menos una vez.
    """
    pending = discover_pending(input_dir)
    if not pending:
        return ddl_done

    processed = get_processed_timestamps(config)
    new_items = [(ts, vp, cp) for ts, vp, cp in pending if ts not in processed]

    if not new_items:
        return ddl_done

    logger.info("Encontrados %d lotes nuevos para procesar", len(new_items))

    for ts_key, ventas_path, clientes_path in new_items:
        if _shutdown_requested:
            logger.info("Parada solicitada, deteniendo procesamiento")
            break

        # Verificar estabilidad del archivo de ventas (obligatorio)
        if not is_file_stable(ventas_path):
            logger.warning(
                "Archivo ventas %s aun se esta escribiendo, posponiendo",
                ventas_path.name,
            )
            continue

        # Si hay clientes, verificar estabilidad tambien
        if clientes_path and not is_file_stable(clientes_path):
            logger.warning(
                "Archivo clientes %s aun se esta escribiendo, posponiendo",
                clientes_path.name,
            )
            continue

        batch_id = f"watch_{ts_key}"
        skip_ddl = ddl_done and config.watch_skip_ddl_after_first

        if clientes_path:
            logger.info(
                "Procesando lote %s: ventas=%s, clientes=%s, batch_id=%s",
                ts_key, ventas_path.name, clientes_path.name, batch_id,
            )
        else:
            logger.info(
                "Procesando lote %s: ventas=%s (sin clientes), batch_id=%s",
                ts_key, ventas_path.name, batch_id,
            )

        try:
            run_pipeline(
                ventas_path=str(ventas_path),
                batch_id=batch_id,
                clientes_path=str(clientes_path) if clientes_path else None,
                skip_ddl=skip_ddl,
                env_path=env_path,
            )
            logger.info("Lote %s procesado exitosamente", ts_key)
            ddl_done = True
        except Exception:
            logger.error("Error procesando lote %s", ts_key, exc_info=True)

    return ddl_done


def run_watcher(
    env_path: str | None = None,
    poll_override: int | None = None,
) -> None:
    """
    Loop principal del watcher. Escanea el directorio de entrada
    cada N segundos buscando archivos nuevos.
    """
    global _shutdown_requested
    _shutdown_requested = False

    config = load_config(env_path)
    setup_logging(config.log_level)

    poll_seconds = poll_override or config.watch_poll_seconds
    input_dir = config.watch_input_dir

    input_dir.mkdir(parents=True, exist_ok=True)

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    logger.info("=== Watcher iniciado ===")
    logger.info("  Directorio: %s", input_dir)
    logger.info("  Intervalo:  %d segundos", poll_seconds)
    logger.info("  Archivos:   ventas_YYYYMMDD_HHMMSS.csv (obligatorio)")
    logger.info("              clientes_YYYYMMDD_HHMMSS.csv (opcional, tabla maestra)")

    ddl_done = False

    while not _shutdown_requested:
        try:
            ddl_done = _poll_cycle(config, input_dir, env_path, ddl_done)
        except Exception:
            logger.error("Error en ciclo de polling", exc_info=True)

        for _ in range(poll_seconds):
            if _shutdown_requested:
                break
            time.sleep(1)

    logger.info("=== Watcher detenido ===")


def main():
    parser = argparse.ArgumentParser(
        description="ETL Watcher: monitorea directorio para procesamiento automatico",
    )
    parser.add_argument("--env", default=None, help="Ruta al archivo .env")
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=None,
        help="Override del intervalo de polling en segundos",
    )
    args = parser.parse_args()
    run_watcher(env_path=args.env, poll_override=args.poll_seconds)


if __name__ == "__main__":
    main()
