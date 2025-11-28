/**
 * Mock implementations for testing
 */
/**
 * Mock LLM Provider for testing
 */
export class MockLLMProvider {
    responses = new Map();
    defaultResponse = {
        content: 'Mock response',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
    available = true;
    constructor(available = true) {
        this.available = available;
    }
    async requestCompletion(request) {
        const key = `${request.prompt.substring(0, 50)}_${request.temperature || 0.7}`;
        return this.responses.get(key) || this.defaultResponse;
    }
    setResponse(prompt, response, temperature) {
        const key = `${prompt.substring(0, 50)}_${temperature || 0.7}`;
        this.responses.set(key, response);
    }
    setDefaultResponse(response) {
        this.defaultResponse = response;
    }
    isAvailable() {
        return this.available;
    }
    getName() {
        return 'Mock';
    }
    setAvailable(available) {
        this.available = available;
    }
}
/**
 * Mock MCP Server Client
 */
export class MockMCPServerClient {
    connected = false;
    capabilities = {};
    constructor(connected = false) {
        this.connected = connected;
    }
    isConnected() {
        return this.connected;
    }
    getCapabilities() {
        return this.capabilities;
    }
    setCapabilities(capabilities) {
        this.capabilities = capabilities;
    }
    async connect() {
        this.connected = true;
    }
    async disconnect() {
        this.connected = false;
    }
    async callTool(toolName, args) {
        return { result: `Mock tool result for ${toolName}` };
    }
    setConnected(connected) {
        this.connected = connected;
    }
}
/**
 * Mock Agent for testing
 */
export class MockAgent {
    id;
    name;
    description;
    capabilities;
    executeResult = null;
    executeError = null;
    constructor(id = 'mock-agent', name = 'Mock Agent', description = 'Mock agent for testing', capabilities = ['test']) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.capabilities = capabilities;
    }
    getMetadata() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            capabilities: this.capabilities,
        };
    }
    canHandle(task) {
        // Check capabilities
        if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
            const hasAll = task.requiredCapabilities.every(cap => this.capabilities.includes(cap));
            if (!hasAll)
                return false;
        }
        // For MCP servers, always return true in mock (tests can override behavior)
        return true;
    }
    async execute(task) {
        if (this.executeError) {
            throw this.executeError;
        }
        return (this.executeResult || {
            taskId: task.id,
            success: true,
            data: { message: 'Mock execution result' },
        });
    }
    setExecuteResult(result) {
        this.executeResult = result;
    }
    setExecuteError(error) {
        this.executeError = error;
    }
}
//# sourceMappingURL=mocks.js.map