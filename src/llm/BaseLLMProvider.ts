/**
 * Base LLM Provider with helper methods for task decomposition, agent selection, etc.
 */

import type { ILLMProvider, LLMRequest } from './types.js';
import logger from '../utils/logger.js';

/**
 * Base class for LLM providers that includes common helper methods
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  abstract requestCompletion(request: LLMRequest): Promise<LLMResponse>;
  abstract isAvailable(): boolean;
  abstract getName(): string;

  /**
   * Request LLM to analyze and decompose a task
   */
  async decomposeTask(taskDescription: string, availableAgents: string[]): Promise<{
    subtasks: Array<{ description: string; agent: string; dependencies?: string[] }>;
    reasoning: string;
  }> {
    const prompt = `Given the following task, break it down into subtasks that can be assigned to specific agents.

Task: ${taskDescription}

Available agents: ${availableAgents.join(', ')}

Please break down the task into logical subtasks, assign each to an appropriate agent, and identify any dependencies between subtasks.

Format your response as JSON with this structure:
{
  "subtasks": [
    {
      "description": "description of subtask",
      "agent": "agent name",
      "dependencies": ["dependent subtask descriptions if any"]
    }
  ],
  "reasoning": "explanation of the decomposition"
}`;

    const response = await this.requestCompletion({
      prompt,
      temperature: 0.3, // Lower temperature for more structured output
    });

    try {
      // Try to parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse JSON from LLM response, using fallback', error);
    }

    // Fallback: simple decomposition
    return {
      subtasks: [
        {
          description: taskDescription,
          agent: availableAgents[0] || 'orchestrator',
        },
      ],
      reasoning: 'Fallback decomposition due to parsing error',
    };
  }

  /**
   * Request LLM to select appropriate agents for a task
   */
  async selectAgents(
    taskDescription: string,
    availableAgents: Array<{ id: string; capabilities: string[]; description: string }>
  ): Promise<string[]> {
    const prompt = `Given the following task and available agents, select the most appropriate agents to handle this task.

Task: ${taskDescription}

Available agents:
${availableAgents.map(a => `- ${a.id}: ${a.description} (capabilities: ${a.capabilities.join(', ')})`).join('\n')}

Respond with a JSON array of agent IDs in order of relevance: ["agent1", "agent2", ...]`;

    const response = await this.requestCompletion({
      prompt,
      temperature: 0.2,
    });

    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse agent selection from LLM response', error);
    }

    // Fallback: return first agent
    return availableAgents.length > 0 ? [availableAgents[0].id] : [];
  }

  /**
   * Request LLM to determine required MCP server capabilities
   */
  async determineRequiredMCPServers(taskDescription: string): Promise<string[]> {
    const prompt = `Analyze the following task and determine what MCP server capabilities would be helpful.

Task: ${taskDescription}

Common MCP server capabilities include:
- File operations (read_file, write_file, list_directory)
- Git operations (git_status, git_commit, git_diff)
- Database operations
- API integrations
- Code analysis
- Documentation generation

Respond with a JSON array of capability names: ["file_operations", "git_operations", ...]`;

    const response = await this.requestCompletion({
      prompt,
      temperature: 0.2,
    });

    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse MCP requirements from LLM response', error);
    }

    // Fallback: empty array
    return [];
  }
}

