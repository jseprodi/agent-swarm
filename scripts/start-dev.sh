#!/bin/bash
# Agent Swarm Development Startup Script (Shell)
# Starts all services in development mode

set -e  # Exit on error

# Error handling function
handle_error() {
    echo "Error: $1" >&2
    exit 1
}

# Trap errors
trap 'handle_error "Script failed at line $LINENO"' ERR

echo "Starting Agent Swarm in development mode..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    handle_error "Node.js is not installed or not in PATH"
fi

# Check Node.js version (require 18+)
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    handle_error "Node.js version 18+ is required. Current version: $(node --version)"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    handle_error "NPM is not installed or not in PATH"
fi

echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT" || handle_error "Failed to change to project root directory"

echo "Installing dependencies..."
if ! npm install; then
    handle_error "Failed to install dependencies"
fi

echo ""
echo "Building core system..."
if ! npm run build:core; then
    handle_error "Failed to build core system"
fi

echo ""
echo "Starting all services..."
echo "Press Ctrl+C to stop all services"
echo ""

# Start services (this will run until interrupted)
npm run dev || handle_error "Failed to start development services"

