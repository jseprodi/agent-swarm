# Troubleshooting Guide

This guide covers common issues and solutions for the Agent Swarm system.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [LLM Provider Issues](#llm-provider-issues)
- [MCP Server Issues](#mcp-server-issues)
- [API Server Issues](#api-server-issues)
- [Performance Issues](#performance-issues)
- [Testing Issues](#testing-issues)

## Installation Issues

### Node.js Version

**Problem:** Errors during installation or runtime.

**Solution:** Ensure you're using Node.js 18 or higher:
```bash
node --version
```

If you need to upgrade, use [nvm](https://github.com/nvm-sh/nvm) or download from [nodejs.org](https://nodejs.org/).

### Dependency Installation Failures

**Problem:** `npm install` fails with errors.

**Solutions:**
1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Delete `node_modules` and `package-lock.json`, then reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. For workspace issues, try installing from root:
   ```bash
   npm install --workspaces
   ```

### TypeScript Compilation Errors

**Problem:** TypeScript errors during build.

**Solutions:**
1. Ensure TypeScript version matches requirements:
   ```bash
   npm list typescript
   ```

2. Clean and rebuild:
   ```bash
   npm run clean
   npm run build
   ```

## Runtime Errors

### "LLM Provider Not Available"

**Problem:** Error message indicating LLM provider is not available.

**Solutions:**
1. **For Cursor provider:** Ensure you're running in Cursor IDE context, or set environment variables:
   ```bash
   export CURSOR=true
   export CURSOR_CONTEXT=true
   ```

2. **For OpenAI provider:** Set API key:
   ```bash
   export OPENAI_API_KEY=your-api-key
   ```

3. **For Anthropic provider:** Set API key:
   ```bash
   export ANTHROPIC_API_KEY=your-api-key
   ```

4. Check provider availability in code:
   ```typescript
   const swarm = new Swarm({ llmProvider: 'openai' });
   console.log(swarm.getLLMProvider().isAvailable());
   ```

### "Task Execution Timeout"

**Problem:** Tasks timeout before completion.

**Solutions:**
1. Increase timeout in Orchestrator configuration
2. Break down complex tasks into smaller subtasks
3. Check for infinite loops or blocking operations
4. Review task complexity and agent selection

### "Agent Not Found"

**Problem:** Error when trying to use an agent.

**Solutions:**
1. Verify agent is registered:
   ```typescript
   const registry = swarm.getAgentRegistry();
   console.log(registry.getAllAgents().map(a => a.id));
   ```

2. Check agent capabilities match task requirements
3. Ensure agent is available (not busy or disabled)

## LLM Provider Issues

### API Key Errors

**Problem:** Authentication failures with LLM providers.

**Solutions:**
1. Verify API key is set correctly:
   ```bash
   echo $OPENAI_API_KEY  # or $ANTHROPIC_API_KEY
   ```

2. Check API key format (no extra spaces or quotes)
3. Ensure API key has sufficient credits/quota
4. For OpenAI, verify organization ID if using organization accounts

### Rate Limiting

**Problem:** Rate limit errors from LLM providers.

**Solutions:**
1. Implement request throttling
2. Use exponential backoff for retries
3. Consider upgrading API tier for higher limits
4. Reduce concurrent requests

### Model Not Found

**Problem:** Error about model not being available.

**Solutions:**
1. Verify model name is correct (case-sensitive)
2. Check if model is available in your region
3. For OpenAI, ensure model is accessible with your API key tier
4. Use default models if custom model fails

## MCP Server Issues

### Connection Failures

**Problem:** Cannot connect to MCP servers.

**Solutions:**
1. Verify server configuration:
   ```typescript
   const manager = swarm.getMCPManager();
   const servers = manager.getRegistry().getAllServers();
   console.log(servers);
   ```

2. Check server command and arguments are correct
3. Ensure server executable is in PATH
4. Review server logs for specific errors

### Server Crashes

**Problem:** MCP servers crash or disconnect frequently.

**Solutions:**
1. Enable health checks:
   ```typescript
   const swarm = new Swarm({ enableHealthChecks: true });
   ```

2. Check server error count:
   ```typescript
   const metadata = manager.getServerMetadata('server-id');
   console.log(metadata?.errorCount);
   ```

3. Review server implementation for stability issues
4. Implement retry logic with exponential backoff

### Capability Mismatches

**Problem:** Agent cannot find required MCP server capabilities.

**Solutions:**
1. Verify server capabilities are correctly registered
2. Use MCPDiscoveryAgent to find suitable servers
3. Check capability names match exactly (case-sensitive)
4. Review task requirements vs available capabilities

## API Server Issues

### Port Already in Use

**Problem:** API server cannot start because port is occupied.

**Solutions:**
1. Change port via environment variable:
   ```bash
   export PORT=3001
   ```

2. Find and kill process using the port:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # Linux/Mac
   lsof -ti:3000 | xargs kill
   ```

### Authentication Failures

**Problem:** API requests are rejected with 401 Unauthorized.

**Solutions:**
1. Verify API key is set:
   ```bash
   echo $API_KEY
   ```

2. Check request includes correct header:
   ```bash
   curl -H "X-API-Key: your-key" http://localhost:3000/api/tasks
   ```

3. If `API_KEY` is not set, authentication is disabled (development mode)

### CORS Errors

**Problem:** Browser shows CORS errors when accessing API.

**Solutions:**
1. Configure CORS_ORIGIN environment variable:
   ```bash
   export CORS_ORIGIN=http://localhost:5173,https://example.com
   ```

2. For development, use `*` (not recommended for production):
   ```bash
   export CORS_ORIGIN=*
   ```

3. Ensure Web UI URL matches CORS configuration

## Performance Issues

### Slow Task Execution

**Problem:** Tasks take too long to complete.

**Solutions:**
1. Enable parallel task execution (default in Orchestrator)
2. Optimize LLM prompts to reduce token usage
3. Cache frequently used results
4. Review agent selection logic for efficiency
5. Consider using faster LLM models for simple tasks

### High Memory Usage

**Problem:** System uses excessive memory.

**Solutions:**
1. Limit concurrent tasks:
   ```typescript
   const orchestrator = new Orchestrator(..., 5); // max 5 concurrent
   ```

2. Clear task history periodically
3. Limit dynamic agent creation:
   ```typescript
   const swarm = new Swarm({
     dynamicAgents: { maxDynamicAgents: 5 }
   });
   ```

4. Review MCP server connections and disconnect unused ones

### LLM Token Usage

**Problem:** High token usage leading to costs.

**Solutions:**
1. Optimize prompts to be more concise
2. Use context compression for large inputs
3. Cache LLM responses when appropriate
4. Monitor usage:
   ```typescript
   const result = await swarm.execute(task);
   console.log(result.metadata?.promptTokens);
   console.log(result.metadata?.completionTokens);
   ```

## Testing Issues

### Tests Fail Intermittently

**Problem:** Tests pass sometimes but fail other times.

**Solutions:**
1. Check for race conditions in async code
2. Ensure proper test isolation (cleanup between tests)
3. Use deterministic mocks instead of random data
4. Increase test timeouts if needed:
   ```typescript
   it('slow test', async () => {
     // test code
   }, 10000); // 10 second timeout
   ```

### Coverage Threshold Failures

**Problem:** Test coverage below thresholds.

**Solutions:**
1. Review coverage report:
   ```bash
   npm run test:coverage
   ```

2. Add tests for uncovered code paths
3. Adjust thresholds in `vitest.config.ts` if appropriate
4. Exclude test files and configuration from coverage

### Mock Issues

**Problem:** Mocks not working as expected.

**Solutions:**
1. Verify mock setup in `beforeEach` hooks
2. Reset mocks between tests:
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```

3. Check mock implementation matches real interface
4. Use `vi.spyOn` for partial mocks when needed

## Getting Help

If you encounter issues not covered here:

1. Check the [README.md](README.md) for usage examples
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
3. Check [CHANGELOG.md](CHANGELOG.md) for recent changes
4. Open an issue on GitHub with:
   - Error messages and stack traces
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)
   - Relevant configuration

## Common Error Messages

### "Orchestrator is busy processing another task"

**Cause:** Orchestrator can only process one root task at a time.

**Solution:** Wait for current task to complete, or use multiple Swarm instances.

### "No suitable agent found"

**Cause:** No agent has the required capabilities for the task.

**Solution:** 
- Enable dynamic agent creation
- Create a custom agent with required capabilities
- Adjust task requirements

### "MCP server connection failed"

**Cause:** Server executable not found or configuration incorrect.

**Solution:** Verify server configuration and ensure executable is accessible.

### "Rate limit exceeded"

**Cause:** Too many API requests in short time.

**Solution:** Implement request throttling or increase rate limit configuration.

