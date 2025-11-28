#!/bin/bash
# Agent Swarm Development Startup Script (Shell)
# Starts all services in development mode

set -e

echo "Starting Agent Swarm in development mode..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo ""

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
echo "Starting all services..."
echo "Press Ctrl+C to stop all services"
echo ""

npm run dev

