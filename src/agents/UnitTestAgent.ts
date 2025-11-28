/**
 * Unit Test Agent - specializes in unit test generation and analysis
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import logger from '../utils/logger.js';

export class UnitTestAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'unit-test-agent',
      'Unit Test Agent',
      'Specializes in unit test generation, test analysis, and test coverage using available tools and MCP servers',
      ['unit_test_generation', 'test_analysis', 'test_coverage'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`UnitTestAgent executing task: ${task.id} - ${task.description}`);

    try {
      // Build unit test generation prompt
      const unitTestPrompt = this.buildUnitTestPrompt(task);
      
      const llmResponse = await this.llm.requestCompletion({
        prompt: unitTestPrompt,
        temperature: 0.2, // Lower temperature for more consistent test code
      });

      // Extract test code
      const testCode = this.extractCode(llmResponse.content);
      const testExplanation = this.extractExplanation(llmResponse.content);
      const testFramework = this.detectTestFramework(testCode);
      const testCount = this.countUnitTests(testCode);
      const testableUnits = this.identifyTestableUnits(task);

      return this.createSuccessResult(
        task.id,
        {
          testCode,
          testExplanation,
          testFramework,
          testCount,
          testableUnits,
        },
        {
          promptTokens: llmResponse.usage?.promptTokens,
          completionTokens: llmResponse.usage?.completionTokens,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`UnitTestAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  private buildUnitTestPrompt(task: Task): string {
    const codeContext = task.metadata?.codeContext as string | undefined;
    const testFramework = (task.metadata?.testFramework as string) || undefined;

    return `You are a unit test generation specialist. Generate unit tests (NOT integration tests) based on the following task:

Task: ${task.description}

${codeContext ? `Code to test:\n\`\`\`\n${codeContext}\n\`\`\`\n` : ''}
${testFramework ? `Test Framework: ${testFramework}` : ''}

Important: Focus on UNIT TESTS only - test individual functions, methods, or classes in isolation. Do not create integration tests that test multiple components together.

Please provide:
1. Comprehensive unit test cases covering individual units of functionality
2. Test setup and teardown for isolated testing
3. Mock/stub usage where appropriate for isolation
4. A brief explanation of the unit test strategy

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
    // Detect test framework from test code patterns
    if (testCode.includes('describe(') && testCode.includes('it(') && testCode.includes('expect(')) {
      return 'jest';
    }
    if (testCode.includes('test(') && testCode.includes('expect(') && !testCode.includes('describe(')) {
      return 'vitest';
    }
    if (testCode.includes('def test_') && testCode.includes('assert')) {
      return 'pytest';
    }
    if (testCode.includes('@Test') || testCode.includes('Assert.assertEquals')) {
      return 'junit';
    }
    if (testCode.includes('describe(') && testCode.includes('beforeEach') && !testCode.includes('expect(')) {
      return 'mocha';
    }
    if (testCode.includes('[Test]') || testCode.includes('Assert.')) {
      return 'nunit';
    }
    if (testCode.includes('test(') && testCode.includes('assert_eq!')) {
      return 'rust';
    }
    return 'unknown';
  }

  private countUnitTests(testCode: string): number {
    // Count unit test cases by common patterns
    const jestPattern = /(it\(|test\()/g;
    const pytestPattern = /def test_/g;
    const junitPattern = /@Test/g;
    const mochaPattern = /it\(/g;
    const nunitPattern = /\[Test\]/g;
    const rustPattern = /#\[test\]/g;

    const matches =
      testCode.match(jestPattern)?.length ||
      testCode.match(pytestPattern)?.length ||
      testCode.match(junitPattern)?.length ||
      testCode.match(mochaPattern)?.length ||
      testCode.match(nunitPattern)?.length ||
      testCode.match(rustPattern)?.length ||
      0;

    return matches;
  }

  private identifyTestableUnits(task: Task): string[] {
    // Identify testable units from task description and code context
    const codeContext = task.metadata?.codeContext as string | undefined;
    const units: string[] = [];

    if (codeContext) {
      // Extract function names
      const functionMatches = codeContext.match(/(?:function|const|let|var)\s+(\w+)\s*[=:]/g);
      if (functionMatches) {
        functionMatches.forEach(match => {
          const nameMatch = match.match(/(\w+)\s*[=:]/);
          if (nameMatch && nameMatch[1]) {
            units.push(nameMatch[1]);
          }
        });
      }

      // Extract class methods
      const methodMatches = codeContext.match(/(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/g);
      if (methodMatches) {
        methodMatches.forEach(match => {
          const nameMatch = match.match(/(\w+)\s*\(/);
          if (nameMatch && nameMatch[1] && !['if', 'for', 'while', 'switch', 'catch'].includes(nameMatch[1])) {
            units.push(nameMatch[1]);
          }
        });
      }
    }

    // Extract from description if no code context
    if (units.length === 0 && task.description) {
      const descMatches = task.description.match(/(?:function|method|class)\s+(\w+)/gi);
      if (descMatches) {
        descMatches.forEach(match => {
          const nameMatch = match.match(/(\w+)$/i);
          if (nameMatch) {
            units.push(nameMatch[1]);
          }
        });
      }
    }

    return units.length > 0 ? units : ['unknown'];
  }
}

