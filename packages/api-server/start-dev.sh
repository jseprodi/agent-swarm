#!/bin/bash
# API Server Development Startup (Shell)

set -e

echo "Starting API Server in development mode..."
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
echo "Starting API server with watch mode..."
echo "API will be available at http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""

npm run dev:full

