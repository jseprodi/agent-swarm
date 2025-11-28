/**
 * OpenAI LLM Provider
 */

import OpenAI from 'openai';
import { BaseLLMProvider } from '../BaseLLMProvider.js';
import type { LLMRequest, LLMResponse, LLMProviderConfig } from '../types.js';
import logger from '../../utils/logger.js';

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI | null = null;
  private config: LLMProviderConfig;
  private model: string;

  constructor(config: LLMProviderConfig = {}) {
    super();
    this.config = config;
    this.model = config.model || 'gpt-4-turbo-preview';

    if (config.apiKey || process.env.OPENAI_API_KEY) {
      try {
        this.client = new OpenAI({
          apiKey: config.apiKey || process.env.OPENAI_API_KEY,
          baseURL: config.baseURL,
          timeout: config.timeout || 60000,
        });
        logger.info('OpenAI provider initialized');
      } catch (error) {
        logger.error('Failed to initialize OpenAI client:', error);
      }
    } else {
      logger.warn('OpenAI API key not provided');
    }
  }

  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Provide OPENAI_API_KEY or apiKey in config.');
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      // Add system prompt if provided
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      // Add context if provided
      if (request.context && request.context.length > 0) {
        messages.push({
          role: 'system',
          content: `Context:\n${request.context.join('\n')}`,
        });
      }

      // Add user prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
      });

      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from OpenAI');
      }

      return {
        content: choice.message.content || '',
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
        model: completion.model,
      };
    } catch (error) {
      logger.error('Error requesting OpenAI completion:', error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  getName(): string {
    return 'OpenAI';
  }
}

