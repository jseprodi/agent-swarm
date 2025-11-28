/**
 * @deprecated This class is deprecated. Use the new LLM provider system instead.
 * Import from '../llm/providers/CursorLLMProvider' or use the Swarm config to select a provider.
 * 
 * This file is kept for backward compatibility but will be removed in a future version.
 */

import { CursorLLMProvider } from '../llm/providers/CursorLLMProvider.js';
import { BaseLLMProvider } from '../llm/BaseLLMProvider.js';
import type { LLMRequest, LLMResponse } from '../llm/types.js';

/**
 * @deprecated Use CursorLLMProvider instead
 */
export class LLMIntegration extends BaseLLMProvider {
  private provider: CursorLLMProvider;

  constructor() {
    super();
    this.provider = new CursorLLMProvider();
  }

  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    return this.provider.requestCompletion(request);
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  getName(): string {
    return this.provider.getName();
  }
}

// Re-export types for backward compatibility
export type { LLMRequest, LLMResponse } from '../llm/types.js';
