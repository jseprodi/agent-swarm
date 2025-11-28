/**
 * Examples demonstrating different LLM provider configurations
 */

import { Swarm } from '../src/index.js';
import { OpenAIProvider } from '../src/llm/providers/OpenAIProvider.js';
import { AnthropicProvider } from '../src/llm/providers/AnthropicProvider.js';
import logger from '../src/utils/logger.js';

/**
 * Example 1: Using Cursor LLM (default)
 */
async function exampleCursorProvider() {
  logger.info('=== Example 1: Cursor Provider (Default) ===');
  
  const swarm = new Swarm({
    llmProvider: 'cursor', // This is the default
  });

  const result = await swarm.execute(
    'Explain what an LLM provider is in simple terms'
  );

  console.log('Result:', result);
  await swarm.cleanup();
}

/**
 * Example 2: Using OpenAI Provider
 */
async function exampleOpenAIProvider() {
  logger.info('=== Example 2: OpenAI Provider ===');
  
  const swarm = new Swarm({
    llmProvider: 'openai',
    llmConfig: {
      // API key can be set via OPENAI_API_KEY environment variable
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 1000,
    },
  });

  const result = await swarm.execute(
    'Generate a TypeScript function to calculate fibonacci numbers'
  );

  console.log('Result:', result);
  await swarm.cleanup();
}

/**
 * Example 3: Using Anthropic Provider
 */
async function exampleAnthropicProvider() {
  logger.info('=== Example 3: Anthropic Provider ===');
  
  const swarm = new Swarm({
    llmProvider: 'anthropic',
    llmConfig: {
      // API key can be set via ANTHROPIC_API_KEY environment variable
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4096,
    },
  });

  const result = await swarm.execute(
    'Write a comprehensive README for a Node.js project'
  );

  console.log('Result:', result);
  await swarm.cleanup();
}

/**
 * Example 4: Using a Custom Provider Instance
 */
async function exampleCustomProvider() {
  logger.info('=== Example 4: Custom Provider Instance ===');
  
  // Create provider instance directly
  const openAIProvider = new OpenAIProvider({
    model: 'gpt-3.5-turbo',
    temperature: 0.5,
  });

  const swarm = new Swarm({
    llmProvider: openAIProvider, // Pass the instance directly
  });

  const result = await swarm.execute(
    'Create a simple hello world function in Python'
  );

  console.log('Result:', result);
  await swarm.cleanup();
}

/**
 * Example 5: Checking Provider Availability
 */
async function exampleProviderAvailability() {
  logger.info('=== Example 5: Provider Availability Check ===');
  
  const swarm = new Swarm({
    llmProvider: 'openai',
  });

  const provider = swarm.getLLMProvider();
  console.log(`Provider: ${provider.getName()}`);
  console.log(`Available: ${provider.isAvailable()}`);

  if (!provider.isAvailable()) {
    console.log('Warning: Provider is not available. Check your API keys.');
  }

  await swarm.cleanup();
}

/**
 * Example 6: Switching Providers Dynamically
 */
async function exampleSwitchingProviders() {
  logger.info('=== Example 6: Using Different Providers for Different Tasks ===');
  
  // Task 1 with OpenAI
  const swarmOpenAI = new Swarm({
    llmProvider: 'openai',
    llmConfig: { model: 'gpt-4-turbo-preview' },
  });

  const result1 = await swarmOpenAI.execute(
    'Generate code with detailed comments'
  );
  console.log('OpenAI Result:', result1.success);
  await swarmOpenAI.cleanup();

  // Task 2 with Anthropic
  const swarmAnthropic = new Swarm({
    llmProvider: 'anthropic',
    llmConfig: { model: 'claude-3-5-sonnet-20241022' },
  });

  const result2 = await swarmAnthropic.execute(
    'Write comprehensive documentation'
  );
  console.log('Anthropic Result:', result2.success);
  await swarmAnthropic.cleanup();
}

// Run examples (comment out the ones you don't want to run)
async function main() {
  try {
    // Uncomment the example you want to run:
    // await exampleCursorProvider();
    // await exampleOpenAIProvider();
    // await exampleAnthropicProvider();
    // await exampleCustomProvider();
    // await exampleProviderAvailability();
    // await exampleSwitchingProviders();
    
    logger.info('All examples completed');
  } catch (error) {
    logger.error('Error in examples:', error);
  }
}

main().catch(console.error);

