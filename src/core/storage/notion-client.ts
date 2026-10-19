/**
 * Notion API client for fetching tasks from a Notion database.
 *
 * Important: This runs inside the SERVICE WORKER, not the side panel.
 * The side panel should send a chrome.runtime.sendMessage to the SW
 * which calls these functions (pitfall #6 — CORS with Notion API).
 */

import type { NotionTask } from '../../types/schema';

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
  notionProxyUrl?: string;
  proxyUrl?: string;
}

/**
 * Universal Notion API transport relay.
 * When proxyUrl is provided (e.g. Google Apps Script Web App), routes all requests through it
 * using 'Content-Type': 'text/plain;charset=UTF-8' to prevent browser CORS preflight checks,
 * completely bypassing corporate firewall blocks on api.notion.com.
 */
export async function callNotionApi(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  token: string,
  proxyUrl?: string,
  body?: any
): Promise<any> {
  const cleanToken = cleanNotionApiKey(token);
  const trimmedProxy = proxyUrl?.trim() || '';

  // Normalized endpoint ensuring leading slash, e.g. /databases/... or /pages
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (trimmedProxy) {
    const res = await fetch(trimmedProxy, {
      method: 'POST',
      headers: {
        // CRITICAL: Using text/plain prevents browser CORS preflight (OPTIONS) check
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify({
        endpoint: normalizedEndpoint,
        method,
        token: cleanToken,
        body,
      }),
    });

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Invalid response from proxy relay: ${text}`);
    }

    if (!res.ok || json.object === 'error') {
      throw new Error(json.message || `Notion API Error via Proxy (${res.status})`);
    }

    return json;
  }

  // Fallback to direct Notion API if no proxyUrl is configured
  const directUrl = endpoint.startsWith('http')
    ? endpoint
    : `https://api.notion.com/v1${normalizedEndpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cleanToken}`,
    'Notion-Version': '2022-06-28',
  };
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(directUrl, {
    method,
    headers,
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from Notion API: ${text}`);
  }

  if (!res.ok || json.object === 'error') {
    throw new Error(json.message || `Notion API Error (${res.status})`);
  }

  return json;
}

/**
 * Normalizes an API key, removing accidental 'Bearer ' prefixes, whitespace, and wrapping quotes.
 */
export function cleanNotionApiKey(rawKey: string): string {
  if (!rawKey) return '';
  return rawKey
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '');
}

/**
 * Extracts a clean 32-character database ID from a raw ID, UUID, or full Notion URL.
 */
export function extractNotionDatabaseId(rawId: string): string {
  if (!rawId) return '';
  const clean = rawId.trim().replace(/^["']|["']$/g, '');

  // 1. If hash exists (#), check the fragment first (for inline databases on a page)
  if (clean.includes('#')) {
    const afterHash = clean.split('#')[1];
    const hashMatch = afterHash.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (hashMatch) {
      return hashMatch[1].replace(/-/g, '');
    }
  }

  // 2. Remove query string (?v=...) so view IDs are not matched instead of database ID
  const beforeQuery = clean.split('?')[0];
  const urlMatch = beforeQuery.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (urlMatch) {
    return urlMatch[1].replace(/-/g, '');
  }

  // 3. Fallback to full string regex search
  const fullMatch = clean.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (fullMatch) {
    return fullMatch[1].replace(/-/g, '');
  }

  return clean.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop()?.replace(/-/g, '') || clean;
}

interface NotionPage {
  id: string;
  url: string;
  archived?: boolean;
  properties: Record<string, NotionPropertyValue>;
}

interface NotionPropertyValue {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  select?: { name: string } | null;
  status?: { name: string } | null;
  date?: { start: string | null } | null;
  [key: string]: unknown;
}

/**
 * Fetch tasks from a Notion database.
 * Returns an empty array on any failure so the coach can still function.
 */
export async function fetchNotionTasks(
  config: NotionConfig
): Promise<NotionTask[]> {
  try {
    const cleanDbId = extractNotionDatabaseId(config.databaseId);
    const proxyUrl = config.notionProxyUrl || config.proxyUrl || '';
    const data = await callNotionApi(
      `/databases/${cleanDbId}/query`,
      'POST',
      config.apiKey,
      proxyUrl,
      {
        // Return most-recently-edited items first
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        page_size: 100,
      }
    );

    const pages: NotionPage[] = data.results ?? [];
    return pages.map(pageToTask);
  } catch (err) {
    console.warn('[notion-client] Failed to fetch tasks:', err);
    return [];
  }
}

/**
 * Extract a plain-text title from the first title-type property.
 */
function extractTitle(properties: Record<string, NotionPropertyValue>): string {
  for (const prop of Object.values(properties)) {
    if (prop.type === 'title' && prop.title && prop.title.length > 0) {
      return prop.title.map((t) => t.plain_text).join('');
    }
  }
  return '(untitled)';
}

/**
 * Try to read a status or select property by common field names.
 */
function extractSelectOrStatus(
  properties: Record<string, NotionPropertyValue>,
  fieldNames: string[]
): string {
  for (const name of fieldNames) {
    const prop = properties[name];
    if (!prop) continue;
    if (prop.type === 'status' && prop.status?.name) return prop.status.name;
    if (prop.type === 'select' && prop.select?.name) return prop.select.name;
  }
  return '';
}

function extractDate(
  properties: Record<string, NotionPropertyValue>,
  fieldNames: string[]
): string | null {
  for (const name of fieldNames) {
    const prop = properties[name];
    if (prop?.type === 'date' && prop.date?.start) {
      return prop.date.start;
    }
  }
  return null;
}

function pageToTask(page: NotionPage): NotionTask {
  const props = page.properties;
  return {
    id: page.id,
    title: extractTitle(props),
    status: extractSelectOrStatus(props, ['Status', 'status', 'State', 'state']),
    dueDate: extractDate(props, ['Due Date', 'Due', 'due_date', 'Deadline', 'Date']),
    priority: extractSelectOrStatus(props, ['Priority', 'priority', 'Urgency', 'urgency']),
    url: page.url,
    archived: Boolean(page.archived),
  };
}

export interface NotionTaskDetails {
  pageContent: string;
  existingStrategyBlockId?: string;
  existingStrategyText?: string;
}

export interface NotionRichTextItem {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

/**
 * Parses markdown inline styles (bold, italic, bold-italic, code, strikethrough)
 * into an array of typed Notion rich_text objects with proper annotations.
 */
export function parseInlineMarkdownToRichText(text: string): NotionRichTextItem[] {
  if (!text) return [];

  const results: NotionRichTextItem[] = [];

  // Regex to match markdown inline formatting tokens
  const tokenRegex = /(\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`|~~[^~]+~~)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = tokenRegex.lastIndex;
    const matchedToken = match[0];

    // Push any unformatted plain text preceding this token
    if (matchStart > lastIndex) {
      const plain = text.slice(lastIndex, matchStart);
      pushSafeRichTextChunks(results, plain, {});
    }

    if (matchedToken.startsWith('***') && matchedToken.endsWith('***')) {
      pushSafeRichTextChunks(results, matchedToken.slice(3, -3), { bold: true, italic: true });
    } else if (matchedToken.startsWith('___') && matchedToken.endsWith('___')) {
      pushSafeRichTextChunks(results, matchedToken.slice(3, -3), { bold: true, italic: true });
    } else if (matchedToken.startsWith('**') && matchedToken.endsWith('**')) {
      pushSafeRichTextChunks(results, matchedToken.slice(2, -2), { bold: true });
    } else if (matchedToken.startsWith('__') && matchedToken.endsWith('__')) {
      pushSafeRichTextChunks(results, matchedToken.slice(2, -2), { bold: true });
    } else if (matchedToken.startsWith('*') && matchedToken.endsWith('*')) {
      pushSafeRichTextChunks(results, matchedToken.slice(1, -1), { italic: true });
    } else if (matchedToken.startsWith('_') && matchedToken.endsWith('_')) {
      pushSafeRichTextChunks(results, matchedToken.slice(1, -1), { italic: true });
    } else if (matchedToken.startsWith('`') && matchedToken.endsWith('`')) {
      pushSafeRichTextChunks(results, matchedToken.slice(1, -1), { code: true });
    } else if (matchedToken.startsWith('~~') && matchedToken.endsWith('~~')) {
      pushSafeRichTextChunks(results, matchedToken.slice(2, -2), { strikethrough: true });
    } else {
      pushSafeRichTextChunks(results, matchedToken, {});
    }

    lastIndex = matchEnd;
  }

  // Push remaining trailing plain text
  if (lastIndex < text.length) {
    pushSafeRichTextChunks(results, text.slice(lastIndex), {});
  }

  if (results.length === 0 && text) {
    pushSafeRichTextChunks(results, text, {});
  }

  return results;
}

/**
 * Pushes rich_text objects while respecting Notion's strict 2000-character per element limit.
 */
function pushSafeRichTextChunks(
  array: NotionRichTextItem[],
  content: string,
  annotations: NotionRichTextItem['annotations'] = {}
) {
  if (!content) return;
  const maxChunk = 1800;
  for (let i = 0; i < content.length; i += maxChunk) {
    array.push({
      type: 'text',
      text: { content: content.slice(i, i + maxChunk) },
      annotations: {
        bold: Boolean(annotations.bold),
        italic: Boolean(annotations.italic),
        strikethrough: Boolean(annotations.strikethrough),
        underline: Boolean(annotations.underline),
        code: Boolean(annotations.code),
        color: annotations.color || 'default',
      },
    });
  }
}

/**
 * Converts a markdown string into native Notion block objects
 * (paragraphs, bulleted_list_items, numbered_list_items, to_dos, headings, dividers).
 */
export function markdownToNotionBlocks(markdown: string): any[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Skip empty lines
    if (!line) continue;

    // Check for bullet list item: *, -, +, or •
    const bulletMatch = line.match(/^([*\-+•])\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[2];
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseInlineMarkdownToRichText(content),
        },
      });
      continue;
    }

    // Check for numbered list item: 1. or 1)
    const numberedMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numberedMatch) {
      const content = numberedMatch[2];
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: parseInlineMarkdownToRichText(content),
        },
      });
      continue;
    }

    // Check for to-do checkbox: [ ] or [x]
    const todoMatch = line.match(/^\[([ xX])\]\s+(.*)$/);
    if (todoMatch) {
      const checked = todoMatch[1].toLowerCase() === 'x';
      const content = todoMatch[2];
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: parseInlineMarkdownToRichText(content),
          checked,
        },
      });
      continue;
    }

    // Check for markdown headings: ###, ##, #
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const content = headingMatch[2];
      // Format as bold paragraph to maintain sleek layout inside callouts
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: parseInlineMarkdownToRichText(`**${content}**`),
        },
      });
      continue;
    }

    // Check for dividers: ---, ***, ___
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {},
      });
      continue;
    }

    // Check for standalone bold header lines like: **Angle of Attack**
    const standaloneBoldMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (standaloneBoldMatch) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: standaloneBoldMatch[1] },
              annotations: { bold: true },
            },
          ],
        },
      });
      continue;
    }

    // Default: Regular paragraph with inline markdown annotations
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: parseInlineMarkdownToRichText(line),
      },
    });
  }

  return blocks;
}

/**
 * Fetch child blocks of a Notion page (task) to extract existing page body context
 * and check if an existing Coach Strategy callout/section already exists.
 */
export async function getNotionTaskDetails(
  config: { apiKey: string; proxyUrl?: string; notionProxyUrl?: string },
  taskId: string
): Promise<{ ok: boolean; data?: NotionTaskDetails; error?: string }> {
  try {
    const cleanId = taskId.replace(/-/g, '');
    const proxyUrl = config.proxyUrl || config.notionProxyUrl || '';
    const data = await callNotionApi(
      `/blocks/${cleanId}/children?page_size=100`,
      'GET',
      config.apiKey,
      proxyUrl
    );

    const blocks: any[] = data.results || [];

    let existingStrategyBlockId: string | undefined;
    let existingStrategyText: string | undefined;
    const contentLines: string[] = [];

    for (const block of blocks) {
      const type = block.type;
      const richText = block[type]?.rich_text;
      const text = Array.isArray(richText) ? richText.map((t: any) => t.plain_text || '').join('') : '';

      // Check if this is a Coach Strategy block (Callout with Coach Strategy or heading)
      const isStrategyBlock =
        (type === 'callout' && (text.includes('Coach Strategy') || text.includes('COACH STRATEGY') || text.includes('🎯 Coach'))) ||
        (type.startsWith('heading_') && (text.includes('Coach Strategy') || text.includes('🎯 Coach Strategy')));

      if (isStrategyBlock) {
        existingStrategyBlockId = block.id;

        // If the strategy block has nested child blocks, retrieve their text
        if (block.has_children) {
          try {
            const childData = await callNotionApi(
              `/blocks/${block.id}/children?page_size=100`,
              'GET',
              config.apiKey,
              proxyUrl
            );
            const childBlocks = childData.results || [];
            const extracted: string[] = [];
            for (const cb of childBlocks) {
              const cType = cb.type;
              const cRt = cb[cType]?.rich_text;
              const cText = Array.isArray(cRt) ? cRt.map((t: any) => t.plain_text || '').join('') : '';
              if (cText.trim()) {
                if (cType === 'bulleted_list_item') {
                  extracted.push(`* ${cText.trim()}`);
                } else if (cType === 'numbered_list_item') {
                  extracted.push(`1. ${cText.trim()}`);
                } else {
                  extracted.push(cText.trim());
                }
              }
            }
            if (extracted.length > 0) {
              existingStrategyText = extracted.join('\n\n');
            }
          } catch {
            // ignore child fetch failure
          }
        }

        if (!existingStrategyText) {
          existingStrategyText = text.replace(/^🎯\s*COACH\s*STRATEGY[^\n]*\n+/i, '').trim();
        }
      } else if (text.trim()) {
        contentLines.push(text.trim());
      }
    }

    return {
      ok: true,
      data: {
        pageContent: contentLines.join('\n\n'),
        existingStrategyBlockId,
        existingStrategyText,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to fetch task details from Notion' };
  }
}

/**
 * Inject or replace the Coach Strategy section on a Notion task page.
 * Uses native Notion blocks (bulleted lists, paragraphs with bold/italics, etc.)
 * inside a blue Callout block so it renders with first-class Notion typography.
 */
export async function injectNotionTaskStrategy(
  config: { apiKey: string; proxyUrl?: string; notionProxyUrl?: string },
  taskId: string,
  strategyText: string,
  existingBlockId?: string
): Promise<{ ok: boolean; blockId?: string; error?: string }> {
  try {
    const cleanId = taskId.replace(/-/g, '');
    const proxyUrl = config.proxyUrl || config.notionProxyUrl || '';

    // If an older strategy block exists, delete it first to avoid duplicate blocks
    if (existingBlockId) {
      try {
        await callNotionApi(
          `/blocks/${existingBlockId}`,
          'DELETE',
          config.apiKey,
          proxyUrl
        );
      } catch (err) {
        console.warn('[notion-client] Could not delete old strategy block:', err);
      }
    }

    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parsedBlocks = markdownToNotionBlocks(strategyText);

    // Callout title rich_text
    const calloutTitleRichText: NotionRichTextItem[] = [
      {
        type: 'text',
        text: { content: 'COACH STRATEGY ' },
        annotations: { bold: true },
      },
      {
        type: 'text',
        text: { content: `(${timestamp})` },
        annotations: { italic: true, color: 'gray' },
      },
    ];

    // Attempt 1: Append Callout with nested children directly
    try {
      const appendData = await callNotionApi(
        `/blocks/${cleanId}/children`,
        'PATCH',
        config.apiKey,
        proxyUrl,
        {
          children: [
            {
              object: 'block',
              type: 'callout',
              callout: {
                icon: {
                  type: 'emoji',
                  emoji: '🎯',
                },
                color: 'blue_background',
                rich_text: calloutTitleRichText,
                children: parsedBlocks,
              },
            },
          ],
        }
      );

      const newBlockId = appendData.results?.[0]?.id;
      return { ok: true, blockId: newBlockId };
    } catch {
      // Attempt 2 (Fallback): If Notion rejects children inside callout on initial creation,
      // create the callout first, then append the children to the created callout block
      const fallbackData = await callNotionApi(
        `/blocks/${cleanId}/children`,
        'PATCH',
        config.apiKey,
        proxyUrl,
        {
          children: [
            {
              object: 'block',
              type: 'callout',
              callout: {
                icon: {
                  type: 'emoji',
                  emoji: '🎯',
                },
                color: 'blue_background',
                rich_text: calloutTitleRichText,
              },
            },
          ],
        }
      );

      const calloutBlockId = fallbackData.results?.[0]?.id;

      if (calloutBlockId && parsedBlocks.length > 0) {
        await callNotionApi(
          `/blocks/${calloutBlockId}/children`,
          'PATCH',
          config.apiKey,
          proxyUrl,
          {
            children: parsedBlocks,
          }
        ).catch((err) => {
          console.warn('[notion-client] Could not append nested children to callout:', err);
        });
      }

      return { ok: true, blockId: calloutBlockId };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to inject strategy into Notion' };
  }
}


