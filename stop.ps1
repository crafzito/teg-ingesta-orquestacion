# ============================================================
# stop.ps1 - Stop the local TEG stack started by start.ps1
# ============================================================
# Usage:
#   .\stop.ps1            # Stop backend, watcher, frontend, and postgres
#   .\stop.ps1 -KeepDocker
# ============================================================

param(
    [switch]$KeepDocker
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeDir = Join-Path $Root ".runtime"
$ProcessFile = Join-Path $RuntimeDir "dev-processes.json"

function Write-Step { param([string]$Message) Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok { param([string]$Message) Write-Host "    [OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "    [!]  $Message" -ForegroundColor Yellow }

function Read-TrackedProcesses {
    if (-not (Test-Path $ProcessFile)) {
        return @()
    }

    $raw = Get-Content $ProcessFile -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @()
    }

    return @($raw | ConvertFrom-Json)
}

function Test-ProcessAlive {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $false
    }

    try {
        Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return
    }

    taskkill /PID $ProcessId /T /F | Out-Null
}

$tracked = @(Read-TrackedProcesses)
if (@($tracked).Count -eq 0) {
    Write-Warn "No hay procesos registrados en $ProcessFile"
} else {
    foreach ($proc in $tracked) {
        if (Test-ProcessAlive -ProcessId ([int]$proc.pid)) {
            Write-Step "Deteniendo $($proc.name) (PID $($proc.pid))"
            Stop-ProcessTree -ProcessId ([int]$proc.pid)
            Write-Ok "$($proc.name) detenido"
        } else {
            Write-Warn "$($proc.name) ya no estaba corriendo"
        }
    }

    Remove-Item $ProcessFile -Force -ErrorAction SilentlyContinue
}

if ($KeepDocker) {
    Write-Warn "Docker conservado (-KeepDocker)"
    exit 0
}

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Warn "docker no esta disponible; postgres no se detuvo automaticamente"
    exit 0
}

try {
    Set-Location $Root
    docker inspect sap_etl_postgres *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Step "Deteniendo postgres"
        docker compose stop postgres | Out-Null
        Write-Ok "Postgres detenido"
    } else {
        Write-Warn "El contenedor sap_etl_postgres no existe"
    }
} catch {
    Write-Warn "No se pudo detener postgres automaticamente: $($_.Exception.Message)"
}
