@echo off
REM CLI Development Startup (Batch)

echo Building CLI in development mode...
echo.

cd /d "%~dp0"

if not exist "package.json" (
    echo Error: package.json not found
    exit /b 1
)

echo Installing dependencies...
call npm install

echo.
echo Building CLI in watch mode...
echo Changes will be automatically recompiled
echo Press Ctrl+C to stop
echo.

call npm run dev

