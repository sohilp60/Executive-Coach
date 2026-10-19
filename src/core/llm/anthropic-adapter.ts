/**
 * Anthropic API adapter for direct browser-side streaming.
 *
 * Key pitfall addressed:
 *   - "anthropic-dangerous-direct-browser-access": "true" is required
 *     because fetch() from the side panel hits CORS otherwise.
 *   - Streaming uses SSE with event: content_block_delta lines.
 */

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function executeAnthropicRequest(
  messages: AnthropicMessage[],
  systemPrompt: string,
  apiKey: string,
  modelId: string,
  onTokenStream?: (accumulatedText: string) => void
): Promise<string> {
  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    stream: !!onTokenStream,
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Anthropic HTTP ${response.status}: ${response.statusText} – ${errorBody}`
    );
  }

  // ── Non-streaming path ──
  if (!onTokenStream || !response.body) {
    const json = await response.json();
    // Anthropic returns content as an array of content blocks
    const textBlocks = (json.content || []).filter(
      (b: { type: string }) => b.type === 'text'
    );
    return textBlocks.map((b: { text: string }) => b.text).join('');
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
    // Keep the last potentially-incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6).trim();
      if (!dataStr || dataStr === '[DONE]') continue;

      try {
        const event = JSON.parse(dataStr);

        if (event.type === 'content_block_delta') {
          const delta = event.delta?.text || '';
          if (delta) {
            fullText += delta;
            onTokenStream(fullText);
          }
        }
        // message_stop is the final event – nothing to extract
      } catch {
        // Ignore partial JSON from chunked SSE delivery
      }
    }
  }

  return fullText;
}
