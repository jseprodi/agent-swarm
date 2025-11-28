#!/bin/bash
# Agent Swarm Build All Script (Shell)
# Builds all packages

set -e

echo "Building all Agent Swarm packages..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Installing dependencies..."
npm install

echo ""
echo "Building core system..."
npm run build:core

echo ""
echo "Building all packages..."
npm run build:packages

echo ""
echo "Build complete!"

