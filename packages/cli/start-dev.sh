#!/bin/bash
# CLI Development Startup (Shell)

set -e

echo "Building CLI in development mode..."
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
echo "Building CLI in watch mode..."
echo "Changes will be automatically recompiled"
echo "Press Ctrl+C to stop"
echo ""

npm run dev

