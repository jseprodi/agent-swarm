/**
 * Dynamic Agent - configurable agent created at runtime with LLM-generated specifications
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult, AgentSpecification } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';

export class DynamicAgent extends BaseAgent {
  private specification: AgentSpecification;

  constructor(
    id: string,
    specification: AgentSpecification,
    llm?: ILLMProvider
  ) {
    super(
      id,
      specification.name,
      specification.description,
      specification.capabilities,
      llm
    );
    this.specification = specification;
  }

  /**
   * Get the agent specification
   */
  getSpecification(): AgentSpecification {
    return this.specification;
  }

  /**
   * Update the agent specification (for runtime behavior updates)
   */
  updateSpecification(specification: Partial<AgentSpecification>): void {
    this.specification = {
      ...this.specification,
      ...specification,
      updatedAt: new Date(),
    };
    logger.info(`Updated specification for agent ${this.id}`);
  }

  /**
   * Execute a task using the agent's behavior specification
   */
  async execute(task: Task): Promise<TaskResult> {
    logger.info(`DynamicAgent ${this.id} executing task: ${task.id} - ${task.description}`);

    try {
      const behavior = this.specification.behavior;
      const result = await this.executeWithStrategy(task, behavior);

      return this.createSuccessResult(
        task.id,
        result.data,
        {
          ...result.metadata,
          agentId: this.id,
          agentName: this.name,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`DynamicAgent ${this.id} error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  /**
   * Execute task based on the behavior strategy
   */
  private async executeWithStrategy(
    task: Task,
    behavior: AgentSpecification['behavior']
  ): Promise<{ data: unknown; metadata?: Record<string, unknown> }> {
    switch (behavior.executionStrategy) {
      case 'llm_direct':
        return await this.executeLLMDirect(task, behavior);
      case 'workflow':
        return await this.executeWorkflow(task, behavior);
      case 'hybrid':
        return await this.executeHybrid(task, behavior);
      default:
        return await this.executeLLMDirect(task, behavior);
    }
  }

  /**
   * Execute using direct LLM interaction
   */
  private async executeLLMDirect(
    task: Task,
    behavior: AgentSpecification['behavior']
  ): Promise<{ data: unknown; metadata?: Record<string, unknown> }> {
    const prompt = this.buildPrompt(task, behavior);
    
    const response = await this.llm.requestCompletion({
      prompt,
      temperature: behavior.temperature ?? 0.7,
      maxTokens: behavior.maxTokens,
    });

    const data = this.parseResponse(response.content, behavior.outputFormat);

    return {
      data,
      metadata: {
        promptTokens: response.usage?.promptTokens,
        completionTokens: response.usage?.completionTokens,
        strategy: 'llm_direct',
      },
    };
  }

  /**
   * Execute using workflow steps
   */
  private async executeWorkflow(
    task: Task,
    behavior: AgentSpecification['behavior']
  ): Promise<{ data: unknown; metadata?: Record<string, unknown> }> {
    if (!behavior.workflowSteps || behavior.workflowSteps.length === 0) {
      logger.warn(`No workflow steps defined for agent ${this.id}, falling back to LLM direct`);
      return await this.executeLLMDirect(task, behavior);
    }

    const results: Array<{ step: string; result: unknown }> = [];
    
    for (const workflowStep of behavior.workflowSteps) {
      logger.debug(`Executing workflow step: ${workflowStep.step}`);
      
      const stepPrompt = this.buildWorkflowStepPrompt(task, workflowStep, results);
      const response = await this.llm.requestCompletion({
        prompt: stepPrompt,
        temperature: behavior.temperature ?? 0.7,
        maxTokens: behavior.maxTokens,
      });

      const stepResult = this.parseResponse(response.content, behavior.outputFormat);
      results.push({
        step: workflowStep.step,
        result: stepResult,
      });
    }

    return {
      data: {
        workflowResults: results,
        finalResult: results[results.length - 1]?.result,
      },
      metadata: {
        strategy: 'workflow',
        stepsExecuted: results.length,
      },
    };
  }

  /**
   * Execute using hybrid approach (combines LLM and workflow)
   */
  private async executeHybrid(
    task: Task,
    behavior: AgentSpecification['behavior']
  ): Promise<{ data: unknown; metadata?: Record<string, unknown> }> {
    // Start with LLM direct to understand the task
    const initialPrompt = this.buildPrompt(task, behavior);
    const initialResponse = await this.llm.requestCompletion({
      prompt: initialPrompt,
      temperature: behavior.temperature ?? 0.7,
      maxTokens: behavior.maxTokens,
    });

    // Then execute workflow if steps are defined
    if (behavior.workflowSteps && behavior.workflowSteps.length > 0) {
      const workflowResults: Array<{ step: string; result: unknown }> = [];
      
      for (const workflowStep of behavior.workflowSteps) {
        const stepPrompt = this.buildWorkflowStepPrompt(
          task,
          workflowStep,
          workflowResults,
          initialResponse.content
        );
        const response = await this.llm.requestCompletion({
          prompt: stepPrompt,
          temperature: behavior.temperature ?? 0.7,
          maxTokens: behavior.maxTokens,
        });

        workflowResults.push({
          step: workflowStep.step,
          result: this.parseResponse(response.content, behavior.outputFormat),
        });
      }

      return {
        data: {
          initialAnalysis: this.parseResponse(initialResponse.content, behavior.outputFormat),
          workflowResults,
          finalResult: workflowResults[workflowResults.length - 1]?.result,
        },
        metadata: {
          strategy: 'hybrid',
          stepsExecuted: workflowResults.length,
        },
      };
    }

    // Fallback to LLM direct if no workflow steps
    return await this.executeLLMDirect(task, behavior);
  }

  /**
   * Build prompt from template and task
   */
  private buildPrompt(task: Task, behavior: AgentSpecification['behavior']): string {
    if (behavior.promptTemplate) {
      // Replace placeholders in template
      return behavior.promptTemplate
        .replace('{{taskDescription}}', task.description)
        .replace('{{agentName}}', this.name)
        .replace('{{agentDescription}}', this.description)
        .replace('{{capabilities}}', this.capabilities.join(', '))
        .replace('{{metadata}}', JSON.stringify(task.metadata || {}, null, 2));
    }

    // Default prompt if no template
    return `You are ${this.name}, a specialized agent with the following description:
${this.description}

Your capabilities: ${this.capabilities.join(', ')}

Task: ${task.description}

${task.metadata ? `Additional context: ${JSON.stringify(task.metadata, null, 2)}` : ''}

Please complete this task according to your specialization.`;
  }

  /**
   * Build prompt for a workflow step
   */
  private buildWorkflowStepPrompt(
    task: Task,
    step: AgentSpecification['behavior']['workflowSteps']![0],
    previousResults: Array<{ step: string; result: unknown }>,
    initialContext?: string
  ): string {
    let prompt = `You are ${this.name}, executing step: ${step.step}\n\n`;
    prompt += `Step description: ${step.description}\n`;
    prompt += `Action: ${step.action}\n\n`;
    prompt += `Original task: ${task.description}\n\n`;

    if (initialContext) {
      prompt += `Initial context: ${initialContext}\n\n`;
    }

    if (previousResults.length > 0) {
      prompt += `Previous step results:\n`;
      previousResults.forEach((prev, idx) => {
        prompt += `Step ${idx + 1} (${prev.step}): ${JSON.stringify(prev.result, null, 2)}\n`;
      });
      prompt += '\n';
    }

    prompt += `Execute this step and provide the result.`;

    return prompt;
  }

  /**
   * Parse LLM response based on output format
   */
  private parseResponse(content: string, format?: string): unknown {
    switch (format) {
      case 'json':
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          logger.warn('Failed to parse JSON response, returning as text');
        }
        return content;

      case 'code':
        // Extract code blocks
        const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
        const matches = Array.from(content.matchAll(codeBlockRegex));
        if (matches.length > 0) {
          return matches.map(m => m[1]).join('\n\n');
        }
        return content;

      case 'mixed':
        // Try to extract both JSON and code
        const result: { json?: unknown; code?: string; text?: string } = {};
        
        // Try JSON first
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            result.json = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Ignore JSON parse errors
        }

        // Extract code
        const codeMatches = Array.from(content.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g));
        if (codeMatches.length > 0) {
          result.code = codeMatches.map(m => m[1]).join('\n\n');
        }

        // Remaining text
        const textOnly = content
          .replace(/\{[\s\S]*\}|\[[\s\S]*\]/g, '')
          .replace(/```[\s\S]*?```/g, '')
          .trim();
        if (textOnly) {
          result.text = textOnly;
        }

        return Object.keys(result).length > 0 ? result : content;

      case 'text':
      default:
        return content;
    }
  }
}

