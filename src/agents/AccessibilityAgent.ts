/**
 * Accessibility Agent - tests WCAG compliance and implements accessibility features
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';
import {
  parseAuditReport,
  extractChanges,
  extractHTML,
  calculateComplianceScore,
} from './helpers/accessibilityParsing.js';
import {
  findAccessibilityMCP,
  findFileOperationMCP,
} from './helpers/mcpFinders.js';

export class AccessibilityAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'accessibility-agent',
      'Accessibility Agent',
      'Tests for WCAG compliance and implements accessibility features including ARIA labels, keyboard navigation, and screen reader optimization',
      ['accessibility_testing', 'accessibility_implementation', 'code_analysis'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`AccessibilityAgent executing task: ${task.id} - ${task.description}`);

    try {
      const taskType = this.determineTaskType(task);
      
      switch (taskType) {
        case 'test':
          return await this.testAccessibility(task);
        case 'implement':
          return await this.implementAccessibility(task);
        default:
          return await this.handleGeneralAccessibilityTask(task);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`AccessibilityAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private determineTaskType(task: Task): 'test' | 'implement' | 'general' {
    const description = task.description.toLowerCase();
    
    if (description.includes('test') || description.includes('audit') || description.includes('check') || description.includes('verify')) {
      return 'test';
    }
    if (description.includes('implement') || description.includes('add') || description.includes('fix') || description.includes('improve')) {
      return 'implement';
    }
    
    return 'general';
  }

  private async testAccessibility(task: Task): Promise<TaskResult> {
    const htmlContent = task.metadata?.htmlContent as string | undefined;
    const htmlPath = task.metadata?.htmlPath as string | undefined;
    const wcagLevel = (task.metadata?.wcagLevel as string) || 'AA';
    const includeAA = wcagLevel === 'AA' || wcagLevel === 'AAA';
    const includeAAA = wcagLevel === 'AAA';

    let htmlToTest = htmlContent;

    // Try to read HTML file via MCP if path provided
    if (!htmlToTest && htmlPath) {
      const fileMCP = findFileOperationMCP(this.mcpClients);
      if (fileMCP) {
        try {
          const client = this.getMCPClient(fileMCP);
          if (client) {
            const fileContent = await client.callTool('read_file', { path: htmlPath });
            htmlToTest = typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent);
          }
        } catch (error) {
          logger.warn(`Failed to read file via MCP: ${error}`);
        }
      }
    }

    // Try to use accessibility testing MCP server if available
    const a11yMCP = findAccessibilityMCP(this.mcpClients);
    let automatedResults: any = null;

    if (a11yMCP && htmlToTest) {
      try {
        const client = this.getMCPClient(a11yMCP);
        if (client) {
          automatedResults = await client.callTool('run_accessibility_audit', {
            html: htmlToTest,
            level: wcagLevel,
          });
        }
      } catch (error) {
        logger.warn(`Failed to run automated accessibility test via MCP: ${error}`);
      }
    }

    if (!htmlToTest && !automatedResults) {
      return this.createFailureResult(
        task.id,
        'No HTML content or path provided for accessibility testing'
      );
    }

    const prompt = `You are an accessibility expert specializing in WCAG compliance. Perform a comprehensive accessibility audit:

Task: ${task.description}

${htmlToTest ? `HTML Content:\n\`\`\`html\n${htmlToTest.substring(0, 5000)}\n\`\`\`` : ''}
WCAG Level: ${wcagLevel}

Please audit and provide:
1. WCAG ${wcagLevel} compliance status
2. List of all accessibility violations found
3. Issues categorized by:
   - Perceivable (images without alt text, color contrast, etc.)
   - Operable (keyboard navigation, focus indicators, etc.)
   - Understandable (language, labels, error messages, etc.)
   - Robust (semantic HTML, ARIA usage, etc.)
4. Color contrast ratios for all text
5. Keyboard navigation flow analysis
6. Screen reader compatibility issues
7. Priority levels (critical, high, medium, low)
8. Specific line numbers or element selectors where applicable

Format as a structured audit report.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.2,
    });

    const audit = parseAuditReport(llmResponse.content);

    // Merge with automated results if available
    if (automatedResults) {
      audit.automatedResults = automatedResults;
      audit.complianceScore = calculateComplianceScore(audit, automatedResults);
    }

    return this.createSuccessResult(
      task.id,
      {
        ...audit,
        wcagLevel,
        violations: audit.violations || [],
        recommendations: audit.recommendations || [],
        complianceScore: audit.complianceScore || 0,
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
        mcpServerUsed: a11yMCP || undefined,
      }
    );
  }

  private async implementAccessibility(task: Task): Promise<TaskResult> {
    const htmlContent = task.metadata?.htmlContent as string | undefined;
    const htmlPath = task.metadata?.htmlPath as string | undefined;
    const issuesToFix = task.metadata?.issuesToFix as string[] | undefined;

    let htmlToFix = htmlContent;

    // Try to read HTML file via MCP if path provided
    if (!htmlToFix && htmlPath) {
      const fileMCP = findFileOperationMCP(this.mcpClients);
      if (fileMCP) {
        try {
          const client = this.getMCPClient(fileMCP);
          if (client) {
            const fileContent = await client.callTool('read_file', { path: htmlPath });
            htmlToFix = typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent);
          }
        } catch (error) {
          logger.warn(`Failed to read file via MCP: ${error}`);
        }
      }
    }

    if (!htmlToFix) {
      return this.createFailureResult(
        task.id,
        'No HTML content or path provided for accessibility implementation'
      );
    }

    const prompt = `You are an accessibility implementation expert. Fix accessibility issues in the following HTML:

Task: ${task.description}

HTML Content:
\`\`\`html
${htmlToFix.substring(0, 10000)}
\`\`\`

${issuesToFix ? `Specific Issues to Fix: ${issuesToFix.join(', ')}` : ''}

Please implement the following accessibility improvements:
1. Add missing alt text to all images
2. Add ARIA labels and roles where needed
3. Ensure proper heading hierarchy (h1-h6)
4. Add keyboard navigation support (tabindex, focus indicators)
5. Fix color contrast issues
6. Add form labels and error messages
7. Ensure semantic HTML usage
8. Add skip navigation links
9. Ensure focus order is logical
10. Add ARIA live regions for dynamic content

Provide the improved HTML with all accessibility fixes applied. Include comments explaining each change.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.3,
    });

    const improvedHTML = extractHTML(llmResponse.content);
    const changes = extractChanges(llmResponse.content);

    // Try to write improved HTML back via MCP
    const fileMCP = findFileOperationMCP(this.mcpClients);
    if (fileMCP && htmlPath) {
      try {
        const client = this.getMCPClient(fileMCP);
        if (client) {
          await client.callTool('write_file', {
            path: htmlPath,
            content: improvedHTML,
          });
          logger.info(`Wrote improved HTML to ${htmlPath} via MCP server`);
        }
      } catch (error) {
        logger.warn(`Failed to write file via MCP: ${error}`);
      }
    }

    return this.createSuccessResult(
      task.id,
      {
        improvedHTML,
        changes,
        changesCount: changes.length,
        targetFile: htmlPath || 'improved.html',
        mcpServerUsed: fileMCP || undefined,
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
      }
    );
  }

  private async handleGeneralAccessibilityTask(task: Task): Promise<TaskResult> {
    // For general tasks, do both test and implement if needed
    const testResult = await this.testAccessibility(task);
    
    if (testResult.success && testResult.data) {
      const data = testResult.data as any;
      const hasViolations = (data.violations || []).length > 0;
      
      if (hasViolations) {
        // Auto-implement fixes if violations found
        task.metadata = {
          ...task.metadata,
          htmlContent: task.metadata?.htmlContent,
          issuesToFix: data.violations.map((v: any) => v.issue || v).slice(0, 10),
        };
        return await this.implementAccessibility(task);
      }
    }
    
    return testResult;
  }

}

