/**
 * Notion Page Creation & Context Appending Client
 *
 * Runs inside the Background Service Worker (CORS-safe).
 * Creates new task pages in a Notion database or appends captured context
 * to existing task pages.
 */

import type {
  NotionCreateTaskPayload,
  NotionAppendTaskPayload,
  CapturePayload,
} from '../../types/schema';
import {
  parseInlineMarkdownToRichText,
  markdownToNotionBlocks,
  injectNotionTaskStrategy,
  extractNotionDatabaseId,
  cleanNotionApiKey,
  callNotionApi,
} from './notion-client';

export interface NotionPageCreateResult {
  ok: boolean;
  taskId?: string;
  taskUrl?: string;
  taskTitle?: string;
  error?: string;
}

const cleanDatabaseId = extractNotionDatabaseId;

export interface NotionDatabaseMetadata {
  titlePropName: string;
  statusProp?: {
    name: string;
    type: 'status' | 'select';
    options: string[];
    defaultOption?: string;
  };
  datePropName?: string;
  priorityProp?: {
    name: string;
    type: 'select' | 'status';
    options: string[];
  };
}

/**
 * Inspects a database to discover exact property names, types, and allowed options.
 */
export async function inspectDatabaseSchema(
  apiKey: string,
  databaseId: string,
  proxyUrl?: string
): Promise<NotionDatabaseMetadata> {
  try {
    const cleanDbId = cleanDatabaseId(databaseId);
    const data = await callNotionApi(
      `/databases/${cleanDbId}`,
      'GET',
      apiKey,
      proxyUrl
    );
    const props = data.properties || {};

    let titlePropName = 'Name';
    let statusProp: NotionDatabaseMetadata['statusProp'];
    let datePropName: string | undefined;
    let priorityProp: NotionDatabaseMetadata['priorityProp'];

    for (const [key, value] of Object.entries<any>(props)) {
      if (value.type === 'title') {
        titlePropName = key;
      } else if (value.type === 'status') {
        const rawOptions: any[] = value.status?.options || [];
        const options = rawOptions.map((o) => o.name);
        const defaultOption = options[0];
        statusProp = { name: key, type: 'status', options, defaultOption };
      } else if (value.type === 'select' && !statusProp && /status|state/i.test(key)) {
        const rawOptions: any[] = value.select?.options || [];
        const options = rawOptions.map((o) => o.name);
        statusProp = { name: key, type: 'select', options, defaultOption: options[0] };
      } else if (value.type === 'date' && !datePropName) {
        datePropName = key;
      } else if ((value.type === 'select' || value.type === 'status') && /priority|urgency/i.test(key)) {
        const rawOptions: any[] = (value.type === 'select' ? value.select?.options : value.status?.options) || [];
        const options = rawOptions.map((o) => o.name);
        priorityProp = { name: key, type: value.type, options };
      }
    }

    return { titlePropName, statusProp, datePropName, priorityProp };
  } catch (err) {
    console.warn('[inspectDatabaseSchema] Failed to inspect schema:', err);
    return { titlePropName: 'Name' };
  }
}

/**
 * Builds rich Notion blocks representing the source capture.
 */
function buildSourceCaptureBlocks(capture: CapturePayload, contextSummary: string): any[] {
  const blocks: any[] = [];

  let sourceEmoji = '🌐';
  let sourceLabel = 'Web Page';
  let metaDetails = `Captured on ${new Date(capture.capturedAtISO).toLocaleString()}`;

  switch (capture.source) {
    case 'teams':
      sourceEmoji = '🟦';
      sourceLabel = 'Microsoft Teams';
      metaDetails = `Sender: ${capture.senderName} • Channel: ${capture.channelOrChat} • Sent: ${capture.timestamp}`;
      break;
    case 'outlook':
      sourceEmoji = '✉️';
      sourceLabel = 'Outlook Email';
      metaDetails = `From: ${capture.senderName} (${capture.senderEmail || 'N/A'}) • Subject: ${capture.subject}`;
      break;
    case 'jira':
      sourceEmoji = '🔷';
      sourceLabel = `Jira [${capture.issueKey}]`;
      metaDetails = `Status: ${capture.status} • Priority: ${capture.priority} • Assignee: ${capture.assignee}`;
      break;
    case 'confluence':
      sourceEmoji = '📘';
      sourceLabel = 'Confluence Wiki';
      metaDetails = `Author: ${capture.author} • Space: ${capture.spaceKey} • Modified: ${capture.lastModified}`;
      break;
    case 'generic':
    default:
      sourceEmoji = '🌐';
      sourceLabel = capture.pageTitle || 'Web Capture';
      metaDetails = `URL: ${capture.sourceUrl}`;
      break;
  }

  // 1. Source Context Callout Block
  const calloutChildren: any[] = [];

  if (capture.selectedText) {
    calloutChildren.push({
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: parseInlineMarkdownToRichText(
          capture.selectedText.length > 1800
            ? capture.selectedText.slice(0, 1800) + '...'
            : capture.selectedText
        ),
      },
    });
  }

  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: sourceEmoji },
      color: 'gray_background',
      rich_text: [
        {
          type: 'text',
          text: { content: `Source: ` },
          annotations: { bold: false },
        },
        {
          type: 'text',
          text: {
            content: sourceLabel,
            link: capture.sourceUrl ? { url: capture.sourceUrl } : null,
          },
          annotations: { bold: true, color: 'blue' },
        },
        {
          type: 'text',
          text: { content: `\n${metaDetails}` },
          annotations: { italic: true, color: 'gray' },
        },
      ],
      children: calloutChildren.length > 0 ? calloutChildren : undefined,
    },
  });

  // 2. Executive Context Summary Block (if present)
  if (contextSummary && contextSummary.trim()) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: 'Executive Context: ' },
            annotations: { bold: true },
          },
          ...parseInlineMarkdownToRichText(contextSummary.trim()),
        ],
      },
    });
  }

  return blocks;
}

/**
 * Creates a brand new Notion Task page in the specified database.
 */
export async function createNotionTask(
  config: { apiKey: string; databaseId: string; notionProxyUrl?: string; proxyUrl?: string },
  payload: NotionCreateTaskPayload
): Promise<NotionPageCreateResult> {
  try {
    const cleanDbId = cleanDatabaseId(config.databaseId);
    const apiKey = cleanNotionApiKey(config.apiKey);
    const proxyUrl = config.notionProxyUrl || config.proxyUrl || '';

    if (!apiKey) {
      return { ok: false, error: 'Notion API key is missing. Please check Settings.' };
    }
    if (!cleanDbId) {
      return { ok: false, error: 'Notion Database ID is missing. Please check Settings.' };
    }

    // Inspect database properties to map keys dynamically
    const schema = await inspectDatabaseSchema(apiKey, cleanDbId, proxyUrl);

    // Build Page Properties
    const properties: Record<string, any> = {
      [schema.titlePropName]: {
        title: [
          {
            type: 'text',
            text: { content: payload.title || 'Untitled Executive Task' },
          },
        ],
      },
    };

    // Map Status dynamically against allowed schema options
    if (schema.statusProp) {
      const allowed = schema.statusProp.options || [];
      const chosen = (payload.status || '').trim();

      // 1. Exact match
      let matchedOption = allowed.find((opt) => opt === chosen);

      // 2. Case-insensitive match
      if (!matchedOption && chosen) {
        matchedOption = allowed.find((opt) => opt.toLowerCase() === chosen.toLowerCase());
      }

      // 3. Keyword heuristic match
      if (!matchedOption && chosen) {
        if (/to\s*do|not\s*started|todo|backlog/i.test(chosen)) {
          matchedOption = allowed.find((opt) => /not\s*started|to\s*do|todo|backlog/i.test(opt));
        } else if (/progress|wip|doing/i.test(chosen)) {
          matchedOption = allowed.find((opt) => /progress|wip|doing/i.test(opt));
        } else if (/done|complete|closed/i.test(chosen)) {
          matchedOption = allowed.find((opt) => /done|complete|closed/i.test(opt));
        }
      }

      // 4. Default to first available option if no match found
      if (!matchedOption && allowed.length > 0) {
        matchedOption = schema.statusProp.defaultOption || allowed[0];
      }

      if (matchedOption) {
        if (schema.statusProp.type === 'status') {
          properties[schema.statusProp.name] = {
            status: { name: matchedOption },
          };
        } else {
          properties[schema.statusProp.name] = {
            select: { name: matchedOption },
          };
        }
      }
    }

    // Map Due Date if available
    if (schema.datePropName && payload.dueDate) {
      properties[schema.datePropName] = {
        date: { start: payload.dueDate },
      };
    }

    // Map Priority dynamically against allowed options
    if (schema.priorityProp && payload.priority && payload.priority !== 'None') {
      const allowed = schema.priorityProp.options || [];
      const chosen = payload.priority.trim();
      let matched = allowed.find((o) => o === chosen);
      if (!matched) {
        matched = allowed.find((o) => o.toLowerCase() === chosen.toLowerCase());
      }

      if (matched || allowed.length === 0) {
        const val = matched || chosen;
        if (schema.priorityProp.type === 'status') {
          properties[schema.priorityProp.name] = { status: { name: val } };
        } else {
          properties[schema.priorityProp.name] = { select: { name: val } };
        }
      }
    }

    // Build Child Blocks
    const children: any[] = buildSourceCaptureBlocks(
      payload.capturePayload,
      payload.contextSummary
    );

    // If Coach Strategy was pre-generated or requested
    if (payload.generateStrategy && payload.strategyText) {
      children.push({
        object: 'block',
        type: 'divider',
        divider: {},
      });

      const strategyChildren = markdownToNotionBlocks(payload.strategyText);
      children.push({
        object: 'block',
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '🎯' },
          color: 'blue_background',
          rich_text: [
            {
              type: 'text',
              text: { content: 'COACH STRATEGY' },
              annotations: { bold: true },
            },
          ],
          children: strategyChildren.length > 0 ? strategyChildren : undefined,
        },
      });
    }

    const createdPage = await callNotionApi(
      '/pages',
      'POST',
      apiKey,
      proxyUrl,
      {
        parent: { database_id: cleanDbId },
        properties,
        children,
      }
    );

    return {
      ok: true,
      taskId: createdPage.id,
      taskUrl: createdPage.url,
      taskTitle: payload.title,
    };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Appends captured context to an existing Notion page.
 */
export async function appendNotionTaskContext(
  config: { apiKey: string; proxyUrl?: string; notionProxyUrl?: string },
  payload: NotionAppendTaskPayload
): Promise<NotionPageCreateResult> {
  try {
    const apiKey = cleanNotionApiKey(config.apiKey);
    if (!apiKey) {
      return { ok: false, error: 'Notion API key is missing. Please check Settings.' };
    }
    if (!payload.taskId) {
      return { ok: false, error: 'Target Task ID is required.' };
    }

    const children: any[] = [
      {
        object: 'block',
        type: 'divider',
        divider: {},
      },
      ...buildSourceCaptureBlocks(payload.capturePayload, payload.contextSummary),
    ];

    const proxyUrl = config.proxyUrl || config.notionProxyUrl || '';
    const cleanTaskId = payload.taskId.replace(/-/g, '');
    await callNotionApi(
      `/blocks/${cleanTaskId}/children`,
      'PATCH',
      apiKey,
      proxyUrl,
      { children }
    );

    // If strategy regeneration was also requested
    if (payload.generateStrategy && payload.strategyText) {
      await injectNotionTaskStrategy(
        { apiKey, proxyUrl },
        payload.taskId,
        payload.strategyText
      );
    }

    return { ok: true, taskId: payload.taskId };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}
