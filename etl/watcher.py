"""
watcher.py — File watcher con debounce para el pipeline ETL SAP

Monitorea la carpeta input/ y detecta cuando SAP sobreescribe los CSV.
Espera a que pasen N minutos sin cambios (debounce) antes de ejecutar
el pipeline, para asegurar que todos los archivos terminaron de subirse.

Uso:
  python watcher.py                          # defaults
  python watcher.py --dir /datos/sap/csvs    # ruta custom
  python watcher.py --debounce 180           # esperar 3 min
  python watcher.py --extensions .csv .CSV   # solo estos archivos

Comportamiento:
  - SAP sube archivo 1 a las 1:20 → timer se inicia (3 min)
  - SAP sube archivo 2 a las 1:22 → timer se reinicia (3 min desde ahora)
  - SAP sube archivo 19 a las 1:35 → timer se reinicia
  - 1:38 (3 min sin cambios) → ejecuta pipeline
  - Pipeline usa MD5 para skip de archivos sin cambios
  - Pipeline usa line_hash para skip de filas repetidas (UPSERT)
"""

import argparse
import hashlib
import logging
import os
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("watcher")

# ── Directorio del ETL (donde vive pipeline.py) ─────────────────
ETL_DIR = Path(__file__).resolve().parent
LOCK_FILE = ETL_DIR / ".watcher.lock"


class DebouncedETLHandler(FileSystemEventHandler):
    """
    Handler que acumula cambios y ejecuta el pipeline
    después de un período de silencio (debounce).
    """

    def __init__(self, data_dir: str, debounce_sec: int, extensions: set,
                 skip_raw: bool = False):
        super().__init__()
        self.data_dir = data_dir
        self.debounce_sec = debounce_sec
        self.extensions = extensions
        self.skip_raw = skip_raw

        self._timer = None
        self._lock = threading.Lock()
        self._changed_files = set()
        self._running = False
        self._ignored_suffixes = {".tmp", ".part", ".partial", ".crdownload"}

        # Snapshot de MD5 al inicio para detectar cambios reales
        self._file_hashes = self._snapshot_hashes()
        logger.info(f"Snapshot inicial: {len(self._file_hashes)} archivos monitoreados")

    def _iter_files(self):
        for f in Path(self.data_dir).rglob("*"):
            if f.is_file() and f.suffix.lower() in self.extensions and not self._should_ignore(f):
                yield f

    def _should_ignore(self, filepath: str | Path) -> bool:
        path = Path(filepath)
        name = path.name.lower()
        return (
            name.startswith("~$")
            or name.startswith(".")
            or path.suffix.lower() in self._ignored_suffixes
        )

    def _snapshot_hashes(self) -> dict:
        """MD5 de todos los archivos monitoreados."""
        hashes = {}
        for f in self._iter_files():
            try:
                hashes[str(f)] = self._file_md5(str(f))
            except OSError:
                pass
        return hashes

    @staticmethod
    def _file_md5(filepath: str) -> str:
        h = hashlib.md5()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    def _content_changed(self, filepath: str) -> bool:
        """Verifica si el contenido realmente cambió (no solo el timestamp)."""
        try:
            new_hash = self._file_md5(filepath)
        except OSError:
            return False

        old_hash = self._file_hashes.get(filepath)
        if new_hash != old_hash:
            self._file_hashes[filepath] = new_hash
            return True
        return False

    def on_modified(self, event):
        if event.is_directory:
            return
        self._handle_change(event.src_path)

    def on_created(self, event):
        if event.is_directory:
            return
        self._handle_change(event.src_path)

    def on_moved(self, event):
        if event.is_directory:
            return
        self._handle_change(event.dest_path)

    def _handle_change(self, filepath: str):
        """Procesa un cambio detectado en un archivo."""
        path = Path(filepath)
        ext = path.suffix.lower()
        if ext not in self.extensions:
            return
        if self._should_ignore(path):
            return

        # Esperar un momento para que el archivo termine de escribirse
        time.sleep(1)

        # Verificar que el contenido realmente cambió (no solo metadata)
        if not self._content_changed(filepath):
            return

        filename = os.path.relpath(filepath, self.data_dir)
        with self._lock:
            self._changed_files.add(filename)
            logger.info(
                f"Cambio detectado: {filename} "
                f"({len(self._changed_files)} archivo(s) pendientes) "
                f"→ esperando {self.debounce_sec}s de silencio"
            )
            self._reset_timer()

    def _reset_timer(self):
        """Reinicia el temporizador de debounce."""
        if self._timer is not None:
            self._timer.cancel()
        self._timer = threading.Timer(self.debounce_sec, self._trigger_pipeline)
        self._timer.daemon = True
        self._timer.start()

    def _trigger_pipeline(self):
        """Ejecuta el pipeline después del debounce."""
        with self._lock:
            if self._running:
                logger.warning("Pipeline ya está corriendo, reintentando en 60s")
                self._timer = threading.Timer(60, self._trigger_pipeline)
                self._timer.daemon = True
                self._timer.start()
                return

            changed = self._changed_files.copy()
            self._changed_files.clear()
            self._running = True

        logger.info("=" * 60)
        logger.info(f"DEBOUNCE EXPIRADO — Ejecutando pipeline")
        logger.info(f"Archivos modificados: {', '.join(sorted(changed))}")
        logger.info("=" * 60)

        try:
            batch_id = datetime.now().astimezone().strftime(
                "watcher-%Y%m%d-%H%M%S"
            ) + f"-{uuid.uuid4().hex[:8]}"
            cmd = [
                sys.executable,
                str(ETL_DIR / "pipeline.py"),
                "--dir", self.data_dir,
                "--batch-id", batch_id,
                "--batch-trigger", "WATCHER",
            ]
            if self.skip_raw:
                cmd.append("--skip-raw")
            for filename in sorted(changed):
                cmd.extend(["--batch-file", filename])

            result = subprocess.run(
                cmd,
                capture_output=False,
                text=True,
                cwd=str(ETL_DIR),
                env={**os.environ, "PYTHONPATH": str(ETL_DIR.parent)},
            )

            if result.returncode == 0:
                logger.info("Pipeline completado exitosamente (batch=%s)", batch_id)
            else:
                logger.error("Pipeline falló con código %s (batch=%s)", result.returncode, batch_id)

        except Exception as e:
            logger.error(f"Error ejecutando pipeline: {e}")
        finally:
            with self._lock:
                self._running = False

            # Actualizar snapshot después de procesar
            self._file_hashes = self._snapshot_hashes()
            logger.info("Esperando nuevos cambios...")


def main():
    parser = argparse.ArgumentParser(
        description="File watcher para ETL SAP — detecta cambios y ejecuta pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplo de uso en servidor Linux:
  # Foreground (testing)
  python watcher.py --dir /datos/sap/csvs --debounce 180

  # Background con nohup
  nohup python watcher.py --dir /datos/sap/csvs > /var/log/etl/watcher.log 2>&1 &

  # Systemd service (producción)
  # Ver etl/watcher.service

Flujo:
  1. SAP sobreescribe CSV cada 2 horas (archivos llegan en secuencia)
  2. Watcher detecta cambios de contenido (MD5, no solo timestamp)
  3. Timer de debounce se reinicia con cada cambio
  4. Cuando pasan N segundos sin cambios → ejecuta pipeline
  5. Pipeline hace UPSERT idempotente (skip filas sin cambios)
        """,
    )
    parser.add_argument(
        "--dir",
        default=str(ETL_DIR.parent / "data" / "input"),
        help="Carpeta a monitorear (default: data/input/)",
    )
    parser.add_argument(
        "--debounce",
        type=int,
        default=180,
        help="Segundos de silencio antes de ejecutar (default: 180 = 3 min)",
    )
    parser.add_argument(
        "--extensions",
        nargs="+",
        default=[".csv"],
        help="Extensiones a monitorear (default: .csv)",
    )
    parser.add_argument(
        "--skip-raw",
        action="store_true",
        help="No cargar raw histórico al ejecutar pipeline",
    )
    args = parser.parse_args()

    data_dir = os.path.abspath(args.dir)
    if not os.path.isdir(data_dir):
        logger.error(f"Directorio no existe: {data_dir}")
        sys.exit(1)

    extensions = {ext.lower() if ext.startswith(".") else f".{ext.lower()}"
                  for ext in args.extensions}

    logger.info("=" * 60)
    logger.info("SAP ETL Watcher")
    logger.info(f"  Monitoreando: {data_dir}")
    logger.info(f"  Debounce:     {args.debounce}s ({args.debounce // 60} min)")
    logger.info(f"  Extensiones:  {extensions}")
    logger.info(f"  Pipeline:     {ETL_DIR / 'pipeline.py'}")
    logger.info("=" * 60)
    logger.info("Esperando cambios... (Ctrl+C para detener)")

    handler = DebouncedETLHandler(
        data_dir=data_dir,
        debounce_sec=args.debounce,
        extensions=extensions,
        skip_raw=args.skip_raw,
    )

    observer = Observer()
    observer.schedule(handler, data_dir, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Detenido por el usuario")
        observer.stop()

    observer.join()


if __name__ == "__main__":
    main()
