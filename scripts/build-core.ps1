# Build Core System Only (PowerShell)

Write-Host "Building core Agent Swarm system..." -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\.."

Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build:core

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build core system" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Core system build complete!" -ForegroundColor Green

