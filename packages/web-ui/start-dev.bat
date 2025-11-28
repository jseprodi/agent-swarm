@echo off
REM Web UI Development Startup (Batch)

echo Starting Web UI in development mode...
echo.

cd /d "%~dp0"

if not exist "package.json" (
    echo Error: package.json not found
    exit /b 1
)

echo Installing dependencies...
call npm install

echo.
echo Starting Web UI development server...
echo Web UI will be available at http://localhost:5173
echo Press Ctrl+C to stop
echo.

call npm run dev

