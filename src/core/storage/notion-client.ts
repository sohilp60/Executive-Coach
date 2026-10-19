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
    const response = await fetch(
      `https://api.notion.com/v1/databases/${config.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Return most-recently-edited items first
          sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
          page_size: 100,
        }),
      }
    );

    if (!response.ok) {
      console.warn(
        `[notion-client] HTTP ${response.status}: ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();
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
  config: { apiKey: string },
  taskId: string
): Promise<{ ok: boolean; data?: NotionTaskDetails; error?: string }> {
  try {
    const cleanId = taskId.replace(/-/g, '');
    const cleanKey = config.apiKey.trim();
    const response = await fetch(
      `https://api.notion.com/v1/blocks/${cleanId}/children?page_size=100`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    if (!response.ok) {
      const errTxt = await response.text().catch(() => '');
      return { ok: false, error: `Notion API HTTP ${response.status}: ${errTxt}` };
    }

    const data = await response.json();
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
            const childRes = await fetch(
              `https://api.notion.com/v1/blocks/${block.id}/children?page_size=100`,
              {
                headers: {
                  Authorization: `Bearer ${cleanKey}`,
                  'Notion-Version': '2022-06-28',
                },
              }
            );
            if (childRes.ok) {
              const childData = await childRes.json();
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
  config: { apiKey: string },
  taskId: string,
  strategyText: string,
  existingBlockId?: string
): Promise<{ ok: boolean; blockId?: string; error?: string }> {
  try {
    const cleanId = taskId.replace(/-/g, '');
    const cleanKey = config.apiKey.trim();

    // If an older strategy block exists, delete it first to avoid duplicate blocks
    if (existingBlockId) {
      try {
        await fetch(`https://api.notion.com/v1/blocks/${existingBlockId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Notion-Version': '2022-06-28',
          },
        });
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
    const appendResponse = await fetch(
      `https://api.notion.com/v1/blocks/${cleanId}/children`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      }
    );

    if (appendResponse.ok) {
      const appendData = await appendResponse.json();
      const newBlockId = appendData.results?.[0]?.id;
      return { ok: true, blockId: newBlockId };
    }

    // Attempt 2 (Fallback): If Notion rejects children inside callout on initial creation,
    // create the callout first, then append the children to the created callout block
    const fallbackCalloutRes = await fetch(
      `https://api.notion.com/v1/blocks/${cleanId}/children`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      }
    );

    if (!fallbackCalloutRes.ok) {
      const errTxt = await fallbackCalloutRes.text().catch(() => '');
      return { ok: false, error: `Failed to inject strategy into Notion (HTTP ${fallbackCalloutRes.status}): ${errTxt}` };
    }

    const fallbackData = await fallbackCalloutRes.json();
    const calloutBlockId = fallbackData.results?.[0]?.id;

    if (calloutBlockId && parsedBlocks.length > 0) {
      await fetch(
        `https://api.notion.com/v1/blocks/${calloutBlockId}/children`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            children: parsedBlocks,
          }),
        }
      ).catch((err) => {
        console.warn('[notion-client] Could not append nested children to callout:', err);
      });
    }

    return { ok: true, blockId: calloutBlockId };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to inject strategy into Notion' };
  }
}


