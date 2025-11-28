/**
 * Test Agent - writes unit tests and integration tests
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';

export class TestAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'test-agent',
      'Test Agent',
      'Writes unit tests, integration tests, and test fixtures using available tools and MCP servers',
      ['test_generation', 'code_analysis'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`TestAgent executing task: ${task.id} - ${task.description}`);

    try {
      // Check if LLM is available
      if (!this.llm.isAvailable()) {
        return this.createFailureResult(task.id, 'LLM provider is not available');
      }

      // Build test generation prompt
      const testPrompt = this.buildTestGenerationPrompt(task);
      
      const llmResponse = await this.llm.requestCompletion({
        prompt: testPrompt,
        temperature: 0.2, // Lower temperature for more consistent test code
      });

      // Extract test code
      const testCode = this.extractCode(llmResponse.content);
      const testExplanation = this.extractExplanation(llmResponse.content);
      const testFramework = this.detectTestFramework(testCode);

      return this.createSuccessResult(
        task.id,
        {
          testCode,
          testExplanation,
          testFramework,
          testCount: this.countTests(testCode),
        },
        {
          promptTokens: llmResponse.usage?.promptTokens,
          completionTokens: llmResponse.usage?.completionTokens,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`TestAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private buildTestGenerationPrompt(task: Task): string {
    const codeContext = task.metadata?.codeContext as string | undefined;
    const testType = (task.metadata?.testType as string) || 'unit';

    return `You are a test generation agent. Generate ${testType} tests based on the following task:

Task: ${task.description}

${codeContext ? `Code to test:\n\`\`\`\n${codeContext}\n\`\`\`\n` : ''}

Please provide:
1. Comprehensive test cases covering the functionality
2. Test setup and teardown if needed
3. A brief explanation of the test strategy

Format your response with code blocks and clear explanations.`;
  }

  private extractCode(content: string): string {
    // Extract code from markdown code blocks
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
      return matches.map(m => m[1]).join('\n\n');
    }

    return content;
  }

  private extractExplanation(content: string): string {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const textWithoutCode = content.replace(codeBlockRegex, '').trim();
    return textWithoutCode || 'No explanation provided';
  }

  private detectTestFramework(testCode: string): string {
    if (testCode.includes('describe(') && testCode.includes('it(')) return 'jest';
    if (testCode.includes('test(') && testCode.includes('expect(')) return 'jest';
    if (testCode.includes('def test_')) return 'pytest';
    if (testCode.includes('@Test') || testCode.includes('Assert.assertEquals')) return 'junit';
    if (testCode.includes('describe(') && testCode.includes('beforeEach')) return 'mocha';
    return 'unknown';
  }

  private countTests(testCode: string): number {
    // Count test cases by common patterns
    const jestPattern = /(it\(|test\()/g;
    const pytestPattern = /def test_/g;
    const junitPattern = /@Test/g;
    const mochaPattern = /it\(/g;

    const matches =
      testCode.match(jestPattern)?.length ||
      testCode.match(pytestPattern)?.length ||
      testCode.match(junitPattern)?.length ||
      testCode.match(mochaPattern)?.length ||
      0;

    return matches;
  }
}

