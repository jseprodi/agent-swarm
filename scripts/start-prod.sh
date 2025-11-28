#!/bin/bash
# Agent Swarm Production Startup Script (Shell)
# Builds and starts all services in production mode

set -e

echo "Building Agent Swarm for production..."
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
echo "Building all packages..."
npm run build

echo ""
echo "Starting all services in production mode..."
echo "Press Ctrl+C to stop all services"
echo ""

npm run start

