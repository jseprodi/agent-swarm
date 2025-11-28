/**
 * LLM provider types and interfaces
 */

export interface LLMRequest {
  prompt: string;
  context?: string[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model?: string;
}

/**
 * Abstract interface for LLM providers
 */
export interface ILLMProvider {
  /**
   * Request a completion from the LLM
   */
  requestCompletion(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Check if the provider is available/configured
   */
  isAvailable(): boolean;

  /**
   * Get the provider name
   */
  getName(): string;
}

export interface LLMProviderConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

