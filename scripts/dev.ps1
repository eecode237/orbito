# ORBITO dev launcher for Windows (equivalent of scripts/dev.sh).
# Usage:  powershell -File scripts/dev.ps1            (API + web together)
#         powershell -File scripts/dev.ps1 -ApiOnly
#         powershell -File scripts/dev.ps1 -WebOnly
param(
    [switch]$ApiOnly,
    [switch]$WebOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root "apps\api"
$venvPython = Join-Path $api ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "API venv missing. Create it first:" -ForegroundColor Yellow
    Write-Host "  cd apps\api && uv venv .venv --python 3.12 && uv pip install -r requirements.txt"
    exit 1
}

$jobs = @()

if (-not $WebOnly) {
    Write-Host "Starting API on http://localhost:8000 ..." -ForegroundColor Cyan
    $jobs += Start-Process -PassThru -NoNewWindow -WorkingDirectory $api `
        -FilePath $venvPython `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"
}

if (-not $ApiOnly) {
    Write-Host "Starting web on http://localhost:3000 ..." -ForegroundColor Cyan
    $jobs += Start-Process -PassThru -NoNewWindow -WorkingDirectory $root `
        -FilePath "pnpm" -ArgumentList "--filter", "@orbito/web", "dev"
}

Write-Host ""
Write-Host "ORBITO is starting:" -ForegroundColor Green
Write-Host "  Dashboard : http://localhost:3000"
Write-Host "  API docs  : http://localhost:8000/docs"
Write-Host "  Health    : http://localhost:8000/api/v1/health"
Write-Host "Press Ctrl+C to stop."

try {
    Wait-Process -Id ($jobs | ForEach-Object Id)
} finally {
    $jobs | Where-Object { -not $_.HasExited } | Stop-Process -Force
}
