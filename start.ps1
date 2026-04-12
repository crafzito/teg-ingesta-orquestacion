# ============================================================
# start.ps1 - Setup and launch the local TEG stack
# ============================================================
# Usage:
#   .\start.ps1                       # Postgres + ETL watcher + FastAPI backend
#   .\start.ps1 -ETL                 # Same, plus one ETL batch run before watcher
#   .\start.ps1 -WithBackend:$false  # Skip starting FastAPI
#   .\start.ps1 -WithFrontend        # Also start Vite
#   .\start.ps1 -WithFrontend
#   .\start.ps1 -SkipDocker    # Assume dockerized Postgres already exists
#   .\start.ps1 -SkipSchema    # Do not reapply sql/schema.sql
#   .\start.ps1 -BackendOnly   # Only uvicorn in foreground
#   .\start.ps1 -DryRun        # Validate and print what would run
#
# Stop background services with:
#   .\stop.ps1
# ============================================================

param(
    [switch]$SkipDocker,
    [switch]$SkipSchema,
    [switch]$ETL,
    [switch]$BackendOnly,
    [bool]$WithBackend = $true,
    [switch]$WithFrontend,
    [switch]$NoFrontend,
    [switch]$NoWatcher,
    [switch]$DryRun,
    [int]$WatcherDebounce = 180,
    [string]$CsvDir = "data/input"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeDir = Join-Path $Root ".runtime"
$LogDir = Join-Path $RuntimeDir "logs"
$ProcessFile = Join-Path $RuntimeDir "dev-processes.json"

function Write-Step { param([string]$Message) Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok { param([string]$Message) Write-Host "    [OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "    [!]  $Message" -ForegroundColor Yellow }
function Write-Fail { param([string]$Message) Write-Host "    [X]  $Message" -ForegroundColor Red }

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

function Ensure-Directory {
    param([string]$Path)
    if ($DryRun) {
        return
    }
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Resolve-RepoPath {
    param([string]$PathValue)
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $Root $PathValue))
}

function Resolve-CommandPath {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name no esta disponible. $InstallHint"
    }

    if ($command.Source -like "*.ps1") {
        $cmdShim = Get-Command "$Name.cmd" -ErrorAction SilentlyContinue
        if ($cmdShim) {
            return $cmdShim.Source
        }

        $exeShim = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
        if ($exeShim) {
            return $exeShim.Source
        }
    }

    return $command.Source
}

function Get-EnvOrDefault {
    param(
        [string]$Name,
        [string]$Default
    )

    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }

    return $value
}

function Invoke-NativeOrThrow {
    param(
        [scriptblock]$Command,
        [string]$FailureMessage,
        [switch]$Quiet
    )

    $previousPreference = $ErrorActionPreference
    $previousNativeCommandPreference = $PSNativeCommandUseErrorActionPreference
    $ErrorActionPreference = "Continue"
    $PSNativeCommandUseErrorActionPreference = $false
    try {
        $output = & $Command 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
        $PSNativeCommandUseErrorActionPreference = $previousNativeCommandPreference
    }

    if ($exitCode -ne 0) {
        $details = if ($output) {
            (($output | Out-String).Trim())
        } else {
            "Sin salida adicional."
        }
        throw "$FailureMessage`n$details"
    }

    if (-not $Quiet -and $output) {
        $output | ForEach-Object { Write-Host $_ }
    }

    return $output
}

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

function Save-TrackedProcesses {
    param([object[]]$Processes)

    if ($DryRun) {
        return
    }

    Ensure-Directory -Path $RuntimeDir
    if (@($Processes).Count -eq 0) {
        Set-Content -Path $ProcessFile -Value "[]"
        return
    }

    @($Processes) | ConvertTo-Json -Depth 5 | Set-Content -Path $ProcessFile
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

function Get-LiveTrackedProcesses {
    $tracked = @(Read-TrackedProcesses)
    $live = @()

    foreach ($proc in $tracked) {
        if ($proc.pid -and (Test-ProcessAlive -ProcessId ([int]$proc.pid))) {
            $live += $proc
        }
    }

    if (@($tracked).Count -ne @($live).Count) {
        Save-TrackedProcesses -Processes $live
    }

    return $live
}

function Get-TrackedProcess {
    param([string]$Name)

    return @(Get-LiveTrackedProcesses | Where-Object { $_.name -eq $Name } | Select-Object -First 1)
}

function Format-CommandLine {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $parts = @($FilePath) + @($Arguments)
    return ($parts | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\"') + '"'
        } else {
            $_
        }
    }) -join " "
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    if ($DryRun -or ($ProcessId -le 0)) {
        return
    }

    taskkill /PID $ProcessId /T /F | Out-Null
}

function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$DisplayName,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $existing = Get-TrackedProcess -Name $Name
    if ($existing) {
        Write-Warn "$DisplayName ya estaba corriendo (PID $($existing.pid))"
        return [pscustomobject]@{
            name = $existing.name
            pid = [int]$existing.pid
            stdout_log = $existing.stdout_log
            stderr_log = $existing.stderr_log
            command = $existing.command
            started_at = $existing.started_at
            already_running = $true
        }
    }

    $stdoutLog = Join-Path $LogDir "$Name.stdout.log"
    $stderrLog = Join-Path $LogDir "$Name.stderr.log"
    $commandLine = Format-CommandLine -FilePath $FilePath -Arguments $Arguments

    Write-Step "Levantando $DisplayName"
    Write-Host "    $commandLine" -ForegroundColor DarkGray

    if ($DryRun) {
        return [pscustomobject]@{
            name = $Name
            pid = 0
            stdout_log = $stdoutLog
            stderr_log = $stderrLog
            command = $commandLine
            started_at = (Get-Date).ToString("s")
            already_running = $false
        }
    }

    Ensure-Directory -Path $RuntimeDir
    Ensure-Directory -Path $LogDir

    if (Test-Path $stdoutLog) {
        Remove-Item $stdoutLog -Force
    }
    if (Test-Path $stderrLog) {
        Remove-Item $stderrLog -Force
    }

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    Start-Sleep -Seconds 5
    $process.Refresh()
    if ($process.HasExited) {
        $lines = @()
        if (Test-Path $stderrLog) {
            $lines += Get-Content $stderrLog -Tail 20
        }
        if (@($lines).Count -eq 0 -and (Test-Path $stdoutLog)) {
            $lines += Get-Content $stdoutLog -Tail 20
        }

        $details = if (@($lines).Count -gt 0) {
            $lines -join "`n"
        } else {
            "Sin salida adicional."
        }

        throw "$DisplayName no pudo iniciar.`n$details"
    }

    $savedRecord = [pscustomobject]@{
        name = $Name
        pid = [int]$process.Id
        stdout_log = $stdoutLog
        stderr_log = $stderrLog
        command = $commandLine
        started_at = (Get-Date).ToString("s")
    }

    $tracked = @(Get-LiveTrackedProcesses | Where-Object { $_.name -ne $Name })
    $tracked += $savedRecord
    Save-TrackedProcesses -Processes $tracked

    Write-Ok "$DisplayName corriendo (PID $($process.Id))"

    return [pscustomobject]@{
        name = $savedRecord.name
        pid = $savedRecord.pid
        stdout_log = $savedRecord.stdout_log
        stderr_log = $savedRecord.stderr_log
        command = $savedRecord.command
        started_at = $savedRecord.started_at
        already_running = $false
    }
}

function Wait-ForHttpReady {
    param(
        [string]$DisplayName,
        [string]$Url,
        [int]$TimeoutSec = 30
    )

    if ($DryRun) {
        return
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $statusCode = (curl.exe -s -o NUL -w "%{http_code}" --connect-timeout 3 $Url) 2>$null
            if ($statusCode -eq "200") {
                Write-Ok "$DisplayName listo"
                return
            }
        } catch {
        }

        Start-Sleep -Seconds 1
    }

    throw "$DisplayName no respondio a tiempo: $Url"
}

function Assert-DockerReady {
    if ($DryRun) {
        return
    }

    $dockerInfo = $null
    try {
        $dockerInfo = docker info 2>&1
    } catch {
    }

    if (-not $dockerInfo -or ($dockerInfo -match "error")) {
        throw "Docker no esta corriendo. Inicia Docker Desktop e intenta de nuevo."
    }
}

function Assert-PostgresContainer {
    if ($DryRun) {
        return
    }

    docker inspect sap_etl_postgres *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "No se encontro el contenedor 'sap_etl_postgres'. Ejecuta '.\start.ps1' sin -SkipDocker."
    }
}

function Wait-ForPostgresReady {
    param([string]$DbUser)

    if ($DryRun) {
        return
    }

    Write-Host "    Esperando que PostgreSQL este listo..." -NoNewline
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $result = docker exec sap_etl_postgres pg_isready -U $DbUser 2>&1
        if ($result -match "accepting connections") {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    Write-Host ""

    if (-not $ready) {
        throw "PostgreSQL no respondio en 30 segundos."
    }
}

Load-Env

if (-not $PSBoundParameters.ContainsKey("CsvDir") -and $env:SAP_CSV_DIR) {
    $CsvDir = $env:SAP_CSV_DIR
}

$DB_HOST = Get-EnvOrDefault -Name "DB_HOST" -Default "localhost"
$DB_PORT = Get-EnvOrDefault -Name "DB_PORT" -Default "5432"
$DB_NAME = Get-EnvOrDefault -Name "DB_NAME" -Default "sap_etl"
$DB_USER = Get-EnvOrDefault -Name "DB_USER" -Default "postgres"
$DB_PASS = Get-EnvOrDefault -Name "DB_PASSWORD" -Default "postgres"
$PG_DSN = Get-EnvOrDefault -Name "PG_DSN" -Default "host=$DB_HOST dbname=$DB_NAME user=$DB_USER password=$DB_PASS"
$CsvPath = Resolve-RepoPath -PathValue $CsvDir

$env:PG_DSN = $PG_DSN
$env:SAP_CSV_DIR = $CsvPath
$env:PYTHONPATH = $Root

Write-Host ""
Write-Host "============================================================" -ForegroundColor White
Write-Host "  TEG local stack" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor White
Write-Host "  DB:      $DB_NAME @ $DB_HOST`:$DB_PORT (user: $DB_USER)"
Write-Host "  CSV dir: $CsvPath"
Write-Host "  DryRun:  $DryRun"
Write-Host "============================================================" -ForegroundColor White

if ($BackendOnly) {
    $pythonInVenv = Join-Path $Root ".venv\Scripts\python.exe"
    $pythonExe = if (Test-Path $pythonInVenv) {
        $pythonInVenv
    } else {
        Resolve-CommandPath -Name "python" -InstallHint "Instala Python 3.11+."
    }

    Write-Step "Levantando backend en foreground"
    Set-Location $Root
    & $pythonExe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
    exit $LASTEXITCODE
}

$StartBackend = $WithBackend
$StartFrontend = $WithFrontend
if ($NoFrontend) {
    $StartFrontend = $false
}

$pythonCmd = Resolve-CommandPath -Name "python" -InstallHint "Instala Python 3.11+."
$npmCmd = $null
$nodeCmd = $null
if ($StartFrontend) {
    $npmCmd = Resolve-CommandPath -Name "npm" -InstallHint "Instala Node.js 18+ para usar el frontend."
    $nodeCmd = Resolve-CommandPath -Name "node" -InstallHint "Instala Node.js 18+ para usar el frontend."
}

if (-not $DryRun) {
    Ensure-Directory -Path $RuntimeDir
    Ensure-Directory -Path $LogDir
    Ensure-Directory -Path $CsvPath
} elseif (-not (Test-Path $CsvPath)) {
    Write-Warn "Se crearia el directorio de CSVs: $CsvPath"
}

if (-not $SkipDocker) {
    Write-Step "Iniciando PostgreSQL con Docker Compose"
    Assert-DockerReady
    if ($DryRun) {
        Write-Ok "Se ejecutaria: docker compose up -d postgres"
    } else {
        Set-Location $Root
        Invoke-NativeOrThrow -Command { docker compose up -d postgres } -FailureMessage "No se pudo iniciar postgres con docker compose"
        Write-Ok "Contenedor postgres iniciado"
    }
} else {
    Write-Warn "Saltando docker compose (-SkipDocker)"
}

Assert-PostgresContainer
Wait-ForPostgresReady -DbUser $DB_USER
Write-Ok "PostgreSQL listo"

Write-Step "Verificando base de datos '$DB_NAME'"
if (-not $DryRun) {
    $dbList = Invoke-NativeOrThrow -Command { docker exec sap_etl_postgres psql -U $DB_USER -lqt } -FailureMessage "No se pudo listar las bases de datos" -Quiet
    $dbExists = $dbList | Select-String -SimpleMatch $DB_NAME
    if (-not $dbExists) {
        Invoke-NativeOrThrow -Command { docker exec sap_etl_postgres psql -U $DB_USER -c "CREATE DATABASE $DB_NAME" postgres } -FailureMessage "No se pudo crear la base de datos '$DB_NAME'" -Quiet
        Write-Ok "Base de datos '$DB_NAME' creada"
    } else {
        Write-Ok "Base de datos '$DB_NAME' ya existe"
    }
} else {
    Write-Ok "Validacion de base de datos omitida por -DryRun"
}

if (-not $SkipSchema) {
    Write-Step "Aplicando schema (sql/schema.sql)"
    $schemaFile = Join-Path $Root "sql\schema.sql"
    if (-not (Test-Path $schemaFile)) {
        throw "No se encontro sql/schema.sql"
    }

    if (-not $DryRun) {
        Invoke-NativeOrThrow -Command { docker cp $schemaFile sap_etl_postgres:/tmp/schema.sql } -FailureMessage "No se pudo copiar schema.sql al contenedor" -Quiet
        Invoke-NativeOrThrow -Command { docker exec sap_etl_postgres psql -v ON_ERROR_STOP=1 -U $DB_USER -d $DB_NAME -f /tmp/schema.sql } -FailureMessage "No se pudo aplicar sql/schema.sql" -Quiet
        Write-Ok "Schema aplicado"
    } else {
        Write-Ok "Schema validado (dry run)"
    }
} else {
    Write-Warn "Schema omitido (-SkipSchema)"
}

Write-Step "Preparando entorno Python"
$venv = Join-Path $Root ".venv"
$python = Join-Path $venv "Scripts\python.exe"
if (-not (Test-Path $venv)) {
    if ($DryRun) {
        Write-Ok "Se crearia el virtualenv en .venv/"
    } else {
        Invoke-NativeOrThrow -Command { & $pythonCmd -m venv $venv } -FailureMessage "No se pudo crear el virtualenv en .venv" -Quiet
        Write-Ok "Virtualenv creado en .venv/"
    }
}

if (-not (Test-Path $python)) {
    if ($DryRun) {
        $python = $pythonCmd
    } else {
        throw "Python no encontrado en .venv despues de crear el virtualenv."
    }
}

if ($DryRun) {
    Write-Ok "Se ejecutaria: $python -m pip install -r requirements.txt"
} else {
    $requirementsFile = Join-Path $Root "requirements.txt"
    Invoke-NativeOrThrow -Command { & $python -m pip install -r $requirementsFile --quiet } -FailureMessage "No se pudieron instalar las dependencias Python" -Quiet
    Write-Ok "Dependencias Python instaladas"
}

if ($StartFrontend) {
    Write-Step "Preparando frontend"
    $frontendDir = Join-Path $Root "frontedTEG"
    $nodeModules = Join-Path $frontendDir "node_modules"
    $lockFile = Join-Path $frontendDir "package-lock.json"

    if ($DryRun) {
        Write-Ok "Se validaria npm en $frontendDir"
    } elseif (-not (Test-Path $nodeModules)) {
        if (Test-Path $lockFile) {
            Invoke-NativeOrThrow -Command { & $npmCmd ci --prefix $frontendDir } -FailureMessage "No se pudieron instalar las dependencias del frontend con npm ci" -Quiet
        } else {
            Invoke-NativeOrThrow -Command { & $npmCmd install --prefix $frontendDir } -FailureMessage "No se pudieron instalar las dependencias del frontend con npm install" -Quiet
        }
        Write-Ok "Dependencias frontend instaladas"
    } else {
        Write-Ok "Dependencias frontend ya instaladas"
    }
}

if ($ETL) {
    Write-Step "Ejecutando ETL inicial"
    $pipelineScript = Join-Path $Root "etl\pipeline.py"
    if ($DryRun) {
        Write-Ok "Se ejecutaria: $python $pipelineScript --dir $CsvPath"
    } else {
        Invoke-NativeOrThrow -Command { & $python $pipelineScript --dir $CsvPath } -FailureMessage "El ETL inicial termino con errores."
        Write-Ok "ETL inicial completado"
    }
}

$startedThisRun = @()
try {
    $backend = $null
    if ($StartBackend) {
        $backend = Start-ManagedProcess `
            -Name "backend" `
            -DisplayName "backend FastAPI" `
            -FilePath $python `
            -Arguments @("-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000") `
            -WorkingDirectory $Root
        if (-not $backend.already_running) {
            $startedThisRun += $backend
        }
        Wait-ForHttpReady -DisplayName "Backend API" -Url "http://localhost:8000/api/health" -TimeoutSec 30
    }

    $watcher = $null
    if (-not $NoWatcher) {
        $watcher = Start-ManagedProcess `
            -Name "etl-watcher" `
            -DisplayName "watcher ETL" `
            -FilePath $python `
            -Arguments @((Join-Path $Root "etl\watcher.py"), "--dir", $CsvPath, "--debounce", "$WatcherDebounce") `
            -WorkingDirectory $Root
        if (-not $watcher.already_running) {
            $startedThisRun += $watcher
        }
    }

    $frontend = $null
    if ($StartFrontend) {
        $viteScript = Join-Path $Root "frontedTEG\node_modules\vite\bin\vite.js"
        if (-not (Test-Path $viteScript)) {
            throw "No se encontro Vite en frontedTEG/node_modules. Reinstala dependencias del frontend."
        }

        $frontend = Start-ManagedProcess `
            -Name "frontend" `
            -DisplayName "frontend Vite" `
            -FilePath $nodeCmd `
            -Arguments @($viteScript, "--host", "0.0.0.0") `
            -WorkingDirectory (Join-Path $Root "frontedTEG")
        if (-not $frontend.already_running) {
            $startedThisRun += $frontend
        }
        Wait-ForHttpReady -DisplayName "Frontend" -Url "http://localhost:5176" -TimeoutSec 45
    }
} catch {
    if (@($startedThisRun).Count -gt 0) {
        Write-Warn "Fallo el arranque. Deteniendo procesos iniciados en esta corrida..."
        foreach ($proc in $startedThisRun) {
            Stop-ProcessTree -ProcessId $proc.pid
        }

        $stillTracked = @(Get-LiveTrackedProcesses | Where-Object { $startedThisRun.pid -notcontains $_.pid })
        Save-TrackedProcesses -Processes $stillTracked
    }

    throw
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor White
Write-Host "  Stack listo" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor White
if ($StartBackend) {
    Write-Host "  API:      http://localhost:8000" -ForegroundColor White
    Write-Host "  Docs:     http://localhost:8000/docs" -ForegroundColor White
    Write-Host "  Health:   http://localhost:8000/api/health" -ForegroundColor White
}
if ($StartFrontend) {
    Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
}
if (-not $NoWatcher) {
    Write-Host "  ETL:      watcher activo sobre $CsvPath" -ForegroundColor White
}
if (-not $StartBackend -and -not $StartFrontend) {
    Write-Host "  UI/API:   no se iniciaron automaticamente" -ForegroundColor White
}
Write-Host ""
Write-Host "  Logs:" -ForegroundColor Yellow
Write-Host "    $LogDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Para detener todo:" -ForegroundColor Yellow
Write-Host "    .\stop.ps1" -ForegroundColor Yellow
Write-Host ""
