/**
 * Base LLM Provider with helper methods for task decomposition, agent selection, etc.
 */

import type { ILLMProvider, LLMRequest, LLMResponse } from './types.js';
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

  /**
   * Request LLM to generate an agent specification for a given task
   */
  async generateAgentSpecification(
    taskDescription: string,
    missingCapabilities: string[],
    existingAgents: Array<{ id: string; name: string; capabilities: string[]; description: string }>
  ): Promise<{
    name: string;
    description: string;
    capabilities: string[];
    behavior: {
      executionStrategy: 'llm_direct' | 'workflow' | 'hybrid';
      promptTemplate?: string;
      workflowSteps?: Array<{ step: string; description: string; action: string }>;
      outputFormat?: 'json' | 'text' | 'code' | 'mixed';
      temperature?: number;
      maxTokens?: number;
    };
    requiredMCPServers?: string[];
    metadata?: Record<string, unknown>;
  }> {
    const existingAgentsList = existingAgents
      .map(a => `- ${a.name} (${a.id}): ${a.description} [${a.capabilities.join(', ')}]`)
      .join('\n');

    const prompt = `You are designing a specialized agent to handle a specific task. Analyze the task and create a complete agent specification.

Task: ${taskDescription}

Missing capabilities that need to be addressed: ${missingCapabilities.join(', ')}

Existing agents in the system:
${existingAgentsList || 'None'}

Create a specialized agent specification that:
1. Has a clear, descriptive name
2. Has a detailed description of what it does
3. Includes the missing capabilities plus any related ones
4. Defines an execution strategy (llm_direct, workflow, or hybrid)
5. Optionally includes a prompt template or workflow steps
6. Specifies output format if relevant
7. Identifies any required MCP servers

Respond with a JSON object matching this structure:
{
  "name": "Agent Name",
  "description": "Detailed description of the agent's purpose and specialization",
  "capabilities": ["capability1", "capability2"],
  "behavior": {
    "executionStrategy": "llm_direct" | "workflow" | "hybrid",
    "promptTemplate": "Optional template with {{placeholders}}",
    "workflowSteps": [
      {
        "step": "step_name",
        "description": "What this step does",
        "action": "Specific action to take"
      }
    ],
    "outputFormat": "json" | "text" | "code" | "mixed",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "requiredMCPServers": ["server1", "server2"],
  "metadata": {
    "createdFor": "task description",
    "complexity": "low" | "medium" | "high"
  }
}`;

    const response = await this.requestCompletion({
      prompt,
      temperature: 0.3, // Lower temperature for more structured output
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const spec = JSON.parse(jsonMatch[0]);
        // Validate and set defaults
        return {
          name: spec.name || 'Unnamed Agent',
          description: spec.description || 'A dynamically created agent',
          capabilities: Array.isArray(spec.capabilities) ? spec.capabilities : missingCapabilities,
          behavior: {
            executionStrategy: spec.behavior?.executionStrategy || 'llm_direct',
            promptTemplate: spec.behavior?.promptTemplate,
            workflowSteps: spec.behavior?.workflowSteps,
            outputFormat: spec.behavior?.outputFormat || 'mixed',
            temperature: spec.behavior?.temperature ?? 0.7,
            maxTokens: spec.behavior?.maxTokens,
          },
          requiredMCPServers: spec.requiredMCPServers,
          metadata: spec.metadata || {},
        };
      }
    } catch (error) {
      logger.warn('Failed to parse agent specification from LLM response', error);
    }

    // Fallback: create a basic specification
    return {
      name: `Specialized Agent for ${taskDescription.substring(0, 30)}`,
      description: `A specialized agent created to handle: ${taskDescription}`,
      capabilities: missingCapabilities.length > 0 ? missingCapabilities : ['general'],
      behavior: {
        executionStrategy: 'llm_direct',
        outputFormat: 'mixed',
        temperature: 0.7,
      },
      metadata: {
        createdFor: taskDescription,
        fallback: true,
      },
    };
  }

  /**
   * Request LLM to detect if a specialized agent would be beneficial for a task
   */
  async detectMissingAgentCapability(
    taskDescription: string,
    existingAgents: Array<{ id: string; name: string; capabilities: string[]; description: string }>,
    subtaskDescription?: string
  ): Promise<{
    shouldCreate: boolean;
    missingCapabilities: string[];
    rationale: string;
    complexity: 'low' | 'medium' | 'high';
  }> {
    const taskToAnalyze = subtaskDescription || taskDescription;
    const existingAgentsList = existingAgents
      .map(a => `- ${a.name}: ${a.description} [${a.capabilities.join(', ')}]`)
      .join('\n');

    const prompt = `Analyze whether a new specialized agent should be created for this task.

Task: ${taskToAnalyze}

Existing agents:
${existingAgentsList || 'None'}

Determine:
1. Whether any existing agent can handle this task well
2. What capabilities would be needed for this task
3. Whether creating a specialized agent would be beneficial
4. The complexity of the task (low/medium/high)

Consider creating a new agent if:
- No existing agent has the right combination of capabilities
- The task is complex enough to warrant specialization
- The agent could be reused for similar tasks

Respond with JSON:
{
  "shouldCreate": true | false,
  "missingCapabilities": ["capability1", "capability2"],
  "rationale": "Explanation of why creating an agent is or isn't beneficial",
  "complexity": "low" | "medium" | "high"
}`;

    const response = await this.requestCompletion({
      prompt,
      temperature: 0.2, // Lower temperature for more consistent analysis
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          shouldCreate: analysis.shouldCreate === true,
          missingCapabilities: Array.isArray(analysis.missingCapabilities)
            ? analysis.missingCapabilities
            : [],
          rationale: analysis.rationale || 'No rationale provided',
          complexity: ['low', 'medium', 'high'].includes(analysis.complexity)
            ? analysis.complexity
            : 'medium',
        };
      }
    } catch (error) {
      logger.warn('Failed to parse capability detection from LLM response', error);
    }

    // Fallback: conservative approach - don't create unless clearly needed
    return {
      shouldCreate: false,
      missingCapabilities: [],
      rationale: 'Failed to analyze task requirements',
      complexity: 'medium',
    };
  }
}

