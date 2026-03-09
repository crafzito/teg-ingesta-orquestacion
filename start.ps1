# ============================================================
# start.ps1 — Setup y arranque del proyecto SAP ETL
# ============================================================
# Uso:
#   .\start.ps1              # Setup completo + levanta backend
#   .\start.ps1 -SkipDocker  # Asume Postgres ya está corriendo
#   .\start.ps1 -SkipSchema  # No re-aplica schema.sql
#   .\start.ps1 -ETL         # Corre el pipeline ETL después del setup
#   .\start.ps1 -BackendOnly # Solo levanta uvicorn (sin setup)
#
# Prerequisitos:
#   - Docker Desktop instalado y corriendo
#   - Python 3.11+ en PATH
# ============================================================

param(
    [switch]$SkipDocker,
    [switch]$SkipSchema,
    [switch]$ETL,
    [switch]$BackendOnly,
    [string]$CsvDir = "data/input"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Colores helpers ---
function Write-Step  { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "    [!]  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "    [X]  $msg" -ForegroundColor Red }

# --- Leer .env ---
function Load-Env {
    $envFile = Join-Path $Root ".env"
    if (-not (Test-Path $envFile)) {
        Copy-Item (Join-Path $Root ".env.example") $envFile
        Write-Warn ".env no encontrado, se creo desde .env.example"
    }
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            if (-not [Environment]::GetEnvironmentVariable($key, "Process")) {
                [Environment]::SetEnvironmentVariable($key, $val, "Process")
            }
        }
    }
}

Load-Env

$DB_HOST = $env:DB_HOST ?? "localhost"
$DB_PORT = $env:DB_PORT ?? "5432"
$DB_NAME = $env:DB_NAME ?? "sap_etl"
$DB_USER = $env:DB_USER ?? "postgres"
$DB_PASS = $env:DB_PASSWORD ?? "postgres"
$PG_DSN  = $env:PG_DSN ?? "host=$DB_HOST dbname=$DB_NAME user=$DB_USER password=$DB_PASS"

Write-Host ""
Write-Host "============================================================" -ForegroundColor White
Write-Host "  SAP ETL — Setup" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor White
Write-Host "  DB: $DB_NAME @ $DB_HOST`:$DB_PORT (user: $DB_USER)"
Write-Host "  CSV dir: $CsvDir"
Write-Host "============================================================" -ForegroundColor White

# ============================================================
# MODO SOLO BACKEND
# ============================================================
if ($BackendOnly) {
    Write-Step "Levantando backend (uvicorn)"
    Set-Location $Root
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
    exit 0
}

# ============================================================
# PASO 1: Docker Compose
# ============================================================
if (-not $SkipDocker) {
    Write-Step "Iniciando PostgreSQL con Docker Compose"

    $dockerOk = $null
    try { $dockerOk = docker info 2>&1 } catch {}

    if (-not $dockerOk -or $dockerOk -match "error") {
        Write-Fail "Docker no esta corriendo. Inicia Docker Desktop e intenta de nuevo."
        exit 1
    }

    Set-Location $Root
    docker compose up -d postgres
    Write-Ok "Contenedor iniciado"

    # Esperar a que PostgreSQL acepte conexiones (max 30s)
    Write-Host "    Esperando que PostgreSQL este listo..." -NoNewline
    $retries = 0
    $ready   = $false
    while ($retries -lt 30) {
        $result = docker exec sap_etl_postgres pg_isready -U $DB_USER 2>&1
        if ($result -match "accepting connections") {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
        $retries++
    }
    Write-Host ""

    if (-not $ready) {
        Write-Fail "PostgreSQL no respondio en 30 segundos."
        exit 1
    }
    Write-Ok "PostgreSQL listo"
}

# ============================================================
# PASO 2: Crear base de datos (si no existe)
# ============================================================
Write-Step "Verificando base de datos '$DB_NAME'"

$dbExists = docker exec sap_etl_postgres psql -U $DB_USER -lqt 2>&1 | Select-String $DB_NAME
if (-not $dbExists) {
    docker exec sap_etl_postgres psql -U $DB_USER -c "CREATE DATABASE $DB_NAME" postgres 2>&1 | Out-Null
    Write-Ok "Base de datos '$DB_NAME' creada"
} else {
    Write-Ok "Base de datos '$DB_NAME' ya existe"
}

# ============================================================
# PASO 3: Aplicar schema.sql
# ============================================================
if (-not $SkipSchema) {
    Write-Step "Aplicando schema (sql/schema.sql)"
    $schemaFile = Join-Path $Root "sql\schema.sql"
    if (-not (Test-Path $schemaFile)) {
        Write-Fail "No se encontro sql/schema.sql"
        exit 1
    }
    docker cp $schemaFile sap_etl_postgres:/tmp/schema.sql
    docker exec sap_etl_postgres psql -U $DB_USER -d $DB_NAME -f /tmp/schema.sql 2>&1 | Out-Null
    Write-Ok "Schema aplicado (schemas: cat, dim, fact, raw, etl)"
} else {
    Write-Warn "Schema omitido (-SkipSchema)"
}

# ============================================================
# PASO 4: Instalar dependencias Python
# ============================================================
Write-Step "Instalando dependencias Python"

$venv = Join-Path $Root ".venv"
if (-not (Test-Path $venv)) {
    python -m venv $venv
    Write-Ok "Virtualenv creado en .venv/"
}

$python = Join-Path $venv "Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Fail "Python no encontrado en el entorno virtual. Recreando..."
    Remove-Item $venv -Recurse -Force -ErrorAction SilentlyContinue
    python -m venv $venv
    $python = Join-Path $venv "Scripts\python.exe"
}

& $python -m pip install -r (Join-Path $Root "requirements.txt") --quiet
Write-Ok "Dependencias instaladas"

# ============================================================
# PASO 5 (opcional): Correr el ETL
# ============================================================
if ($ETL) {
    Write-Step "Ejecutando ETL pipeline (--dir $CsvDir)"
    $csvPath = Join-Path $Root $CsvDir

    if (-not (Test-Path $csvPath)) {
        Write-Warn "Directorio de CSVs no encontrado: $csvPath"
        Write-Warn "Coloca los archivos CSV de SAP en '$CsvDir' y ejecuta:"
        Write-Warn "  python etl/pipeline.py --dir $CsvDir"
    } else {
        $env:PG_DSN = $PG_DSN
        & $python (Join-Path $Root "etl\pipeline.py") --dir $csvPath
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "ETL completado"
        } else {
            Write-Fail "ETL termino con errores (codigo $LASTEXITCODE)"
        }
    }
}

# ============================================================
# PASO 6: Levantar backend FastAPI
# ============================================================
Write-Step "Levantando backend FastAPI"
Write-Host ""
Write-Host "  API:     http://localhost:8000" -ForegroundColor White
Write-Host "  Docs:    http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Health:  http://localhost:8000/api/health" -ForegroundColor White
Write-Host "  Schema:  http://localhost:8000/api/schema" -ForegroundColor White
Write-Host ""
Write-Host "  Para correr el ETL manualmente:" -ForegroundColor Yellow
Write-Host "    `$env:PG_DSN = '$PG_DSN'" -ForegroundColor Yellow
Write-Host "    python etl/pipeline.py --dir $CsvDir" -ForegroundColor Yellow
Write-Host "    python etl/pipeline.py --dir $CsvDir --dry-run  # solo validar" -ForegroundColor Yellow
Write-Host "    python etl/pipeline.py --dir $CsvDir --source PHXX  # solo ventas" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener el servidor." -ForegroundColor DarkGray
Write-Host ""

Set-Location $Root
& $python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
