/**
 * Basic usage example for Agent Swarm
 */

import { Swarm } from '../src/index.js';
import logger from '../src/utils/logger.js';

async function main() {
  // Initialize the swarm
  const swarm = new Swarm({
    enableHealthChecks: true,
    logLevel: 'info',
  });

  try {
    // Example 1: Simple code generation task
    logger.info('=== Example 1: Code Generation ===');
    const codeResult = await swarm.execute(
      'Generate a TypeScript function that calculates the factorial of a number'
    );

    if (codeResult.success) {
      logger.info('Code generation successful!');
      console.log('Generated code:', codeResult.data);
    } else {
      logger.error('Code generation failed:', codeResult.error);
    }

    // Example 2: Test generation task
    logger.info('\n=== Example 2: Test Generation ===');
    const testResult = await swarm.execute(
      'Generate unit tests for a factorial function',
      {
        codeContext: `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}`,
        testType: 'unit',
      }
    );

    if (testResult.success) {
      logger.info('Test generation successful!');
      console.log('Generated tests:', testResult.data);
    } else {
      logger.error('Test generation failed:', testResult.error);
    }

    // Example 3: Documentation generation task
    logger.info('\n=== Example 3: Documentation Generation ===');
    const docResult = await swarm.execute(
      'Generate a README.md file for a factorial calculator project',
      {
        docType: 'readme',
      }
    );

    if (docResult.success) {
      logger.info('Documentation generation successful!');
      console.log('Generated documentation:', docResult.data);
    } else {
      logger.error('Documentation generation failed:', docResult.error);
    }

    // Example 4: Complex task that requires multiple agents
    logger.info('\n=== Example 4: Complex Multi-Agent Task ===');
    const complexResult = await swarm.execute(
      'Create a complete utility library with a factorial function, unit tests, and documentation',
      {
        libraryName: 'math-utils',
        functions: ['factorial', 'fibonacci', 'power'],
      }
    );

    if (complexResult.success) {
      logger.info('Complex task completed successfully!');
      console.log('Task results:', complexResult.data);
    } else {
      logger.error('Complex task failed:', complexResult.error);
    }

    // Example 5: Task requiring MCP server discovery
    logger.info('\n=== Example 5: Task with MCP Discovery ===');
    const mcpResult = await swarm.execute(
      'Read a file, analyze its contents, and generate a summary using file operations',
      {
        filePath: 'example.txt',
      }
    );

    if (mcpResult.success) {
      logger.info('MCP-enabled task completed!');
      console.log('MCP servers used:', mcpResult.mcpServersUsed);
    } else {
      logger.error('MCP-enabled task failed:', mcpResult.error);
    }

    // Display statistics
    const stats = swarm.getTaskManager().getStatistics();
    logger.info('\n=== Task Statistics ===');
    console.log('Total tasks:', stats.total);
    console.log('Completed:', stats.completed);
    console.log('Failed:', stats.failed);
    console.log('In progress:', stats.inProgress);
    console.log('Pending:', stats.pending);
  } catch (error) {
    logger.error('Error in example:', error);
  } finally {
    // Cleanup
    await swarm.cleanup();
  }
}

// Run the example
main().catch(console.error);

