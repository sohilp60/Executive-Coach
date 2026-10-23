/**
 * Notion Status Discovery, Selective Sync, and Delta Update Engine
 *
 * Supports:
 * 1. Fetching available task statuses directly from a Notion Database schema & pages.
 * 2. Selective task syncing based on user-selected statuses (preventing backlog clutter).
 * 3. Delta updates using Notion's `last_edited_time` timestamp filter to incrementally
 *    add, update, or prune tasks modified since the last sync.
 */

import type { NotionConfig, NotionTask, NotionDeltaStats } from '../../types/schema';
import {
  callNotionApi,
  cleanNotionApiKey,
  extractNotionDatabaseId,
} from './notion-client';
import { updateBadgeForTasks } from '../../background/badge-manager';

export interface NotionStatusesResult {
  ok: boolean;
  statuses?: string[];
  selectedStatuses?: string[];
  statusPropName?: string;
  statusPropType?: 'status' | 'select' | 'multi_select';
  error?: string;
}

export interface NotionSyncResult {
  ok: boolean;
  data?: NotionTask[];
  deltaStats?: NotionDeltaStats;
  selectedStatuses?: string[];
  error?: string;
}

// Helper: extract title from Notion page properties
function extractPageTitle(props: Record<string, any> | undefined): string {
  for (const key of Object.keys(props || {})) {
    if (props?.[key]?.type === 'title') {
      const arr = props[key].title;
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((t: any) => t.plain_text || '').join('') || 'Untitled';
      }
      return 'Untitled';
    }
  }
  return 'Untitled';
}

// Helper: extract status from Notion page properties
function extractPageStatus(props: Record<string, any> | undefined, statusPropName?: string): string {
  if (!props) return 'No Status';

  if (statusPropName && props[statusPropName]) {
    const s = props[statusPropName];
    const val = s.status?.name || s.select?.name || s.multi_select?.[0]?.name;
    return val || 'No Status';
  }

  // Fallback property search
  const s = props.Status || props.status || props.State || props.state || props.Stage || props.stage;
  if (s) {
    return s.status?.name || s.select?.name || s.multi_select?.[0]?.name || 'No Status';
  }

  // Check any property of type 'status'
  for (const val of Object.values(props)) {
    if (val?.type === 'status') {
      return val.status?.name || 'No Status';
    }
  }

  return 'No Status';
}

// Helper: extract due date from Notion page properties
function extractPageDueDate(props: Record<string, any> | undefined): string | null {
  if (!props) return null;
  const d =
    props['Due Date'] ||
    props['Due'] ||
    props['Deadline'] ||
    props['due_date'] ||
    props['Date'] ||
    props['date'];
  if (d?.date?.start) return d.date.start;

  for (const val of Object.values(props)) {
    if (val?.type === 'date' && val.date?.start) {
      return val.date.start;
    }
  }
  return null;
}

// Helper: extract priority from Notion page properties
function extractPagePriority(props: Record<string, any> | undefined): string {
  if (!props) return 'None';
  const p = props.Priority || props.priority || props.Urgency || props.urgency;
  if (!p) return 'None';
  return p.select?.name || p.status?.name || p.multi_select?.[0]?.name || 'None';
}

/**
 * Resolves merged Notion configuration from passed overrides and chrome.storage.local.
 */
async function resolveNotionConfig(
  override?: Partial<NotionConfig>
): Promise<{ stored: NotionConfig; merged: NotionConfig; cleanKey: string; cleanDbId: string; proxyUrl: string }> {
  const res = (await chrome.storage.local.get('po_notion_config')) as Record<string, any>;
  const stored: NotionConfig = (res?.po_notion_config as NotionConfig) || { apiKey: '', databaseId: '' };

  const merged: NotionConfig = {
    ...stored,
    ...override,
    apiKey: override?.apiKey || stored.apiKey || '',
    databaseId: override?.databaseId || stored.databaseId || '',
    notionProxyUrl:
      override?.notionProxyUrl ??
      override?.proxyUrl ??
      stored.notionProxyUrl ??
      stored.proxyUrl ??
      '',
    selectedStatuses: override?.selectedStatuses ?? stored.selectedStatuses,
    availableStatuses: override?.availableStatuses ?? stored.availableStatuses,
    syncIntervalMinutes: override?.syncIntervalMinutes ?? stored.syncIntervalMinutes,
    lastSyncedAtISO: override?.lastSyncedAtISO ?? stored.lastSyncedAtISO,
  };

  const cleanKey = cleanNotionApiKey(merged.apiKey);
  const cleanDbId = extractNotionDatabaseId(merged.databaseId);
  const proxyUrl = (merged.notionProxyUrl || '').trim();

  return { stored, merged, cleanKey, cleanDbId, proxyUrl };
}

/**
 * Formats friendly Notion connection error messages.
 */
function formatNotionError(err: any): string {
  let errorMsg = String(err?.message || err);
  if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
    errorMsg =
      'Failed to fetch from Notion API. Please verify:\n' +
      '1. If using corporate network or VPN blocking api.notion.com, configure the Google Apps Script relay URL in Settings.\n' +
      '2. In edge://extensions or chrome://extensions, click Details on this extension and ensure "Site access" is set to "On all sites".\n' +
      '3. Ensure your Notion database is shared with your integration (open your Notion Database page -> click "..." -> Connections -> Add your integration).';
  }
  return errorMsg;
}

/**
 * Fetches all available statuses from the user's Notion database.
 * Inspects both the database schema (`GET /databases/{id}`) and existing pages
 * to ensure all possible status values are discovered.
 */
export async function fetchNotionAvailableStatuses(
  configOverride?: Partial<NotionConfig>
): Promise<NotionStatusesResult> {
  try {
    const { merged, cleanKey, cleanDbId, proxyUrl } = await resolveNotionConfig(configOverride);

    if (!cleanKey) {
      return {
        ok: false,
        error: 'Notion API key is missing. Please enter your secret_... token in Settings.',
      };
    }

    if (!cleanDbId) {
      return {
        ok: false,
        error: 'Could not extract a valid Notion Database ID. Please check the URL or ID in Settings.',
      };
    }

    const statusSet = new Set<string>();
    let statusPropName: string | undefined;
    let statusPropType: 'status' | 'select' | 'multi_select' | undefined;

    // 1. Inspect database schema for defined status options
    try {
      const dbMeta = await callNotionApi(
        `/databases/${cleanDbId}`,
        'GET',
        cleanKey,
        proxyUrl
      );
      const props = dbMeta?.properties || {};

      for (const [key, value] of Object.entries<any>(props)) {
        if (value?.type === 'status') {
          statusPropName = key;
          statusPropType = 'status';
          const opts: any[] = value.status?.options || [];
          for (const o of opts) {
            if (o?.name) statusSet.add(o.name);
          }
          break;
        }
      }

      if (!statusPropName) {
        for (const [key, value] of Object.entries<any>(props)) {
          if (
            (value?.type === 'select' || value?.type === 'multi_select') &&
            /^(status|state|stage)$/i.test(key.trim())
          ) {
            statusPropName = key;
            statusPropType = value.type;
            const opts: any[] = value[value.type]?.options || [];
            for (const o of opts) {
              if (o?.name) statusSet.add(o.name);
            }
            break;
          }
        }
      }

      if (!statusPropName) {
        for (const [key, value] of Object.entries<any>(props)) {
          if (
            (value?.type === 'select' || value?.type === 'multi_select') &&
            /status|state|stage/i.test(key)
          ) {
            statusPropName = key;
            statusPropType = value.type;
            const opts: any[] = value[value.type]?.options || [];
            for (const o of opts) {
              if (o?.name) statusSet.add(o.name);
            }
            break;
          }
        }
      }
    } catch (schemaErr) {
      console.warn('[notion-sync] Database schema inspection warning, falling back to page scan:', schemaErr);
    }

    // 2. Also scan recent pages in the database to capture any ad-hoc statuses or 'No Status'
    try {
      const queryJson = await callNotionApi(
        `/databases/${cleanDbId}/query`,
        'POST',
        cleanKey,
        proxyUrl,
        { page_size: 100 }
      );
      const results: any[] = queryJson?.results || [];
      for (const page of results) {
        if (page?.archived) continue;
        const pageStatus = extractPageStatus(page.properties, statusPropName);
        if (pageStatus) {
          statusSet.add(pageStatus);
        }
      }
    } catch (queryErr) {
      // If schema succeeded, we still have statuses; if both failed, throw
      if (statusSet.size === 0) {
        throw queryErr;
      }
    }

    const statuses = Array.from(statusSet);

    // Persist discovered availableStatuses into po_notion_config
    const updatedConfig: NotionConfig = {
      ...merged,
      availableStatuses: statuses,
    };
    await chrome.storage.local.set({ po_notion_config: updatedConfig });

    return {
      ok: true,
      statuses,
      selectedStatuses: merged.selectedStatuses,
      statusPropName,
      statusPropType,
    };
  } catch (err: any) {
    console.warn('[notion-sync] Failed to fetch Notion statuses:', err);
    return {
      ok: false,
      error: formatNotionError(err),
    };
  }
}

/**
 * Synchronizes tasks from Notion with support for:
 * - Selective status filtering (`selectedStatuses`)
 * - Delta updates (`isDelta: true`) using Notion's `last_edited_time` filter
 */
export async function syncNotionTasksWithStatuses(options: {
  config?: Partial<NotionConfig>;
  selectedStatuses?: string[];
  isDelta?: boolean;
}): Promise<NotionSyncResult> {
  try {
    const { merged, cleanKey, cleanDbId, proxyUrl } = await resolveNotionConfig(options.config);

    if (!cleanKey) {
      return {
        ok: false,
        error: 'Notion API key is missing. Please enter your secret_... token in Settings.',
      };
    }

    if (!cleanDbId) {
      return {
        ok: false,
        error: 'Could not extract a valid Notion Database ID. Please check the URL or ID in Settings.',
      };
    }

    const activeSelectedStatuses =
      options.selectedStatuses !== undefined
        ? options.selectedStatuses
        : merged.selectedStatuses;

    const hasStatusFilter =
      Array.isArray(activeSelectedStatuses) && activeSelectedStatuses.length > 0;
    const allowedStatusSet = hasStatusFilter
      ? new Set(activeSelectedStatuses.map((s) => s.trim()))
      : null;

    // Load existing cached tasks
    const storedTasksRes = await chrome.storage.local.get('po_tasks');
    const existingTasks: NotionTask[] = Array.isArray(storedTasksRes.po_tasks)
      ? storedTasksRes.po_tasks
      : [];

    const prevTaskMap = new Map<string, NotionTask>();
    for (const t of existingTasks) {
      if (t?.id) prevTaskMap.set(t.id, t);
    }

    const syncTimestampISO = new Date().toISOString();
    const canRunDelta = Boolean(options.isDelta && merged.lastSyncedAtISO);

    let finalTasks: NotionTask[] = [];
    let added = 0;
    let updated = 0;
    let removed = 0;

    if (canRunDelta && merged.lastSyncedAtISO) {
      // ── DELTA SYNC MODE ──
      // Query all pages edited on or after lastSyncedAtISO
      const deltaPages: any[] = [];
      let nextCursor: string | undefined = undefined;
      let pageCount = 0;

      do {
        const body: Record<string, any> = {
          page_size: 100,
          sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
          filter: {
            timestamp: 'last_edited_time',
            last_edited_time: {
              on_or_after: merged.lastSyncedAtISO,
            },
          },
        };
        if (nextCursor) body.start_cursor = nextCursor;

        const json = await callNotionApi(
          `/databases/${cleanDbId}/query`,
          'POST',
          cleanKey,
          proxyUrl,
          body
        );

        if (Array.isArray(json.results)) {
          deltaPages.push(...json.results);
        }
        nextCursor = json.has_more ? json.next_cursor : undefined;
        pageCount++;
      } while (nextCursor && pageCount < 3);

      // Start with existing tasks, pruning any that no longer match allowedStatusSet
      const workingMap = new Map<string, NotionTask>();
      for (const [id, task] of prevTaskMap.entries()) {
        if (allowedStatusSet && !allowedStatusSet.has(task.status)) {
          removed++;
        } else {
          workingMap.set(id, task);
        }
      }

      // Apply delta changes from Notion
      for (const page of deltaPages) {
        const pageId = page.id;
        const isArchived = Boolean(page.archived || page.in_trash);
        const status = extractPageStatus(page.properties);
        const matchesStatus = !allowedStatusSet || allowedStatusSet.has(status);

        if (isArchived || !matchesStatus) {
          // Task was archived or moved to an unselected status in Notion -> remove locally
          if (workingMap.has(pageId)) {
            workingMap.delete(pageId);
            removed++;
          }
        } else {
          // Task is active and matches selected statuses -> upsert locally
          const prev = workingMap.get(pageId) || prevTaskMap.get(pageId);
          const mappedTask: NotionTask = {
            id: pageId,
            title: extractPageTitle(page.properties),
            status,
            dueDate: extractPageDueDate(page.properties),
            priority: extractPagePriority(page.properties),
            url: page.url || '',
            archived: false,
            lastEditedTime: page.last_edited_time,
            coachStrategy: prev?.coachStrategy,
            coachStrategyBlockId: prev?.coachStrategyBlockId,
            coachStrategyUpdatedAt: prev?.coachStrategyUpdatedAt,
          };

          if (workingMap.has(pageId)) {
            workingMap.set(pageId, mappedTask);
            updated++;
          } else {
            workingMap.set(pageId, mappedTask);
            added++;
          }
        }
      }

      finalTasks = Array.from(workingMap.values());
    } else {
      // ── FULL SYNC MODE (filtered by selectedStatuses) ──
      const allPages: any[] = [];
      let nextCursor: string | undefined = undefined;
      let pageCount = 0;

      do {
        const body: Record<string, any> = {
          page_size: 100,
          sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        };
        if (nextCursor) body.start_cursor = nextCursor;

        const json = await callNotionApi(
          `/databases/${cleanDbId}/query`,
          'POST',
          cleanKey,
          proxyUrl,
          body
        );

        if (Array.isArray(json.results)) {
          allPages.push(...json.results);
        }
        nextCursor = json.has_more ? json.next_cursor : undefined;
        pageCount++;
      } while (nextCursor && pageCount < 3);

      const seenIds = new Set<string>();

      for (const page of allPages) {
        const isArchived = Boolean(page.archived || page.in_trash);
        if (isArchived) continue;

        const status = extractPageStatus(page.properties);
        if (allowedStatusSet && !allowedStatusSet.has(status)) {
          continue;
        }

        const prev = prevTaskMap.get(page.id);
        if (prev) {
          updated++;
        } else {
          added++;
        }
        seenIds.add(page.id);

        finalTasks.push({
          id: page.id,
          title: extractPageTitle(page.properties),
          status,
          dueDate: extractPageDueDate(page.properties),
          priority: extractPagePriority(page.properties),
          url: page.url || '',
          archived: false,
          lastEditedTime: page.last_edited_time,
          coachStrategy: prev?.coachStrategy,
          coachStrategyBlockId: prev?.coachStrategyBlockId,
          coachStrategyUpdatedAt: prev?.coachStrategyUpdatedAt,
        });
      }

      for (const oldId of prevTaskMap.keys()) {
        if (!seenIds.has(oldId)) {
          removed++;
        }
      }
    }

    const deltaStats: NotionDeltaStats = {
      added,
      updated,
      removed,
      isDelta: canRunDelta,
      syncedAt: syncTimestampISO,
    };

    // Persist updated tasks and Notion config metadata
    const updatedNotionConfig: NotionConfig = {
      ...merged,
      selectedStatuses: activeSelectedStatuses,
      lastSyncedAtISO: syncTimestampISO,
    };

    await chrome.storage.local.set({
      po_tasks: finalTasks,
      po_notion_config: updatedNotionConfig,
      po_last_delta_stats: deltaStats,
    });

    // Update extension toolbar badge
    await updateBadgeForTasks(finalTasks);

    // Notify any open UI views about the updated tasks
    try {
      chrome.runtime
        .sendMessage({
          type: 'NOTION_TASKS_UPDATED',
          tasks: finalTasks,
          deltaStats,
        })
        .catch(() => {});
    } catch {
      // Ignore if no listeners are active
    }

    return {
      ok: true,
      data: finalTasks,
      deltaStats,
      selectedStatuses: activeSelectedStatuses,
    };
  } catch (err: any) {
    console.warn('[notion-sync] Notion sync failed:', err);
    return {
      ok: false,
      error: formatNotionError(err),
    };
  }
}
