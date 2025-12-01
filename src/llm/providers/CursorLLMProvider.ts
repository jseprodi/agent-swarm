/**
 * Cursor LLM Provider - uses Cursor's runtime LLM capabilities
 */

import { BaseLLMProvider } from '../BaseLLMProvider.js';
import type { LLMRequest, LLMResponse } from '../types.js';
import logger from '../../utils/logger.js';

export class CursorLLMProvider extends BaseLLMProvider {
  private isCursorContext: boolean = false;

  constructor() {
    super();
    this.isCursorContext = this.detectCursorContext();
  }

  /**
   * Detect if we're running in Cursor's context
   */
  private detectCursorContext(): boolean {
    // Check for Cursor-specific environment variables or globals
    return (
      typeof process !== 'undefined' &&
      (process.env.CURSOR === 'true' || 
       process.env.CURSOR_CONTEXT === 'true' ||
       typeof (globalThis as any).cursor !== 'undefined')
    );
  }

  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.isCursorContext) {
      logger.warn('Not running in Cursor context - LLM requests will be placeholders');
      // Return a placeholder response with valid JSON structure for common prompts
      const promptLower = request.prompt.toLowerCase();
      let placeholderContent = '[]'; // Default to empty array for JSON responses
      
      // Try to provide better placeholder responses based on prompt type
      if (promptLower.includes('json array') || promptLower.includes('respond with a json array')) {
        placeholderContent = '[]';
      } else if (promptLower.includes('json object') || promptLower.includes('respond with a json')) {
        placeholderContent = '{}';
      } else if (promptLower.includes('subtasks') || promptLower.includes('break it down')) {
        // For task decomposition, return a simple single-subtask structure
        placeholderContent = JSON.stringify({
          subtasks: [{ description: request.prompt.split('\n')[0] || 'Complete the task', agent: 'code-agent', dependencies: [] }],
          reasoning: 'Placeholder decomposition - would use LLM in actual Cursor context'
        });
      } else {
        placeholderContent = '[]';
      }
      
      return {
        content: placeholderContent,
        model: 'cursor-default',
      };
    }

    try {
      // In actual Cursor context, this would call Cursor's LLM API
      // For now, this is a placeholder that would be implemented based on
      // how Cursor exposes its LLM capabilities
      
      // Example: if Cursor exposes a global function or API
      // const response = await cursor.llm.complete(request);
      
      logger.info(`LLM request: ${request.prompt.substring(0, 100)}...`);
      
      // Placeholder implementation - return valid JSON for structured responses
      const promptLower = request.prompt.toLowerCase();
      let placeholderContent = '[]';
      
      if (promptLower.includes('json array') || promptLower.includes('respond with a json array')) {
        placeholderContent = '[]';
      } else if (promptLower.includes('json object') || promptLower.includes('respond with a json')) {
        placeholderContent = '{}';
      } else if (promptLower.includes('subtasks') || promptLower.includes('break it down')) {
        placeholderContent = JSON.stringify({
          subtasks: [{ description: request.prompt.split('\n')[0] || 'Complete the task', agent: 'code-agent', dependencies: [] }],
          reasoning: 'Placeholder decomposition - would use LLM in actual Cursor context'
        });
      } else {
        placeholderContent = '[]';
      }
      
      return {
        content: placeholderContent,
        usage: {
          promptTokens: request.prompt.length / 4, // Rough estimate
          completionTokens: 100,
          totalTokens: request.prompt.length / 4 + 100,
        },
        model: 'cursor-default',
      };
    } catch (error) {
      logger.error('Error requesting LLM completion:', error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.isCursorContext;
  }

  getName(): string {
    return 'Cursor';
  }
}

