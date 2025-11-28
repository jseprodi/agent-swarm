/**
 * Stylesheet Agent - generates, analyzes, and optimizes CSS/SCSS
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';

export class StylesheetAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'stylesheet-agent',
      'Stylesheet Agent',
      'Generates, analyzes, and optimizes CSS/SCSS stylesheets with responsive design and conflict resolution',
      ['stylesheet_generation', 'stylesheet_analysis', 'file_operations'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`StylesheetAgent executing task: ${task.id} - ${task.description}`);

    try {
      // Check if LLM is available
      if (!this.llm.isAvailable()) {
        return this.createFailureResult(task.id, 'LLM provider is not available');
      }

      const taskType = this.determineTaskType(task);
      
      switch (taskType) {
        case 'generate':
          return await this.generateStylesheet(task);
        case 'analyze':
          return await this.analyzeStylesheet(task);
        case 'optimize':
          return await this.optimizeStylesheet(task);
        default:
          return await this.handleGeneralStylesheetTask(task);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`StylesheetAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private determineTaskType(task: Task): 'generate' | 'analyze' | 'optimize' | 'general' {
    const description = task.description.toLowerCase();
    
    if (description.includes('generate') || description.includes('create') || description.includes('write')) {
      return 'generate';
    }
    if (description.includes('analyze') || description.includes('audit') || description.includes('check')) {
      return 'analyze';
    }
    if (description.includes('optimize') || description.includes('minify') || description.includes('improve')) {
      return 'optimize';
    }
    
    return 'general';
  }

  private async generateStylesheet(task: Task): Promise<TaskResult> {
    const designSpec = task.metadata?.designSpec as string | undefined;
    const targetFile = task.metadata?.targetFile as string | undefined;
    const framework = task.metadata?.framework as string | undefined;

    const prompt = `You are a CSS/SCSS expert. Generate a stylesheet based on the following requirements:

Task: ${task.description}
${designSpec ? `Design Specification: ${designSpec}` : ''}
${framework ? `Framework/Preprocessor: ${framework}` : ''}

Please provide:
1. Complete, production-ready CSS/SCSS code
2. Responsive design with mobile-first approach
3. Modern CSS features (Grid, Flexbox, CSS Variables)
4. Proper organization and comments
5. Browser compatibility considerations

Format your response with code blocks and clear explanations.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.3,
    });

    const stylesheet = this.extractCSS(llmResponse.content);
    const explanations = this.extractExplanation(llmResponse.content);

    // Try to use MCP server for file operations if available
    const fileMCP = this.findFileOperationMCP();
    if (fileMCP && targetFile) {
      try {
        const client = this.getMCPClient(fileMCP);
        if (client) {
          await client.callTool('write_file', {
            path: targetFile,
            content: stylesheet,
          });
          logger.info(`Wrote stylesheet to ${targetFile} via MCP server`);
        }
      } catch (error) {
        logger.warn(`Failed to write file via MCP: ${error}`);
      }
    }

    return this.createSuccessResult(
      task.id,
      {
        stylesheet,
        explanations,
        language: this.detectStylesheetType(stylesheet),
        targetFile: targetFile || 'generated.css',
        mcpServerUsed: fileMCP || undefined,
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
      }
    );
  }

  private async analyzeStylesheet(task: Task): Promise<TaskResult> {
    const stylesheetContent = task.metadata?.stylesheetContent as string | undefined;
    const stylesheetPath = task.metadata?.stylesheetPath as string | undefined;

    let cssContent = stylesheetContent;

    // Try to read file if path provided
    if (!cssContent && stylesheetPath) {
      const fileMCP = this.findFileOperationMCP();
      if (fileMCP) {
        try {
          const client = this.getMCPClient(fileMCP);
          if (client) {
            const fileContent = await client.callTool('read_file', {
              path: stylesheetPath,
            });
            cssContent = typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent);
          }
        } catch (error) {
          logger.warn(`Failed to read file via MCP: ${error}`);
        }
      }
    }

    if (!cssContent) {
      return this.createFailureResult(
        task.id,
        'No stylesheet content or path provided for analysis'
      );
    }

    const prompt = `Analyze the following CSS/SCSS stylesheet and identify issues:

Task: ${task.description}

Stylesheet:
\`\`\`css
${cssContent.substring(0, 5000)}
\`\`\`

Please analyze and provide:
1. Style conflicts or specificity issues
2. Unused or redundant styles
3. Performance issues (unoptimized selectors, missing vendor prefixes)
4. Browser compatibility issues
5. Responsive design problems
6. Best practice violations
7. Recommendations for improvement

Format as a structured analysis report.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.2,
    });

    const analysis = this.parseAnalysis(llmResponse.content);

    return this.createSuccessResult(
      task.id,
      {
        analysis,
        issues: analysis.issues || [],
        recommendations: analysis.recommendations || [],
        conflicts: analysis.conflicts || [],
        unusedStyles: analysis.unusedStyles || [],
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
      }
    );
  }

  private async optimizeStylesheet(task: Task): Promise<TaskResult> {
    // Similar to analyze but with optimization focus
    const analyzeResult = await this.analyzeStylesheet(task);
    
    if (!analyzeResult.success || !analyzeResult.data) {
      return analyzeResult;
    }

    const data = analyzeResult.data as any;
    const stylesheetContent = task.metadata?.stylesheetContent as string | undefined;

    if (!stylesheetContent) {
      return this.createFailureResult(task.id, 'Stylesheet content required for optimization');
    }

    const prompt = `Optimize the following CSS/SCSS based on the analysis:

Original Stylesheet:
\`\`\`css
${stylesheetContent.substring(0, 5000)}
\`\`\`

Analysis Issues: ${JSON.stringify(data.issues || [])}

Please provide an optimized version that:
1. Resolves all identified issues
2. Removes unused styles
3. Minimizes specificity conflicts
4. Adds vendor prefixes where needed
5. Improves performance
6. Maintains functionality

Provide the optimized CSS/SCSS code.`;

    const llmResponse = await this.llm.requestCompletion({
      prompt,
      temperature: 0.2,
    });

    const optimizedCSS = this.extractCSS(llmResponse.content);

    return this.createSuccessResult(
      task.id,
      {
        ...data,
        optimizedStylesheet: optimizedCSS,
        improvements: this.calculateImprovements(stylesheetContent, optimizedCSS),
      },
      {
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens,
      }
    );
  }

  private async handleGeneralStylesheetTask(task: Task): Promise<TaskResult> {
    // Fallback for general stylesheet tasks
    return await this.generateStylesheet(task);
  }

  private extractCSS(content: string): string {
    const cssBlockRegex = /```(?:css|scss)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(cssBlockRegex)];
    
    if (matches.length > 0) {
      return matches.map(m => m[1]).join('\n\n');
    }

    // Try to extract CSS-like content
    const cssLikeMatch = content.match(/\{[^}]*:[^}]*\}/g);
    if (cssLikeMatch) {
      return cssLikeMatch.join('\n');
    }

    return content;
  }

  private extractExplanation(content: string): string {
    const codeBlockRegex = /```[\s\S]*?```/g;
    return content.replace(codeBlockRegex, '').trim();
  }

  private detectStylesheetType(stylesheet: string): string {
    if (stylesheet.includes('@import') || stylesheet.includes('$') || stylesheet.includes('@mixin')) {
      return 'scss';
    }
    if (stylesheet.includes('@variables') || stylesheet.includes('@import')) {
      return 'less';
    }
    return 'css';
  }

  private parseAnalysis(content: string): any {
    try {
      // Try to parse structured JSON from LLM response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse analysis as JSON', error);
    }

    // Fallback: extract information from text
    return {
      issues: this.extractIssues(content),
      recommendations: this.extractRecommendations(content),
      conflicts: this.extractConflicts(content),
      unusedStyles: this.extractUnusedStyles(content),
    };
  }

  private extractIssues(content: string): string[] {
    const issues: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes('issue') || line.toLowerCase().includes('problem')) {
        issues.push(line.trim());
      }
    }
    
    return issues;
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('should')) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations;
  }

  private extractConflicts(content: string): string[] {
    const conflicts: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes('conflict') || line.toLowerCase().includes('override')) {
        conflicts.push(line.trim());
      }
    }
    
    return conflicts;
  }

  private extractUnusedStyles(content: string): string[] {
    const unused: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes('unused') || line.toLowerCase().includes('dead code')) {
        unused.push(line.trim());
      }
    }
    
    return unused;
  }

  private calculateImprovements(original: string, optimized: string): {
    sizeReduction: number;
    selectorCount: number;
    ruleCount: number;
  } {
    const originalSize = original.length;
    const optimizedSize = optimized.length;
    const sizeReduction = ((originalSize - optimizedSize) / originalSize) * 100;

    const originalSelectors = (original.match(/[^{}]+(?=\s*\{)/g) || []).length;
    const optimizedSelectors = (optimized.match(/[^{}]+(?=\s*\{)/g) || []).length;

    const originalRules = (original.match(/\{[^}]+\}/g) || []).length;
    const optimizedRules = (optimized.match(/\{[^}]+\}/g) || []).length;

    return {
      sizeReduction: Math.max(0, sizeReduction),
      selectorCount: optimizedSelectors - originalSelectors,
      ruleCount: optimizedRules - originalRules,
    };
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

