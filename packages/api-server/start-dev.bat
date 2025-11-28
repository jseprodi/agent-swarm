@echo off
REM API Server Development Startup (Batch)

echo Starting API Server in development mode...
echo.

cd /d "%~dp0"

if not exist "package.json" (
    echo Error: package.json not found
    exit /b 1
)

echo Installing dependencies...
call npm install

echo.
echo Starting API server with watch mode...
echo API will be available at http://localhost:3000
echo Press Ctrl+C to stop
echo.

call npm run dev:full

