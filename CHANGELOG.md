# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Authentication middleware for API routes
- Input validation using Zod for all API endpoints
- Rate limiting middleware
- CORS configuration
- Graceful shutdown handling
- Parallel task execution in Orchestrator
- Configurable health check intervals
- Constants for magic numbers (timeouts, intervals)
- Comprehensive API documentation
- Environment variable example files
- Contributing guidelines
- Enhanced error handling

### Changed
- Standardized TypeScript configurations across all packages
- Improved type safety (removed `as any` casts)
- Enhanced authentication middleware with better logging
- Optimized Orchestrator for parallel execution
- Made health check intervals configurable
- Improved error messages and validation

### Fixed
- Type safety issues in server.ts
- Missing authentication on API routes
- Incomplete IntelliJ plugin implementation
- Inconsistent TypeScript compiler options
- Missing error handling in some async operations

### Security
- Added API key authentication
- Added input validation and sanitization
- Added rate limiting
- Configured CORS properly
- Fixed type safety vulnerabilities

## [0.1.0] - 2024-01-01

### Added
- Initial release
- Core Agent Swarm system
- Orchestrator agent
- Domain-specific agents (Code, Test, Documentation, MCP Discovery, etc.)
- MCP server integration
- LLM provider system (Cursor, OpenAI, Anthropic)
- API server with REST and WebSocket endpoints
- Web UI
- CLI tool
- VS Code extension
- Cursor extension
- IntelliJ plugin (basic)

