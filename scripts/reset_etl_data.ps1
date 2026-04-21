#!/usr/bin/env pwsh
# Limpia toda la data ETL (schemas cat, dim, fact, raw, etl)
# Preserva: auth.users, estructura de tablas, vistas public/reporting

param(
    [string]$Container = "sap_etl_postgres",
    [string]$Db = "sap_etl",
    [string]$User = "postgres",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "==> Reset ETL data en contenedor '$Container'" -ForegroundColor Cyan
Write-Host "    Schemas a vaciar: cat, dim, fact, raw, etl" -ForegroundColor Gray
Write-Host "    Preserva: auth.users, vistas public/reporting" -ForegroundColor Gray

if (-not $Force) {
    $confirm = Read-Host "`n¿Continuar? (s/N)"
    if ($confirm -notmatch '^[sS]') {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

$sql = @"
DO `$`$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('cat','dim','fact','raw','etl')
  LOOP
    EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE', r.schemaname, r.tablename);
  END LOOP;
END `$`$;
"@

Write-Host "`n==> Ejecutando TRUNCATE..." -ForegroundColor Cyan
$sql | docker exec -i $Container psql -U $User -d $Db -v ON_ERROR_STOP=1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: fallo al truncar." -ForegroundColor Red
    exit 1
}

Write-Host "`n==> Verificando conteos..." -ForegroundColor Cyan
docker exec -i $Container psql -U $User -d $Db -c @"
SELECT schemaname, SUM(n_live_tup)::bigint AS filas
FROM pg_stat_user_tables
WHERE schemaname IN ('cat','dim','fact','raw','etl','auth')
GROUP BY schemaname
ORDER BY schemaname;
"@

Write-Host "`n[OK] Data ETL limpia. Los usuarios en auth.users siguen intactos." -ForegroundColor Green
Write-Host "     Copiá los CSV a data/input/ y el watcher los procesará." -ForegroundColor Gray
