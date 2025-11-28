# Startup Scripts

This directory contains startup and build scripts for the Agent Swarm system.

## Available Scripts

### Root Level (Run from project root)

#### NPM Scripts

```bash
# Development
npm run dev              # Start all services in development mode
npm run dev:core         # Build core system in watch mode
npm run dev:api          # Start API server in development
npm run dev:web          # Start Web UI in development

# Building
npm run build            # Build all packages
npm run build:core       # Build core system only
npm run build:api        # Build API server only
npm run build:web        # Build Web UI only
npm run build:cli        # Build CLI only
npm run build:extensions # Build all IDE extensions

# Production
npm run start            # Start all services in production mode
npm run start:api        # Start API server only
npm run start:web        # Start Web UI only (preview)

# Cleanup
npm run clean            # Clean all build artifacts
npm run clean:core       # Clean core system build
npm run clean:packages   # Clean all package builds
```

### PowerShell Scripts (Windows)

```powershell
# Development
.\scripts\start-dev.ps1      # Start all in development mode

# Production
.\scripts\start-prod.ps1     # Build and start all in production

# Building
.\scripts\build-all.ps1      # Build all packages

# Individual services
.\scripts\start-api.ps1      # Start API server only
.\scripts\start-web.ps1      # Start Web UI only
.\scripts\build-core.ps1     # Build core system only
```

### Batch Scripts (Windows)

```cmd
# Development
scripts\start-dev.bat        # Start all in development mode

# Production
scripts\start-prod.bat       # Build and start all in production

# Building
scripts\build-all.bat        # Build all packages
```

### Shell Scripts (Linux/Mac)

```bash
# Make scripts executable first
chmod +x scripts/*.sh

# Development
./scripts/start-dev.sh       # Start all in development mode

# Production
./scripts/start-prod.sh      # Build and start all in production

# Building
./scripts/build-all.sh       # Build all packages
```

### Individual Package Scripts

Each package has its own startup scripts:

#### API Server
```powershell
# PowerShell
cd packages/api-server
.\start-dev.ps1

# Batch
cd packages\api-server
start-dev.bat

# Shell
cd packages/api-server
./start-dev.sh
```

#### Web UI
```powershell
# PowerShell
cd packages/web-ui
.\start-dev.ps1

# Batch
cd packages\web-ui
start-dev.bat

# Shell
cd packages/web-ui
./start-dev.sh
```

#### CLI
```powershell
# PowerShell
cd packages/cli
.\start-dev.ps1

# Batch
cd packages\cli
start-dev.bat

# Shell
cd packages/cli
./start-dev.sh
```

## Quick Start

### Development Mode

**Windows (PowerShell):**
```powershell
.\scripts\start-dev.ps1
```

**Windows (Command Prompt):**
```cmd
scripts\start-dev.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/*.sh
./scripts/start-dev.sh
```

**NPM:**
```bash
npm run dev
```

### Production Mode

**Windows (PowerShell):**
```powershell
.\scripts\start-prod.ps1
```

**Windows (Command Prompt):**
```cmd
scripts\start-prod.bat
```

**Linux/Mac:**
```bash
./scripts/start-prod.sh
```

**NPM:**
```bash
npm run build
npm run start
```

## Prerequisites

- Node.js 18+ installed
- NPM installed
- All dependencies installed (`npm install`)

## Environment Variables

Create `.env` files in package directories or set environment variables:

### API Server
- `PORT` - API server port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)
- `LLM_PROVIDER` - LLM provider type (cursor, openai, anthropic)
- `OPENAI_API_KEY` - OpenAI API key (if using OpenAI)
- `ANTHROPIC_API_KEY` - Anthropic API key (if using Anthropic)
- `API_KEY` - API authentication key (optional)

### Web UI
- `VITE_API_URL` - API server URL (default: http://localhost:3000)
- `VITE_WS_URL` - WebSocket URL (default: ws://localhost:3000)

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, set the `PORT` environment variable:
```bash
$env:PORT=3001  # PowerShell
set PORT=3001   # CMD
export PORT=3001 # Bash
```

### Build Errors
Run clean before building:
```bash
npm run clean
npm run build
```

### Permission Denied (Linux/Mac)
Make scripts executable:
```bash
chmod +x scripts/*.sh
chmod +x packages/*/start-dev.sh
```

