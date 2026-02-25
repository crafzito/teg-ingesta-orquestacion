#!/bin/bash
# ================================================================
# run_etl.sh — Script de cronjob para el ETL SAP
# ================================================================
# Uso:
#   ./run_etl.sh                   # carga todo
#   ./run_etl.sh --dry-run         # solo validar
#   ./run_etl.sh --source PHXX     # solo ventas
#
# Cronjob recomendado (cada 2 horas):
#   0 */2 * * * /opt/etl/run_etl.sh >> /var/log/etl/cron.log 2>&1
#
# Variables de entorno requeridas:
#   SAP_CSV_DIR   → carpeta con los CSV de SAP
#   PG_DSN        → cadena de conexión PostgreSQL
#
# Si no están definidas, usa los valores por defecto de abajo.
# ================================================================

set -euo pipefail

# ── Configuración ────────────────────────────────────────────────
SAP_CSV_DIR="${SAP_CSV_DIR:-/datos/sap/csvs}"
PG_DSN="${PG_DSN:-host=localhost dbname=sap_etl user=postgres password=postgres}"
ETL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/var/log/etl"
LOCK_FILE="/tmp/sap_etl.lock"
PYTHON="${PYTHON:-python3}"

# ── Logging ──────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/etl_$(date +%Y%m%d).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ── Lock: evitar ejecuciones paralelas ───────────────────────────
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        log "SKIP: Ya hay un proceso ETL corriendo (PID $PID)"
        exit 0
    else
        log "WARN: Lock obsoleto (PID $PID ya no existe), limpiando"
        rm -f "$LOCK_FILE"
    fi
fi

echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"; log "ETL finalizado"' EXIT

# ── Verificar que el directorio de datos existe ───────────────────
if [ ! -d "$SAP_CSV_DIR" ]; then
    log "ERROR: Directorio de datos no encontrado: $SAP_CSV_DIR"
    exit 1
fi

# ── Rotar logs mayores a 50MB ─────────────────────────────────────
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 52428800 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    log "Log rotado"
fi

# ── Ejecutar ETL ─────────────────────────────────────────────────
log "=============================================="
log "Iniciando ETL SAP"
log "  Datos: $SAP_CSV_DIR"
log "  DB:    $(echo $PG_DSN | sed 's/password=[^ ]*/password=***/g')"
log "=============================================="

cd "$ETL_DIR"

export PG_DSN

$PYTHON pipeline.py \
    --dir "$SAP_CSV_DIR" \
    "$@" \
    2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -eq 0 ]; then
    log "ETL completado exitosamente"
else
    log "ETL FALLÓ con código $EXIT_CODE"
fi

exit $EXIT_CODE
