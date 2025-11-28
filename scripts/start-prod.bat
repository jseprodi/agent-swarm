@echo off
REM Agent Swarm Production Startup Script (Batch)
REM Builds and starts all services in production mode

echo Building Agent Swarm for production...
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
echo Building all packages...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to build packages
    exit /b 1
)

echo.
echo Starting all services in production mode...
echo Press Ctrl+C to stop all services
echo.

call npm run start

