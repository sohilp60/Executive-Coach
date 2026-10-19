import { LLMProviderConfig, RouterSettings } from '../../types/schema';
import { executeAnthropicRequest } from '../llm/anthropic-adapter';

export async function executeLLMRequest(
  messages: Array<{ role: string; content: string }>,
  settings: RouterSettings,
  providers: Record<string, LLMProviderConfig>,
  systemPrompt: string,
  onTokenStream?: (text: string) => void
): Promise<string> {
  const queue = [settings.primaryProviderId, ...settings.fallbackProviderIds].filter(Boolean);
  let lastError: Error | null = null;

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
        const anthropicMessages = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        return await executeAnthropicRequest(
          anthropicMessages,
          systemPrompt,
          cleanKey,
          cleanModel,
          onTokenStream
        );
      }

      if (provider.format === 'openai-compatible') {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`,
        };
        if (providerId === 'gemini') {
          headers['x-goog-api-key'] = cleanKey;
        }

        const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: cleanModel,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            stream: !!onTokenStream,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          let errDetails = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errData = await response.json();
            if (errData.error?.message) {
              errDetails = errData.error.message;
            }
          } catch {
            const t = await response.text().catch(() => '');
            if (t) errDetails += ` - ${t}`;
          }
          throw new Error(errDetails);
        }

        if (onTokenStream && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const json = JSON.parse(dataStr);
                  const delta = json.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    fullText += delta;
                    onTokenStream(fullText);
                  }
                } catch {
                  // ignore JSON parse errors on partial SSE chunks
                }
              }
            }
          }
          return fullText;
        } else {
          const json = await response.json();
          return json.choices?.[0]?.message?.content || '';
        }
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Provider ${providerId} failed:`, err.message);
      // Fall through to next provider in queue
    }
  }

  throw lastError || new Error('All LLM providers failed or rate-limited. Please check your provider settings.');
}