#!/bin/bash
# Web UI Development Startup (Shell)

set -e

echo "Starting Web UI in development mode..."
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ ! -f "package.json" ]; then
    echo "Error: package.json not found"
    exit 1
fi

echo "Installing dependencies..."
npm install

echo ""
echo "Starting Web UI development server..."
echo "Web UI will be available at http://localhost:5173"
echo "Press Ctrl+C to stop"
echo ""

npm run dev

