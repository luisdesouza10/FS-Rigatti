import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../../config/env';

export type MessageParam = Anthropic.Beta.BetaMessageParam;
export type ToolDefinition = Anthropic.Beta.BetaTool;
export type AssistantMessage = Anthropic.Beta.BetaMessage;
export type ToolUseBlock = Anthropic.Beta.BetaToolUseBlock;
export type ToolResultBlock = Anthropic.Beta.BetaToolResultBlockParam;
export type TextBlock = Anthropic.Beta.BetaTextBlockParam;

export interface LLMTurnRequest {
  system: string;
  messages: MessageParam[];
  tools: ToolDefinition[];
}

export interface LLMTurnOptions {
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

export interface LLMClient {
  streamTurn(request: LLMTurnRequest, options: LLMTurnOptions): Promise<AssistantMessage>;
}

export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic | null = null;

  /** Lazy so the API starts without credentials; only the chat fails. */
  private getClient(): Anthropic {
    this.client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
    return this.client;
  }

  async streamTurn({ system, messages, tools }: LLMTurnRequest, { onText, signal }: LLMTurnOptions) {
    const stream = this.getClient().beta.messages.stream(
      {
        model: env.ANTHROPIC_MODEL,
        max_tokens: 16_000,
        system,
        messages,
        tools,
        thinking: { type: 'adaptive' },
        output_config: { effort: env.AGENT_EFFORT },
        // On a safety refusal, the API retries on a fallback model within the same request.
        ...(env.AGENT_REFUSAL_FALLBACK && {
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default' as const,
        }),
      },
      { signal },
    );

    stream.on('text', onText);
    return stream.finalMessage();
  }
}
