import type { AiProvider, AiProviderPreset } from './aiConfigService.js';
import {
  checkTokenBudget,
  logAiUsage,
  type AiUsageFeature,
} from './usageLogService.js';

export type AiGatewayFeature = AiUsageFeature | 'connection_test';

export interface AiChatMessage {
  role: 'user' | 'system' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

export interface AiGatewayRequest {
  userId: number;
  feature: AiGatewayFeature;
  preset: AiProviderPreset;
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
  max_tokens?: number;
  skipBudgetCheck?: boolean;
  skipUsageLog?: boolean;
}

export interface AiGatewayResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

function parseApiErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed.error?.message ?? parsed.message ?? raw;
  } catch {
    return raw;
  }
}

export async function completeChat(request: AiGatewayRequest): Promise<AiGatewayResponse> {
  const apiKey = request.apiKey.trim();
  if (!apiKey) {
    throw new Error('未配置 API Key');
  }

  if (!request.skipBudgetCheck && request.feature !== 'connection_test') {
    checkTokenBudget(request.userId);
  }

  const url = `${request.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      temperature: request.temperature ?? 0,
      max_tokens: request.max_tokens,
      messages: request.messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    const detail = parseApiErrorMessage(err);
    throw new Error(detail.slice(0, 300) || `HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      total_tokens?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  };

  const usage = data.usage;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;

  if (
    !request.skipUsageLog &&
    request.feature !== 'connection_test' &&
    (promptTokens > 0 || completionTokens > 0)
  ) {
    logAiUsage({
      userId: request.userId,
      provider: request.preset,
      model: request.model,
      feature: request.feature,
      promptTokens,
      completionTokens,
    });
  }

  return {
    content: data.choices?.[0]?.message?.content?.trim() ?? '',
    promptTokens,
    completionTokens,
    totalTokens,
  };
}
