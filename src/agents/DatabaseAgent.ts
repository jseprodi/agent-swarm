/**
 * Database Agent - specializes in database operations, queries, schema design, and migrations
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';

export class DatabaseAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'database-agent',
      'Database Agent',
      'Specializes in database operations, query generation, schema design, and migration management using available tools and MCP servers',
      ['database_operations', 'query_generation', 'schema_design', 'migration_management'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`DatabaseAgent executing task: ${task.id} - ${task.description}`);

    try {
      // Check if LLM is available
      if (!this.llm.isAvailable()) {
        return this.createFailureResult(task.id, 'LLM provider is not available');
      }

      // Build database-specific prompt
      const databasePrompt = this.buildDatabasePrompt(task);
      
      const llmResponse = await this.llm.requestCompletion({
        prompt: databasePrompt,
        temperature: 0.2, // Lower temperature for more consistent SQL/query code
      });

      // Try to use MCP servers for database operations if available
      const databaseMCP = this.findDatabaseMCP();
      
      if (databaseMCP) {
        logger.info(`Using MCP server for database operations: ${databaseMCP}`);
      }

      // Extract database code/queries from LLM response
      const databaseCode = this.extractCode(llmResponse.content);
      const explanation = this.extractExplanation(llmResponse.content);
      const databaseType = this.detectDatabaseType(task.description, databaseCode);
      const operationType = this.detectOperationType(task.description);

      return this.createSuccessResult(
        task.id,
        {
          databaseCode,
          explanation,
          databaseType,
          operationType,
          mcpServersUsed: databaseMCP ? [databaseMCP] : [],
        },
        {
          promptTokens: llmResponse.usage?.promptTokens,
          completionTokens: llmResponse.usage?.completionTokens,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`DatabaseAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private buildDatabasePrompt(task: Task): string {
    const dbContext = task.metadata?.databaseContext as string | undefined;
    const dbType = task.metadata?.databaseType as string | undefined;

    return `You are a database specialist agent. Generate database operations based on the following task:

Task: ${task.description}

${dbType ? `Database Type: ${dbType}` : ''}
${dbContext ? `Database Context:\n\`\`\`\n${dbContext}\n\`\`\`\n` : ''}

Please provide:
1. The complete database operation (SQL queries, schema definitions, or migration scripts)
2. A brief explanation of the approach and any considerations

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

  private detectDatabaseType(description: string, code: string): string {
    // Detect database type from description or code
    const lowerDesc = description.toLowerCase();
    const lowerCode = code.toLowerCase();

    if (lowerDesc.includes('postgresql') || lowerDesc.includes('postgres') || lowerCode.includes('postgres')) {
      return 'postgresql';
    }
    if (lowerDesc.includes('mysql') || lowerCode.includes('mysql')) {
      return 'mysql';
    }
    if (lowerDesc.includes('sqlite') || lowerCode.includes('sqlite')) {
      return 'sqlite';
    }
    if (lowerDesc.includes('mongodb') || lowerDesc.includes('mongo') || lowerCode.includes('mongodb')) {
      return 'mongodb';
    }
    if (lowerDesc.includes('redis') || lowerCode.includes('redis')) {
      return 'redis';
    }
    if (lowerDesc.includes('cassandra') || lowerCode.includes('cassandra')) {
      return 'cassandra';
    }
    if (lowerDesc.includes('dynamodb') || lowerCode.includes('dynamodb')) {
      return 'dynamodb';
    }
    if (lowerCode.includes('select') || lowerCode.includes('insert') || lowerCode.includes('create table')) {
      return 'sql';
    }
    if (lowerCode.includes('db.') || lowerCode.includes('collection')) {
      return 'nosql';
    }
    return 'unknown';
  }

  private detectOperationType(description: string): string {
    // Detect the type of database operation
    const lowerDesc = description.toLowerCase();

    // Check for migration first (before schema/table)
    if (lowerDesc.includes('migration') || lowerDesc.includes('migrate') || (lowerDesc.includes('alter') && !lowerDesc.includes('create'))) {
      return 'migration';
    }
    if (lowerDesc.includes('schema') || lowerDesc.includes('table') || lowerDesc.includes('create table')) {
      return 'schema_design';
    }
    if (lowerDesc.includes('query') || lowerDesc.includes('select') || lowerDesc.includes('insert') || lowerDesc.includes('update') || lowerDesc.includes('delete')) {
      return 'query';
    }
    if (lowerDesc.includes('index') || lowerDesc.includes('indexing')) {
      return 'indexing';
    }
    if (lowerDesc.includes('optimize') || lowerDesc.includes('performance')) {
      return 'optimization';
    }
    return 'general';
  }

  private findDatabaseMCP(): string | undefined {
    // Find an MCP client that provides database operations
    for (const [serverId, client] of this.mcpClients.entries()) {
      const capabilities = client.getCapabilities();
      if (
        capabilities.tools?.some(tool =>
          ['query', 'execute_sql', 'create_table', 'migrate', 'database_operation'].includes(tool)
        )
      ) {
        return serverId;
      }
    }
    return undefined;
  }
}

