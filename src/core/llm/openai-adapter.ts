/**
 * OpenAI-compatible chat completions adapter with SSE streaming.
 *
 * Works with: OpenAI, Groq, OpenRouter, Cerebras, Mistral, and any
 * provider exposing a /chat/completions endpoint.
 */

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function executeOpenAICompatibleRequest(
  messages: OpenAIMessage[],
  systemPrompt: string,
  baseUrl: string,
  apiKey: string,
  modelId: string,
  onTokenStream?: (accumulatedText: string) => void,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const allMessages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const body: Record<string, unknown> = {
    model: modelId,
    messages: allMessages,
    stream: !!onTokenStream,
    temperature: 0.7,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(extraHeaders || {}),
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `OpenAI-compatible HTTP ${response.status}: ${response.statusText} – ${errorBody}`
    );
  }

  // ── Non-streaming path ──
  if (!onTokenStream || !response.body) {
    const json = await response.json();
    return json.choices?.[0]?.message?.content || '';
  }

  // ── SSE streaming path ──
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
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
        // Ignore partial JSON from chunked SSE delivery
      }
    }
  }

  return fullText;
}
