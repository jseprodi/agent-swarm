/**
 * Error Debugging Agent - troubleshoots console and network errors
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';

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

    const analysis = this.parseErrorAnalysis(llmResponse.content);

    // Try to get console errors via MCP if available
    const consoleMCP = this.findConsoleMCP();
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
        errorType: this.categorizeError(errorMessage || ''),
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

    const analysis = this.parseNetworkAnalysis(llmResponse.content);

    // Try to get network logs via MCP if available
    const networkMCP = this.findNetworkMCP();
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
        errorType: this.categorizeNetworkError(statusCode),
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
      const fileMCP = this.findFileOperationMCP();
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

    const analysis = this.parsePreventionAnalysis(llmResponse.content);

    return this.createSuccessResult(
      task.id,
      {
        ...analysis,
        potentialIssues: analysis.issues || [],
        recommendations: analysis.recommendations || [],
        riskLevel: this.calculateRiskLevel(analysis.issues || []),
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

  private parseErrorAnalysis(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse error analysis as JSON', error);
    }

    return {
      rootCause: this.extractSection(content, 'root cause', 'explanation'),
      fixes: this.extractFixes(content),
      explanation: this.extractSection(content, 'explanation', 'fix'),
    };
  }

  private parseNetworkAnalysis(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse network analysis as JSON', error);
    }

    return {
      problem: this.extractSection(content, 'problem', 'fix'),
      fixes: this.extractFixes(content),
      suggestedHeaders: this.extractHeaders(content),
    };
  }

  private parsePreventionAnalysis(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse prevention analysis as JSON', error);
    }

    return {
      issues: this.extractIssuesList(content),
      recommendations: this.extractRecommendations(content),
    };
  }

  private extractSection(content: string, startKeyword: string, endKeyword: string): string {
    const lowerContent = content.toLowerCase();
    const startIdx = lowerContent.indexOf(startKeyword);
    const endIdx = lowerContent.indexOf(endKeyword, startIdx + startKeyword.length);
    
    if (startIdx !== -1) {
      const end = endIdx !== -1 ? endIdx : startIdx + 500;
      return content.substring(startIdx, end).trim();
    }
    
    return '';
  }

  private extractFixes(content: string): string[] {
    const fixes: string[] = [];
    const lines = content.split('\n');
    let inFixSection = false;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('fix') || lowerLine.includes('solution')) {
        inFixSection = true;
      }
      if (inFixSection && (line.trim().startsWith('-') || line.trim().startsWith('1.'))) {
        fixes.push(line.trim());
      }
      if (inFixSection && lowerLine.includes('prevent') && fixes.length > 0) {
        break;
      }
    }

    return fixes;
  }

  private extractIssuesList(content: string): Array<{ issue: string; severity: string }> {
    const issues: Array<{ issue: string; severity: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim().startsWith('-') || line.trim().match(/^\d+\./)) {
        const severity = this.detectSeverity(line);
        issues.push({
          issue: line.trim(),
          severity,
        });
      }
    }

    return issues;
  }

  private detectSeverity(line: string): string {
    const lower = line.toLowerCase();
    if (lower.includes('critical') || lower.includes('high')) return 'high';
    if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
    if (lower.includes('low') || lower.includes('minor')) return 'low';
    return 'medium';
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const lower = line.toLowerCase();
      if ((lower.includes('recommend') || lower.includes('should') || lower.includes('best practice')) && line.trim().length > 20) {
        recommendations.push(line.trim());
      }
    }

    return recommendations.slice(0, 10); // Limit to top 10
  }

  private extractHeaders(content: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerMatch = content.match(/(?:headers?|request headers?)[:]\s*\n((?:\s*['"]?[\w-]+['"]?:\s*['"]?[^'"]+['"]?,?\s*\n?)+)/i);
    
    if (headerMatch) {
      const headerLines = headerMatch[1].split('\n');
      for (const line of headerLines) {
        const match = line.match(/(['"]?)([\w-]+)\1:\s*(['"]?)([^'"]+)\3/);
        if (match) {
          headers[match[2]] = match[4];
        }
      }
    }

    return headers;
  }

  private categorizeError(errorMessage: string): string {
    const lower = errorMessage.toLowerCase();
    
    if (lower.includes('undefined') || lower.includes('null')) return 'null_reference';
    if (lower.includes('cannot read') || lower.includes('cannot access')) return 'property_access';
    if (lower.includes('syntax')) return 'syntax_error';
    if (lower.includes('type')) return 'type_error';
    if (lower.includes('reference')) return 'reference_error';
    if (lower.includes('async') || lower.includes('promise')) return 'async_error';
    
    return 'unknown';
  }

  private categorizeNetworkError(statusCode?: number): string {
    if (!statusCode) return 'unknown';
    
    if (statusCode >= 200 && statusCode < 300) return 'success';
    if (statusCode === 404) return 'not_found';
    if (statusCode === 403 || statusCode === 401) return 'authentication';
    if (statusCode === 500) return 'server_error';
    if (statusCode === 0 || statusCode === -1) return 'network_error';
    
    return 'http_error';
  }

  private calculateRiskLevel(issues: Array<{ issue: string; severity: string }>): string {
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;
    
    if (highCount > 3) return 'critical';
    if (highCount > 0 || mediumCount > 5) return 'high';
    if (mediumCount > 0) return 'medium';
    
    return 'low';
  }

  private findConsoleMCP(): string | undefined {
    for (const [serverId, client] of this.mcpClients.entries()) {
      const capabilities = client.getCapabilities();
      if (
        capabilities.tools?.some(tool =>
          ['get_console_errors', 'get_console_logs', 'console'].includes(tool)
        )
      ) {
        return serverId;
      }
    }
    return undefined;
  }

  private findNetworkMCP(): string | undefined {
    for (const [serverId, client] of this.mcpClients.entries()) {
      const capabilities = client.getCapabilities();
      if (
        capabilities.tools?.some(tool =>
          ['get_network_logs', 'network_request', 'http'].includes(tool)
        )
      ) {
        return serverId;
      }
    }
    return undefined;
  }

  private findFileOperationMCP(): string | undefined {
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

