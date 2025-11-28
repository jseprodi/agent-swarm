/**
 * Test fixtures - common test data structures
 */

import type { Task, TaskResult } from '../../src/core/types.js';
import type { MCPServerMetadata } from '../../src/mcp/types.js';
import type { LLMResponse } from '../../src/llm/types.js';

/**
 * Common task fixtures
 */
export const taskFixtures = {
  simpleTask: {
    description: 'Generate a factorial function',
    status: 'pending' as const,
  },
  complexTask: {
    description: 'Create a complete utility library with tests and documentation',
    status: 'pending' as const,
    metadata: {
      libraryName: 'math-utils',
      functions: ['factorial', 'fibonacci'],
    },
  },
  completedTask: {
    description: 'Completed task',
    status: 'completed' as const,
  },
  failedTask: {
    description: 'Failed task',
    status: 'failed' as const,
  },
};

/**
 * Common task result fixtures
 */
export const taskResultFixtures = {
  success: {
    taskId: 'test-task-id',
    success: true,
    data: {
      result: 'Task completed successfully',
    },
  } as TaskResult,
  failure: {
    taskId: 'test-task-id',
    success: false,
    error: 'Task failed with error',
  } as TaskResult,
};

/**
 * Common MCP server fixtures
 */
export const mcpServerFixtures = {
  fileServer: {
    id: 'file-server',
    name: 'File System Server',
    description: 'MCP server for file operations',
    capabilities: {
      tools: ['read_file', 'write_file', 'list_directory'],
      resources: [],
      prompts: [],
    },
  } as Partial<MCPServerMetadata>,
  gitServer: {
    id: 'git-server',
    name: 'Git Server',
    description: 'MCP server for git operations',
    capabilities: {
      tools: ['git_status', 'git_commit', 'git_push'],
      resources: [],
      prompts: [],
    },
  } as Partial<MCPServerMetadata>,
};

/**
 * Common LLM response fixtures
 */
export const llmResponseFixtures = {
  simpleResponse: {
    content: 'This is a simple response',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
  } as LLMResponse,
  codeGenerationResponse: {
    content: 'function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }',
    usage: {
      promptTokens: 50,
      completionTokens: 30,
      totalTokens: 80,
    },
  } as LLMResponse,
  taskDecompositionResponse: {
    content: JSON.stringify({
      subtasks: [
        { description: 'Create factorial function', dependencies: [] },
        { description: 'Write unit tests', dependencies: ['Create factorial function'] },
      ],
    }),
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
  } as LLMResponse,
};

