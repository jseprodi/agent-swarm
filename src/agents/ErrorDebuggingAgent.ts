/**
 * Error Debugging Agent - troubleshoots console and network errors
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';
import {
  parseErrorAnalysis,
  parseNetworkAnalysis,
  parsePreventionAnalysis,
  categorizeError,
  categorizeNetworkError,
  calculateRiskLevel,
} from './helpers/errorParsing.js';
import {
  findConsoleMCP,
  findNetworkMCP,
  findFileOperationMCP,
} from './helpers/mcpFinders.js';

export class ErrorDebuggingAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'error-debugging-agent',
      'Error Debugging Agent',
      'Troubleshoots console errors, network errors, and proactively detects potential issues in web applications',
      ['error_debugging', 'error_prevention', 'code_analysis'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`ErrorDebuggingAgent executing task: ${task.id} - ${task.description}`);

    try {
      const taskType = this.determineTaskType(task);
      
      switch (taskType) {
        case 'console':
          return await this.debugConsoleError(task);
        case 'network':
          return await this.debugNetworkError(task);
        case 'prevent':
          return await this.preventErrors(task);
        default:
          return await this.handleGeneralErrorTask(task);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`ErrorDebuggingAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private determineTaskType(task: Task): 'console' | 'network' | 'prevent' | 'general' {
    const description = task.description.toLowerCase();
    
    if (description.includes('console') || description.includes('javascript error')) {
      return 'console';
    }
    if (description.includes('network') || description.includes('http') || description.includes('api')) {
      return 'network';
    }
    if (description.includes('prevent') || description.includes('potential') || description.includes('scan')) {
      return 'prevent';
    }
    
    return 'general';
  }

  private async debugConsoleError(task: Task): Promise<TaskResult> {
    const errorMessage = task.metadata?.errorMessage as string | undefined;
    const stackTrace = task.metadata?.stackTrace as string | undefined;
    const codeContext = task.metadata?.codeContext as string | undefined;
    const browserInfo = task.metadata?.browserInfo as string | undefined;

    const prompt = `You are a JavaScript debugging expert. Analyze and debug the following console error:

Task: ${task.description}

Error Message: ${errorMessage || 'Not provided'}
${stackTrace ? `Stack Trace:\n\`\`\`\n${stackTrace}\n\`\`\`` : ''}
${codeContext ? `Code Context:\n\`\`\`javascript\n${codeContext}\n\`\`\`` : ''}
${browserInfo ? `Browser: ${browserInfo}` : ''}

Please provide:
1. Root cause analysis of the error
2. Explanation of why this error occurred
3. Step-by-step fix instructions
4. Corrected code if applicable
5. Prevention strategies for similar errors
6. Browser compatibility notes if relevant

Format your response with clear sections and code examples.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.2, // Lower temperature for more accurate debugging
    });

    const analysis = parseErrorAnalysis(llmResponse.content);

    // Try to get console errors via MCP if available
    const consoleMCP = findConsoleMCP(this.mcpClients);
    if (consoleMCP && !errorMessage) {
      try {
        const client = this.getMCPClient(consoleMCP);
        if (client) {
          const errors = await client.callTool('get_console_errors', {});
          if (errors && typeof errors === 'object') {
            analysis.recentErrors = errors;
          }
        }
      } catch (error) {
        logger.warn(`Failed to get console errors via MCP: ${error}`);
      }
    }

    return this.createSuccessResult(
      task.id,
      {
        ...analysis,
        errorType: categorizeError(errorMessage || ''),
        fixes: analysis.fixes || [],
        rootCause: analysis.rootCause || '',
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
        mcpServerUsed: consoleMCP || undefined,
      }
    );
  }

  private async debugNetworkError(task: Task): Promise<TaskResult> {
    const requestUrl = task.metadata?.requestUrl as string | undefined;
    const requestMethod = task.metadata?.requestMethod as string | undefined;
    const statusCode = task.metadata?.statusCode as number | undefined;
    const responseBody = task.metadata?.responseBody as string | undefined;
    const requestHeaders = task.metadata?.requestHeaders as Record<string, string> | undefined;

    const prompt = `You are a network debugging expert. Analyze and debug the following network error:

Task: ${task.description}

Request: ${requestMethod || 'GET'} ${requestUrl || 'Not provided'}
${statusCode ? `Status Code: ${statusCode}` : ''}
${requestHeaders ? `Headers: ${JSON.stringify(requestHeaders, null, 2)}` : ''}
${responseBody ? `Response Body:\n\`\`\`json\n${responseBody.substring(0, 1000)}\n\`\`\`` : ''}

Please provide:
1. Analysis of the network request/response
2. Identification of the problem (CORS, authentication, timeout, etc.)
3. Step-by-step fix instructions
4. Code examples for corrected requests
5. Prevention strategies
6. Common pitfalls to avoid

Format your response with clear sections and code examples.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.2,
    });

    const analysis = parseNetworkAnalysis(llmResponse.content);

    // Try to get network logs via MCP if available
    const networkMCP = findNetworkMCP(this.mcpClients);
    if (networkMCP && !requestUrl) {
      try {
        const client = this.getMCPClient(networkMCP);
        if (client) {
          const networkLogs = await client.callTool('get_network_logs', {});
          if (networkLogs && typeof networkLogs === 'object') {
            analysis.recentRequests = networkLogs;
          }
        }
      } catch (error) {
        logger.warn(`Failed to get network logs via MCP: ${error}`);
      }
    }

    return this.createSuccessResult(
      task.id,
      {
        ...analysis,
        errorType: categorizeNetworkError(statusCode),
        fixes: analysis.fixes || [],
        suggestedHeaders: analysis.suggestedHeaders || {},
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
        mcpServerUsed: networkMCP || undefined,
      }
    );
  }

  private async preventErrors(task: Task): Promise<TaskResult> {
    const codeFiles = task.metadata?.codeFiles as string[] | undefined;
    const codeContent = task.metadata?.codeContent as string | undefined;

    let codeToAnalyze = codeContent;

    // Try to read files via MCP if paths provided
    if (codeFiles && codeFiles.length > 0) {
      const fileMCP = findFileOperationMCP(this.mcpClients);
      if (fileMCP) {
        try {
          const client = this.getMCPClient(fileMCP);
          if (client) {
            const fileContents: string[] = [];
            for (const filePath of codeFiles) {
              const content = await client.callTool('read_file', { path: filePath });
              fileContents.push(typeof content === 'string' ? content : JSON.stringify(content));
            }
            codeToAnalyze = fileContents.join('\n\n');
          }
        } catch (error) {
          logger.warn(`Failed to read files via MCP: ${error}`);
        }
      }
    }

    if (!codeToAnalyze) {
      return this.createFailureResult(
        task.id,
        'No code content or files provided for error prevention analysis'
      );
    }

    const prompt = `You are an expert at preventing JavaScript errors. Analyze the following code for potential issues:

Task: ${task.description}

Code:
\`\`\`javascript
${codeToAnalyze.substring(0, 10000)}
\`\`\`

Please scan for:
1. Potential runtime errors (null/undefined access, type mismatches)
2. Async/await issues (unhandled promises, race conditions)
3. Memory leaks (event listeners not removed, closures holding references)
4. Common pitfalls (using var instead of let/const, missing error handling)
5. Browser compatibility issues
6. Network request issues (missing error handling, timeout issues)
7. State management issues

Provide a detailed report with:
- List of potential issues found
- Severity level for each issue
- Specific code locations where applicable
- Recommended fixes
- Prevention strategies

Format as a structured analysis.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.2,
    });

    const analysis = parsePreventionAnalysis(llmResponse.content);

    return this.createSuccessResult(
      task.id,
      {
        ...analysis,
        potentialIssues: analysis.issues || [],
        recommendations: analysis.recommendations || [],
        riskLevel: calculateRiskLevel(analysis.issues || []),
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
      }
    );
  }

  private async handleGeneralErrorTask(task: Task): Promise<TaskResult> {
    // Try to determine if it's console or network based on description
    return await this.debugConsoleError(task);
  }

}

