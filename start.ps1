# TEG - Inicio rapido
# Uso: .\start.ps1              → watcher + frontend
#      .\start.ps1 -RunNow      → ejecuta pipeline al iniciar + watcher + frontend
#      .\start.ps1 -WatcherOnly → solo watcher

param(
    [switch]$RunNow,
    [switch]$WatcherOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host ""
Write-Host "  TEG - Inicio rapido" -ForegroundColor Cyan
Write-Host "  ====================" -ForegroundColor Cyan

# --- Levantar Docker (postgres + backend, sin frontend ni watcher) ---
Write-Host "  Levantando Docker (postgres + backend)..." -NoNewline
docker compose up -d postgres 2>$null | Out-Null
docker compose up -d db-init seed-users backend 2>$null | Out-Null
Write-Host " OK" -ForegroundColor Green

# --- Esperar que backend responda ---
Write-Host "  Esperando backend..." -NoNewline
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8011/api/health" -TimeoutSec 2
        if ($health.status -eq "ok") { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if ($ready) {
    Write-Host " OK (localhost:8011)" -ForegroundColor Green
} else {
    Write-Host " FALLO" -ForegroundColor Red
    Write-Host "  Backend no responde. Revisa: docker compose logs backend" -ForegroundColor Yellow
    exit 1
}

# --- Activar venv ---
$venvActivate = Join-Path $Root ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    & $venvActivate
}

# --- Variables de entorno ---
$env:PG_DSN = "host=localhost port=5434 dbname=sap_etl user=postgres password=postgres"
$env:DB_HOST = "localhost"
$env:DB_PORT = "5434"
$env:DB_NAME = "sap_etl"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres"
$env:SAP_CSV_DIR = Join-Path $Root "data\input"
$env:PYTHONPATH = $Root

# --- Parar watcher de Docker si esta corriendo ---
$dockerWatcher = docker compose ps watcher --format "{{.State}}" 2>$null
if ($dockerWatcher -eq "running") {
    Write-Host "  Deteniendo watcher Docker..." -NoNewline
    docker compose stop watcher 2>$null | Out-Null
    Write-Host " OK" -ForegroundColor Green
}

# --- Iniciar frontend ---
$frontendJob = $null
if (-not $WatcherOnly) {
    Write-Host "  Iniciando frontend..." -NoNewline
    $frontendDir = Join-Path $Root "frontedTEG"
    $frontendJob = Start-Process -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory $frontendDir -PassThru -WindowStyle Minimized
    Write-Host " OK (PID $($frontendJob.Id), http://localhost:5176)" -ForegroundColor Green
}

# --- Iniciar watcher ---
Write-Host ""
$watcherArgs = @("etl/watcher.py", "--dir", "data/input", "--debounce", "2")
if ($RunNow) {
    $watcherArgs += "--run-now"
    Write-Host "  Watcher + pipeline inmediato" -ForegroundColor Yellow
} else {
    Write-Host "  Watcher activo (debounce 2s)" -ForegroundColor Yellow
}
Write-Host "  Monitoreando: $Root\data\input" -ForegroundColor DarkGray
Write-Host "  Ctrl+C para detener" -ForegroundColor DarkGray
Write-Host ""

try {
    python @watcherArgs
} finally {
    if ($frontendJob -and -not $frontendJob.HasExited) {
        Write-Host "`n  Deteniendo frontend..." -NoNewline
        Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
        Write-Host " OK" -ForegroundColor Green
    }
    Write-Host "  Bye!" -ForegroundColor Green
}
