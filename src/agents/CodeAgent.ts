/**
 * Code Agent - generates, modifies, and reviews code
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import { LLMIntegration } from '../cursor/LLMIntegration.js';
import logger from '../utils/logger.js';

export class CodeAgent extends BaseAgent {
  constructor(llm?: LLMIntegration) {
    super(
      'code-agent',
      'Code Agent',
      'Generates, modifies, and reviews code using available tools and MCP servers',
      ['code_generation', 'code_modification', 'file_operations'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`CodeAgent executing task: ${task.id} - ${task.description}`);

    try {
      // Use LLM to understand the task and generate code
      const codeGenerationPrompt = this.buildCodeGenerationPrompt(task);
      
      const llmResponse = await this.llm.requestCompletion({
        prompt: codeGenerationPrompt,
        temperature: 0.3,
      });

      // Try to use MCP servers for file operations if available
      const fileOperations = this.findFileOperationMCP();
      
      if (fileOperations) {
        logger.info(`Using MCP server for file operations: ${fileOperations}`);
      }

      // Extract code from LLM response
      const code = this.extractCode(llmResponse.content);
      const explanation = this.extractExplanation(llmResponse.content);

      return this.createSuccessResult(
        task.id,
        {
          code,
          explanation,
          language: this.detectLanguage(code),
          mcpServersUsed: fileOperations ? [fileOperations] : [],
        },
        {
          promptTokens: llmResponse.usage?.promptTokens,
          completionTokens: llmResponse.usage?.completionTokens,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`CodeAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private buildCodeGenerationPrompt(task: Task): string {
    return `You are a code generation agent. Generate code based on the following task:

Task: ${task.description}

${task.metadata?.requirements ? `Requirements: ${JSON.stringify(task.metadata.requirements)}` : ''}

Please provide:
1. The complete code implementation
2. A brief explanation of the approach

Format your response with code blocks and clear explanations.`;
  }

  private extractCode(content: string): string {
    // Extract code from markdown code blocks
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
      return matches.map(m => m[1]).join('\n\n');
    }

    // Fallback: return content as-is if no code blocks found
    return content;
  }

  private extractExplanation(content: string): string {
    // Try to extract explanation text outside code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    const textWithoutCode = content.replace(codeBlockRegex, '').trim();
    return textWithoutCode || 'No explanation provided';
  }

  private detectLanguage(code: string): string {
    // Simple language detection based on common patterns
    if (code.includes('function') && code.includes('=>')) return 'javascript';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('public class') || code.includes('public static')) return 'java';
    if (code.includes('fn ') && code.includes('->')) return 'rust';
    if (code.includes('type ') && code.includes('interface')) return 'typescript';
    return 'unknown';
  }

  private findFileOperationMCP(): string | undefined {
    // Find an MCP client that provides file operations
    for (const [serverId, client] of this.mcpClients.entries()) {
      const capabilities = client.getCapabilities();
      if (
        capabilities.tools?.some(tool =>
          ['read_file', 'write_file', 'list_directory'].includes(tool)
        )
      ) {
        return serverId;
      }
    }
    return undefined;
  }
}

