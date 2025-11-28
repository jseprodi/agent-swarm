@echo off
REM Agent Swarm Development Startup Script (Batch)
REM Starts all services in development mode

echo Starting Agent Swarm in development mode...
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed or not in PATH
    exit /b 1
)

echo Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install dependencies
    exit /b 1
)

echo.
echo Building core system...
call npm run build:core
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to build core system
    exit /b 1
)

echo.
echo Starting all services...
echo Press Ctrl+C to stop all services
echo.

call npm run dev

