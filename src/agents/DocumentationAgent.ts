/**
 * Documentation Agent - generates README, API docs, comments
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';

export class DocumentationAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'documentation-agent',
      'Documentation Agent',
      'Generates README files, API documentation, and code comments using available tools and MCP servers',
      ['documentation', 'file_operations'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`DocumentationAgent executing task: ${task.id} - ${task.description}`);

    try {
      // Check if LLM is available
      if (!this.llm.isAvailable()) {
        return this.createFailureResult(task.id, 'LLM provider is not available');
      }

      // Determine documentation type from task
      const docType = this.determineDocumentationType(task);

      // Build documentation generation prompt
      const docPrompt = this.buildDocumentationPrompt(task, docType);
      
      const llmResponse = await this.llm.requestCompletion({
        prompt: docPrompt,
        temperature: 0.3,
      });

      const documentation = llmResponse.content;
      const formattedDoc = this.formatDocumentation(documentation, docType);

      return this.createSuccessResult(
        task.id,
        {
          documentation: formattedDoc,
          docType,
          format: this.detectFormat(formattedDoc),
        },
        {
          promptTokens: llmResponse.usage?.promptTokens,
          completionTokens: llmResponse.usage?.completionTokens,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`DocumentationAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private determineDocumentationType(task: Task): string {
    const description = task.description.toLowerCase();
    
    if (description.includes('readme')) return 'readme';
    if (description.includes('api') || description.includes('endpoint')) return 'api';
    if (description.includes('comment') || description.includes('inline')) return 'comments';
    if (description.includes('guide') || description.includes('tutorial')) return 'guide';
    
    // Check metadata
    const docType = task.metadata?.docType as string;
    if (docType) return docType;

    return 'readme'; // Default
  }

  private buildDocumentationPrompt(task: Task, docType: string): string {
    const codeContext = task.metadata?.codeContext as string | undefined;
    const apiContext = task.metadata?.apiContext as unknown;

    let contextSection = '';
    
    if (codeContext) {
      contextSection = `Code to document:\n\`\`\`\n${codeContext}\n\`\`\`\n`;
    } else if (apiContext) {
      contextSection = `API to document:\n${JSON.stringify(apiContext, null, 2)}\n`;
    }

    const prompts: Record<string, string> = {
      readme: `You are a documentation generation agent. Generate a comprehensive README.md file:

Task: ${task.description}

${contextSection}

Include:
1. Project title and description
2. Installation instructions
3. Usage examples
4. Configuration options
5. Contributing guidelines (if applicable)

Format as valid Markdown.`,
      
      api: `You are a documentation generation agent. Generate API documentation:

Task: ${task.description}

${contextSection}

Include:
1. Endpoint descriptions
2. Request/response formats
3. Authentication requirements
4. Example requests and responses
5. Error codes

Format as clear, structured documentation.`,
      
      comments: `You are a documentation generation agent. Generate inline code comments:

Task: ${task.description}

${contextSection}

Add:
1. Function/class-level docstrings
2. Parameter descriptions
3. Return value descriptions
4. Usage examples if applicable
5. Edge cases or important notes

Follow standard documentation conventions for the code language.`,
      
      guide: `You are a documentation generation agent. Generate a comprehensive guide:

Task: ${task.description}

${contextSection}

Include:
1. Overview and purpose
2. Step-by-step instructions
3. Examples and code snippets
4. Common pitfalls and solutions
5. Best practices

Format as clear, instructional documentation.`,
    };

    return prompts[docType] || prompts.readme;
  }

  private formatDocumentation(doc: string, docType: string): string {
    // Remove any extra markdown formatting that might be in the LLM response
    // For comments, ensure proper formatting
    if (docType === 'comments') {
      // Ensure comments are properly formatted
      return doc;
    }

    // For markdown documents, ensure proper structure
    if (docType === 'readme' || docType === 'guide') {
      // Ensure it starts with a title if it doesn't
      if (!doc.startsWith('#')) {
        return `# ${docType === 'readme' ? 'README' : 'Guide'}\n\n${doc}`;
      }
    }

    return doc.trim();
  }

  private detectFormat(doc: string): string {
    if (doc.includes('# ') || doc.includes('## ')) return 'markdown';
    if (doc.includes('/**') || doc.includes('///')) return 'code-comments';
    if (doc.includes('<html>') || doc.includes('<!DOCTYPE')) return 'html';
    if (doc.includes('{"')) return 'json';
    return 'text';
  }
}

