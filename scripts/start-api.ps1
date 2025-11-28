# Start API Server Only (PowerShell)

Write-Host "Starting API Server..." -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\..\packages\api-server"

if (-not (Test-Path "package.json")) {
    Write-Host "Error: API server package.json not found" -ForegroundColor Red
    exit 1
}

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Building API server..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build API server" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting API server on port 3000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

npm run start

