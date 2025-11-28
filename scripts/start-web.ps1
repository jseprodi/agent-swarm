# Start Web UI Only (PowerShell)

Write-Host "Starting Web UI..." -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\..\packages\web-ui"

if (-not (Test-Path "package.json")) {
    Write-Host "Error: Web UI package.json not found" -ForegroundColor Red
    exit 1
}

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Starting Web UI development server..." -ForegroundColor Green
Write-Host "Web UI will be available at http://localhost:5173" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

npm run dev

