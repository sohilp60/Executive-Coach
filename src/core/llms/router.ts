import { LLMProviderConfig, RouterSettings } from '../../types/schema';
import { executeAnthropicRequest } from '../llm/anthropic-adapter';
import { executeOpenAICompatibleRequest } from '../llm/openai-adapter';
import { scrubPII } from '../privacy/pii-scrubber';

export async function executeLLMRequest(
  messages: Array<{ role: string; content: string }>,
  settings: RouterSettings,
  providers: Record<string, LLMProviderConfig>,
  systemPrompt: string,
  onTokenStream?: (text: string) => void
): Promise<string> {
  const queue = [settings.primaryProviderId, ...settings.fallbackProviderIds].filter(Boolean);
  let lastError: Error | null = null;

  // Apply strict work privacy PII scrubbing if enabled
  const effectiveSystemPrompt = settings.strictWorkPrivacyMode
    ? scrubPII(systemPrompt)
    : systemPrompt;

  const effectiveMessages = settings.strictWorkPrivacyMode
    ? messages.map((m) => ({ ...m, content: scrubPII(m.content) }))
    : messages;

  for (const providerId of queue) {
    const provider = providers[providerId];
    if (!provider) continue;

    const isLocal = provider.baseUrl?.includes('localhost') || provider.baseUrl?.includes('127.0.0.1');
    if (!provider.apiKey?.trim() && !isLocal) continue;

    const cleanKey = provider.apiKey?.trim() || (isLocal ? 'ollama' : '');
    const cleanModel = provider.modelId.trim();
    const cleanBaseUrl = provider.baseUrl.trim().replace(/\/+$/, '');

    try {
      if (provider.format === 'anthropic-native') {
        const anthropicMessages = effectiveMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        return await executeAnthropicRequest(
          anthropicMessages,
          effectiveSystemPrompt,
          cleanKey,
          cleanModel,
          onTokenStream
        );
      }

      if (provider.format === 'openai-compatible') {
        const extraHeaders: Record<string, string> = {};
        if (providerId === 'gemini') {
          extraHeaders['x-goog-api-key'] = cleanKey;
        }

        const openAIMessages = effectiveMessages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        }));

        return await executeOpenAICompatibleRequest(
          openAIMessages,
          effectiveSystemPrompt,
          cleanBaseUrl,
          cleanKey,
          cleanModel,
          onTokenStream,
          extraHeaders
        );
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[LLMRouter] Provider ${providerId} (${provider.name}) failed:`, err.message);
      // Fall through to next provider in queue
    }
  }

  throw lastError || new Error('All configured LLM providers failed or are unconfigured. Please check Settings → LLM Providers.');
}