# Agent Swarm Build All Script (PowerShell)
# Builds all packages

Write-Host "Building all Agent Swarm packages..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Building core system..." -ForegroundColor Yellow
npm run build:core

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build core system" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Building all packages..." -ForegroundColor Yellow
npm run build:packages

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build packages" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green

