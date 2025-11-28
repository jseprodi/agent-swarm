/**
 * Anthropic (Claude) LLM Provider
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from '../BaseLLMProvider.js';
import type { LLMRequest, LLMResponse, LLMProviderConfig } from '../types.js';
import { DEFAULT_LLM_TIMEOUT_MS } from '../constants.js';
import logger from '../../utils/logger.js';

export class AnthropicProvider extends BaseLLMProvider {
  private client: Anthropic | null = null;
  private config: LLMProviderConfig;
  private model: string;

  constructor(config: LLMProviderConfig = {}) {
    super();
    this.config = config;
    this.model = config.model || 'claude-3-5-sonnet-20241022';

    if (config.apiKey || process.env.ANTHROPIC_API_KEY) {
      try {
        this.client = new Anthropic({
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          baseURL: config.baseURL,
          timeout: config.timeout || DEFAULT_LLM_TIMEOUT_MS,
        });
        logger.info('Anthropic provider initialized');
      } catch (error) {
        logger.error('Failed to initialize Anthropic client:', error);
      }
    } else {
      logger.warn('Anthropic API key not provided');
    }
  }

  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized. Provide ANTHROPIC_API_KEY or apiKey in config.');
    }

    try {
      const messages: Anthropic.MessageParam[] = [];

      // Add context if provided
      if (request.context && request.context.length > 0) {
        messages.push({
          role: 'user',
          content: `Context:\n${request.context.join('\n')}`,
        });
      }

      // Add user prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      const systemPrompt = request.systemPrompt;

      const completion = await this.client.messages.create({
        model: this.model,
        messages,
        system: systemPrompt,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      });

      const contentBlock = completion.content[0];
      if (!contentBlock || contentBlock.type !== 'text') {
        throw new Error('No text response from Anthropic');
      }

      return {
        content: contentBlock.text,
        usage: completion.usage ? {
          promptTokens: completion.usage.input_tokens,
          completionTokens: completion.usage.output_tokens,
          totalTokens: completion.usage.input_tokens + completion.usage.output_tokens,
        } : undefined,
        model: completion.model,
      };
    } catch (error) {
      logger.error('Error requesting Anthropic completion:', error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  getName(): string {
    return 'Anthropic';
  }
}

