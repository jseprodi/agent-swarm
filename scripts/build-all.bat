@echo off
REM Agent Swarm Build All Script (Batch)
REM Builds all packages

echo Building all Agent Swarm packages...
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
echo Building all packages...
call npm run build:packages
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to build packages
    exit /b 1
)

echo.
echo Build complete!

