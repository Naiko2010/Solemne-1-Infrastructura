# Levanta API + Vite. Requiere Docker Desktop en ejecución.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

try {
    docker version | Out-Null
} catch {
    Write-Host "Docker no responde. Abre Docker Desktop y vuelve a intentar." -ForegroundColor Red
    exit 1
}

Write-Host "Construyendo y arrancando delivery-dev (backend:8000, frontend:5173)..." -ForegroundColor Cyan
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up --build -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker compose -f docker-compose.dev.yml ps
Write-Host "Listo. API: http://localhost:8000/health  |  Frontend: http://localhost:5173" -ForegroundColor Green
