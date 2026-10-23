/**
 * Dual-mode action parser (critical pitfall #9).
 *
 * Models that support native tool_use return structured tool_calls.
 * Free-tier / smaller models emit hidden XML blocks instead:
 *   <coach_action>{"type":"upsert_memory_fact","payload":{...}}</coach_action>
 *
 * This parser handles BOTH modes transparently.
 */

export type CoachActionType =
  | 'upsert_memory_fact'
  | 'set_must_win'
  | 'create_task'
  | 'friction_break';

export interface CoachAction {
  type: CoachActionType;
  payload: Record<string, unknown>;
}

/** Regex to find all <coach_action>{...}</coach_action> blocks */
const ACTION_XML_RE =
  /<coach_action>\s*([\s\S]*?)\s*<\/coach_action>/gi;

/**
 * Parse actions from BOTH native tool_calls and XML blocks in text.
 *
 * @param responseText  Full assistant response text
 * @param nativeToolCalls  Optional tool_calls array from the API response
 * @returns Deduplicated array of CoachAction objects
 */
export function parseActions(
  responseText: string,
  nativeToolCalls?: Array<{
    function?: { name?: string; arguments?: string };
    name?: string;
    input?: Record<string, unknown>;
  }>
): CoachAction[] {
  const actions: CoachAction[] = [];

  // ── 1. Native tool_calls (Anthropic tool_use or OpenAI function_call) ──
  if (nativeToolCalls && nativeToolCalls.length > 0) {
    for (const call of nativeToolCalls) {
      try {
        // Anthropic style: { name, input }
        if (call.name && call.input) {
          actions.push({
            type: call.name as CoachActionType,
            payload: call.input,
          });
          continue;
        }

        // OpenAI style: { function: { name, arguments (JSON string) } }
        if (call.function?.name) {
          const payload = call.function.arguments
            ? JSON.parse(call.function.arguments)
            : {};
          actions.push({
            type: call.function.name as CoachActionType,
            payload,
          });
        }
      } catch (err) {
        console.warn('[action-parser] Failed to parse native tool_call:', err);
      }
    }
  }

  // ── 2. XML block fallback (free-tier models) ──
  let match: RegExpExecArray | null;
  // Reset lastIndex since we reuse the global regex
  ACTION_XML_RE.lastIndex = 0;
  while ((match = ACTION_XML_RE.exec(responseText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const actionType = (parsed.type || parsed.tool || parsed.name) as CoachActionType;
      const actionPayload = (parsed.payload || parsed.args || parsed.input || {}) as Record<string, unknown>;
      if (actionType) {
        actions.push({
          type: actionType,
          payload: actionPayload,
        });
      }
    } catch (err) {
      console.warn('[action-parser] Failed to parse XML action block:', err);
    }
  }

  return actions;
}

/**
 * Strip all <coach_action>...</coach_action> blocks from text
 * so the user sees clean output without raw JSON.
 */
export function stripActionBlocks(text: string): string {
  ACTION_XML_RE.lastIndex = 0;
  return text.replace(ACTION_XML_RE, '').trim();
}
