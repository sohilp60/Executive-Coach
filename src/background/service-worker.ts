/**
 * Service Worker — Senior PO Executive Coach
 *
 * MV3 Pitfall Compliance:
 *  #1 — NO global state: all persistent data goes through chrome.storage.local
 *  #2 — NO async on onMessage listener: return true + inner IIFE
 *  #3 — Track active tab: onActivated + onUpdated listeners
 *  #4 — Edge OAuth: launchWebAuthFlow + PKCE (not getAuthToken)
 */

import {
  setupDailyAlarms,
  setupNotionSyncAlarm,
  ALARM_NAMES,
  type DailyAlarmName,
} from './alarm-scheduler';
import { generateIconDataUrl, updateBadgeForTasks } from './badge-manager';
import { extractPageContext, extractCapturePayload } from '../content/dom-extractor';
import {
  getNotionTaskDetails,
  injectNotionTaskStrategy,
  cleanNotionApiKey,
  extractNotionDatabaseId,
} from '../core/storage/notion-client';
import {
  createNotionTask,
  appendNotionTaskContext,
  inspectDatabaseSchema,
} from '../core/storage/notion-create';
import {
  fetchNotionAvailableStatuses,
  syncNotionTasksWithStatuses,
} from '../core/storage/notion-sync';
import { checkGitHubForUpdates } from '../core/updater/github-updater';
import type { LLMProviderConfig } from '../types/schema';

// ──────────────────────────────────────────────────────────
//  Alarm notification metadata (no global mutable state)
// ──────────────────────────────────────────────────────────

const ALARM_META: Record<DailyAlarmName, { id: string; title: string; message: string }> = {
  [ALARM_NAMES.MORNING_TRIAGE]: {
    id: 'triage-alert',
    title: 'Senior PO Morning Triage',
    message: 'Lock in your 1–2 Must-Win outcomes and set missing deadlines.',
  },
  [ALARM_NAMES.MIDDAY_DRIFT_CHECK]: {
    id: 'drift-alert',
    title: 'Midday Drift Check',
    message: 'Are you still on your Must-Wins, or have you drifted to firefighting?',
  },
  [ALARM_NAMES.EOD_FOLLOWUP_SWEEP]: {
    id: 'eod-alert',
    title: 'EOD Follow-up Sweep',
    message: 'Review today\'s progress and queue follow-ups for tomorrow.',
  },
};

// ──────────────────────────────────────────────────────────
//  Google Drive constants
// ──────────────────────────────────────────────────────────

const GDRIVE_FOLDER_NAME = 'PO-Executive-Coach-Backups';
const GDRIVE_FILE_NAME = 'po-memory-store.json';

// ──────────────────────────────────────────────────────────
//  Extension Install & Side Panel (Edge + Chrome compatible)
// ──────────────────────────────────────────────────────────

export async function openExecutiveCoach(windowId?: number, tabId?: number) {
  // 1. Try native Chromium sidePanel API
  if (chrome.sidePanel?.open) {
    try {
      if (windowId) {
        await chrome.sidePanel.open({ windowId });
        return;
      } else if (tabId) {
        await chrome.sidePanel.open({ tabId });
        return;
      }
    } catch (err) {
      console.warn('[ServiceWorker] chrome.sidePanel.open failed, trying popup window fallback:', err);
    }
  }

  // 2. Fallback for Edge when sidePanel is restricted, disabled, or fails
  try {
    const sidePanelUrl = chrome.runtime.getURL('src/sidepanel/index.html');
    await chrome.windows.create({
      url: sidePanelUrl,
      type: 'popup',
      width: 440,
      height: 720,
      focused: true,
    });
  } catch (winErr) {
    console.error('[ServiceWorker] Fallback window creation failed:', winErr);
  }
}

// Enable openPanelOnActionClick for browsers that support it (Chrome 116+)
try {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => {
        console.warn('[ServiceWorker] setPanelBehavior not supported or failed:', err);
      });
  }
} catch (err) {
  console.warn('[ServiceWorker] setPanelBehavior error:', err);
}

// Critical for Microsoft Edge: toolbar action icon clicks trigger action.onClicked
if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    await openExecutiveCoach(tab?.windowId, tab?.id);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupDailyAlarms();

  // Initialize Notion delta sync alarm if configured
  chrome.storage.local.get('po_notion_config', (res: Record<string, any>) => {
    const mins = res?.po_notion_config?.syncIntervalMinutes;
    if (mins && mins > 0) {
      setupNotionSyncAlarm(mins);
    }
  });

  // Register context menu items
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'po-coach-open-sidepanel',
        title: '🚀 Open PO Executive Coach',
        contexts: ['action', 'page'],
      });
      chrome.contextMenus.create({
        id: 'po-coach-capture-to-notion',
        title: '🎯 PO Coach: Capture to Notion',
        contexts: ['selection', 'page'],
      });
    });
  } catch (err) {
    console.warn('[ServiceWorker] contextMenus setup failed:', err);
  }
});

// ──────────────────────────────────────────────────────────
//  Context Menu & Command Triggers
// ──────────────────────────────────────────────────────────

async function triggerCaptureForTab(tabId: number, windowId?: number, explicitText?: string) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractCapturePayload,
      args: [explicitText || ''],
    });

    const payload = results?.[0]?.result;
    if (payload) {
      await chrome.storage.local.set({ _pendingCapture: payload });
      await openExecutiveCoach(windowId, tabId);
      chrome.runtime.sendMessage({ type: 'CAPTURE_READY', payload }).catch(() => {});
    }
  } catch (err) {
    console.warn('[ServiceWorker] triggerCaptureForTab failed:', err);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'po-coach-open-sidepanel') {
    await openExecutiveCoach(tab?.windowId, tab?.id);
  } else if (info.menuItemId === 'po-coach-capture-to-notion' && tab?.id) {
    await triggerCaptureForTab(tab.id, tab.windowId, info.selectionText);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-to-notion') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      await triggerCaptureForTab(activeTab.id, activeTab.windowId);
    }
  }
});

// ──────────────────────────────────────────────────────────
//  Alarms Handler
// ──────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  // Handle background Notion delta sync alarm
  if (alarm.name === ALARM_NAMES.NOTION_DELTA_SYNC) {
    (async () => {
      try {
        await syncNotionTasksWithStatuses({ isDelta: true });
      } catch (err) {
        console.warn('[ServiceWorker] Background Notion delta sync failed:', err);
      }
    })();
    return;
  }

  const meta = ALARM_META[alarm.name as DailyAlarmName];
  if (!meta) return;

  // Generate icon dynamically (no file dependency)
  (async () => {
    try {
      const iconUrl = await generateIconDataUrl(128);
      chrome.notifications.create(meta.id, {
        type: 'basic',
        iconUrl,
        title: meta.title,
        message: meta.message,
        requireInteraction: true,
      });
    } catch (err) {
      // Fallback: create notification without icon if canvas fails
      console.warn('[ServiceWorker] Icon generation failed, using fallback', err);
      chrome.notifications.create(meta.id, {
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        title: meta.title,
        message: meta.message,
        requireInteraction: true,
      });
    }
  })();
});

// ──────────────────────────────────────────────────────────
//  Active Tab Tracking (Pitfall #3)
//  Persisted to chrome.storage.local — never global vars
// ──────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.storage.local.set({ _activeTabId: activeInfo.tabId });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get('_activeTabId', (data) => {
      if (data._activeTabId === tabId) {
        // Notify the side panel that the active tab's content changed
        chrome.runtime.sendMessage({ type: 'ACTIVE_TAB_UPDATED', tabId }).catch(() => {
          // Side panel may not be open — that's fine
        });
      }
    });
  }
});

// ──────────────────────────────────────────────────────────
//  Message Router
//  PITFALL #2: Never put `async` on the addListener callback.
//  Return `true` to keep the message channel open, then use
//  an inner IIFE to handle the async work.
// ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; [key: string]: any },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): boolean | undefined => {
    switch (message.type) {
      // ── Grab the current tab's DOM context ──
      case 'GRAB_TAB_CONTEXT': {
        (async () => {
          try {
            const result = await chrome.storage.local.get('_activeTabId');
            let tabId = result._activeTabId as number | undefined;

            if (!tabId && chrome.tabs?.query) {
              const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
              tabId = activeTab?.id;
            }

            if (!tabId) {
              sendResponse({ ok: false, error: 'No active tab found. Please focus a browser tab and try again.' });
              return;
            }

            if (chrome.scripting?.executeScript) {
              const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: extractPageContext,
              });

              const extracted = results?.[0]?.result ?? '';
              sendResponse({ ok: true, data: extracted });
            } else {
              sendResponse({ ok: false, error: 'Scripting API is not supported in this environment' });
            }
          } catch (err) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true; // keep channel open for async response
      }

      // ── Fetch available statuses from Notion Database ──
      case 'FETCH_NOTION_STATUSES': {
        (async () => {
          try {
            const result = await fetchNotionAvailableStatuses(message.config);
            sendResponse(result);
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err?.message || err) });
          }
        })();
        return true;
      }

      // ── Fetch or Delta Sync tasks from Notion (filtered by selected statuses) ──
      case 'FETCH_NOTION_TASKS': {
        (async () => {
          try {
            const result = await syncNotionTasksWithStatuses({
              config: message.config,
              selectedStatuses: message.selectedStatuses,
              isDelta: Boolean(message.isDelta),
            });
            sendResponse(result);
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err?.message || err) });
          }
        })();
        return true;
      }

      // ── Configure background Notion Delta Sync alarm interval ──
      case 'CONFIGURE_NOTION_SYNC_ALARM': {
        setupNotionSyncAlarm(message.syncIntervalMinutes);
        sendResponse({ ok: true });
        return undefined;
      }

      // ── Google Drive OAuth (Edge-safe: launchWebAuthFlow) ──
      case 'GDRIVE_AUTH': {
        (async () => {
          try {
            const { clientId } = message as { clientId: string; type: string };
            const redirectUrl = chrome.identity.getRedirectURL();

            const scopes = encodeURIComponent(
              'https://www.googleapis.com/auth/drive.file'
            );

            const authUrl =
              `https://accounts.google.com/o/oauth2/v2/auth` +
              `?client_id=${encodeURIComponent(clientId)}` +
              `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
              `&response_type=token` +
              `&scope=${scopes}` +
              `&prompt=consent`;

            const responseUrl = await chrome.identity.launchWebAuthFlow({
              url: authUrl,
              interactive: true,
            });

            if (!responseUrl) {
              sendResponse({ ok: false, error: 'Auth flow returned no URL' });
              return;
            }

            // Extract access_token from the fragment
            const hashParams = new URLSearchParams(
              responseUrl.split('#')[1] || ''
            );
            const token = hashParams.get('access_token');

            if (!token) {
              sendResponse({ ok: false, error: 'No access_token in response' });
              return;
            }

            sendResponse({ ok: true, data: { token } });
          } catch (err) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Upload memory to Google Drive ──
      case 'GDRIVE_UPLOAD': {
        (async () => {
          try {
            const { token, data } = message as {
              token: string;
              data: object;
              type: string;
            };

            // Find or create the backup folder
            const folderId = await findOrCreateGDriveFolder(token, GDRIVE_FOLDER_NAME);

            // Check for existing file
            const existingFileId = await findGDriveFile(token, GDRIVE_FILE_NAME, folderId);

            const metadata = {
              name: GDRIVE_FILE_NAME,
              mimeType: 'application/json',
              ...(existingFileId ? {} : { parents: [folderId] }),
            };

            const boundary = '----PO_COACH_BOUNDARY';
            const body =
              `--${boundary}\r\n` +
              `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
              `${JSON.stringify(metadata)}\r\n` +
              `--${boundary}\r\n` +
              `Content-Type: application/json\r\n\r\n` +
              `${JSON.stringify(data, null, 2)}\r\n` +
              `--${boundary}--`;

            const uploadUrl = existingFileId
              ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
              : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

            const method = existingFileId ? 'PATCH' : 'POST';

            const response = await fetch(uploadUrl, {
              method,
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body,
            });

            if (!response.ok) {
              const text = await response.text();
              sendResponse({ ok: false, error: `GDrive upload ${response.status}: ${text}` });
              return;
            }

            const result = await response.json();
            sendResponse({ ok: true, data: { fileId: result.id } });
          } catch (err) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Download memory from Google Drive ──
      case 'GDRIVE_DOWNLOAD': {
        (async () => {
          try {
            const { token } = message as { token: string; type: string };

            const folderId = await findOrCreateGDriveFolder(token, GDRIVE_FOLDER_NAME);
            const fileId = await findGDriveFile(token, GDRIVE_FILE_NAME, folderId);

            if (!fileId) {
              sendResponse({ ok: true, data: null }); // no backup exists yet
              return;
            }

            const response = await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (!response.ok) {
              const text = await response.text();
              sendResponse({ ok: false, error: `GDrive download ${response.status}: ${text}` });
              return;
            }

            const data = await response.json();
            sendResponse({ ok: true, data });
          } catch (err) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Get detailed body blocks of a Notion task (checks for existing strategy & extracts context) ──
      // ── Get detailed body blocks of a Notion task (checks for existing strategy & extracts context) ──
      case 'GET_NOTION_TASK_DETAILS': {
        (async () => {
          try {
            const stored = (await chrome.storage.local.get('po_notion_config')) as {
              po_notion_config?: { apiKey?: string; notionProxyUrl?: string; proxyUrl?: string };
            };
            const apiKey = (message.apiKey || stored.po_notion_config?.apiKey || '').trim();
            const proxyUrl = (message.proxyUrl || message.notionProxyUrl || stored.po_notion_config?.notionProxyUrl || stored.po_notion_config?.proxyUrl || '').trim();
            if (!apiKey) {
              sendResponse({ ok: false, error: 'Notion API key is missing. Check Settings.' });
              return;
            }
            const res = await getNotionTaskDetails({ apiKey, proxyUrl }, message.taskId);
            sendResponse(res);
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Inject or replace Coach Strategy block in Notion ──
      case 'INJECT_NOTION_STRATEGY': {
        (async () => {
          try {
            const stored = (await chrome.storage.local.get('po_notion_config')) as {
              po_notion_config?: { apiKey?: string; notionProxyUrl?: string; proxyUrl?: string };
            };
            const apiKey = (message.apiKey || stored.po_notion_config?.apiKey || '').trim();
            const proxyUrl = (message.proxyUrl || message.notionProxyUrl || stored.po_notion_config?.notionProxyUrl || stored.po_notion_config?.proxyUrl || '').trim();
            if (!apiKey) {
              sendResponse({ ok: false, error: 'Notion API key is missing. Check Settings.' });
              return;
            }
            const res = await injectNotionTaskStrategy(
              { apiKey, proxyUrl },
              message.taskId,
              message.strategyText,
              message.existingBlockId
            );
            sendResponse(res);
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Text selection from content script — store in session ──
      case 'TEXT_SELECTED': {
        const { text, url } = message as { text: string; url: string; type: string };
        chrome.storage.local.set({
          _lastSelection: { text: text.slice(0, 5000), url, timestamp: Date.now() },
        });
        // Synchronous — no need to return true
        return undefined;
      }

      // ── Executive Capture payload from content script ──
      case 'EXECUTIVE_CAPTURE': {
        (async () => {
          try {
            const payload = message.payload;
            await chrome.storage.local.set({ _pendingCapture: payload });

            // Attempt to open sidepanel in the current window
            const senderWindowId = _sender.tab?.windowId;
            if (senderWindowId && (chrome.sidePanel as any)?.open) {
              try {
                await (chrome.sidePanel as any).open({ windowId: senderWindowId });
              } catch {}
            }

            // Notify sidepanel if already mounted
            chrome.runtime.sendMessage({ type: 'CAPTURE_READY', payload }).catch(() => {});
            sendResponse({ ok: true });
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Create brand new Notion Task page ──
      case 'CREATE_NOTION_TASK': {
        (async () => {
          try {
            let config = message.config;
            const stored = (await chrome.storage.local.get('po_notion_config')) as {
              po_notion_config?: { apiKey?: string; databaseId?: string; notionProxyUrl?: string; proxyUrl?: string };
            };
            config = {
              apiKey: config?.apiKey || stored.po_notion_config?.apiKey || '',
              databaseId: config?.databaseId || stored.po_notion_config?.databaseId || '',
              notionProxyUrl: config?.notionProxyUrl || config?.proxyUrl || stored.po_notion_config?.notionProxyUrl || stored.po_notion_config?.proxyUrl || '',
            };

            const result = await createNotionTask(config, message.payload);
            if (result.ok && result.taskId) {
              // Clear pending capture once successfully created
              await chrome.storage.local.remove('_pendingCapture');

              // Optimistically prepend task to local task cache
              const storedTasksRes = await chrome.storage.local.get('po_tasks');
              const existingTasks = Array.isArray(storedTasksRes.po_tasks) ? storedTasksRes.po_tasks : [];
              const newTask = {
                id: result.taskId,
                title: result.taskTitle || message.payload.title,
                status: message.payload.status || 'To Do',
                dueDate: message.payload.dueDate || null,
                priority: message.payload.priority || 'None',
                url: result.taskUrl || '',
                coachStrategy: message.payload.strategyText,
                coachStrategyUpdatedAt: message.payload.strategyText ? new Date().toISOString() : undefined,
              };
              await chrome.storage.local.set({ po_tasks: [newTask, ...existingTasks] });
              await updateBadgeForTasks([newTask, ...existingTasks]);
            }

            sendResponse(result);
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Append captured context to an existing Notion Task ──
      case 'APPEND_NOTION_CONTEXT': {
        (async () => {
          try {
            let config = message.config;
            const stored = (await chrome.storage.local.get('po_notion_config')) as {
              po_notion_config?: { apiKey?: string; notionProxyUrl?: string; proxyUrl?: string };
            };
            config = {
              apiKey: config?.apiKey || stored.po_notion_config?.apiKey || '',
              notionProxyUrl: config?.notionProxyUrl || config?.proxyUrl || stored.po_notion_config?.notionProxyUrl || stored.po_notion_config?.proxyUrl || '',
            };

            const result = await appendNotionTaskContext(config, message.payload);
            if (result.ok) {
              await chrome.storage.local.remove('_pendingCapture');
            }
            sendResponse(result);
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Clear pending capture from storage ──
      case 'CLEAR_PENDING_CAPTURE': {
        chrome.storage.local.remove('_pendingCapture');
        sendResponse({ ok: true });
        return undefined;
      }

      // ── Manually trigger capture for the current active tab ──
      case 'TRIGGER_ACTIVE_TAB_CAPTURE': {
        (async () => {
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id) {
              await triggerCaptureForTab(activeTab.id, activeTab.windowId);
            }
            sendResponse({ ok: true });
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Fetch Notion database schema metadata (status & priority options) ──
      case 'FETCH_NOTION_METADATA': {
        (async () => {
          try {
            let config = message.config;
            const stored = (await chrome.storage.local.get('po_notion_config')) as {
              po_notion_config?: { apiKey?: string; databaseId?: string; notionProxyUrl?: string; proxyUrl?: string };
            };
            config = {
              apiKey: config?.apiKey || stored.po_notion_config?.apiKey || '',
              databaseId: config?.databaseId || stored.po_notion_config?.databaseId || '',
              notionProxyUrl: config?.notionProxyUrl || config?.proxyUrl || stored.po_notion_config?.notionProxyUrl || stored.po_notion_config?.proxyUrl || '',
            };

            const cleanKey = cleanNotionApiKey(config?.apiKey || '');
            const cleanDbId = extractNotionDatabaseId(config?.databaseId || '');
            const proxyUrl = (config?.notionProxyUrl || '').trim();

            if (!cleanKey || !cleanDbId) {
              sendResponse({ ok: false, error: 'Notion configuration is missing or invalid.' });
              return;
            }

            const schema = await inspectDatabaseSchema(cleanKey, cleanDbId, proxyUrl);
            sendResponse({ ok: true, data: schema });
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── Fetch list of available models for an LLM provider ──
      case 'FETCH_PROVIDER_MODELS': {
        (async () => {
          // Known popular models fallback in case an API endpoint is offline or requires authentication
          const FALLBACK_MODELS_MAP: Record<string, string[]> = {
            nvidia: [
              'meta/llama-3.3-70b-instruct',
              'meta/llama-3.1-70b-instruct',
              'meta/llama-3.1-8b-instruct',
              'nvidia/llama-3.1-nemotron-70b-instruct',
              'nvidia/llama-3.1-nemotron-51b-instruct',
              'deepseek-ai/deepseek-r1',
              'mistralai/mistral-large-2-instruct',
              'mistralai/mixtral-8x22b-instruct-v0.1',
              'qwen/qwen2.5-72b-instruct',
            ],
            groq: [
              'llama-3.3-70b-versatile',
              'llama-3.1-8b-instant',
              'llama-3.2-11b-vision-preview',
              'llama-3.2-3b-preview',
              'mixtral-8x7b-32768',
              'gemma2-9b-it',
            ],
            gemini: [
              'gemini-3.8-flash',
              'gemini-2.5-flash',
              'gemini-2.5-pro',
              'gemini-2.0-flash',
              'gemini-2.0-flash-lite',
              'gemini-1.5-pro',
              'gemini-1.5-flash',
            ],
            anthropic: [
              'claude-3-7-sonnet-20250219',
              'claude-3-5-sonnet-20241022',
              'claude-3-5-haiku-20241022',
              'claude-3-opus-20240229',
              'claude-sonnet-4-20250514',
            ],
            openai: [
              'gpt-4o',
              'gpt-4o-mini',
              'o1',
              'o1-mini',
              'o3-mini',
              'gpt-4-turbo',
            ],
            cerebras: [
              'llama-3.3-70b',
              'llama3.1-8b',
              'llama3.1-70b',
            ],
            mistral: [
              'mistral-large-latest',
              'mistral-small-latest',
              'codestral-latest',
              'open-mixtral-8x22b',
            ],
            openrouter: [
              'meta-llama/llama-3.3-70b-instruct',
              'deepseek/deepseek-r1',
              'anthropic/claude-3.5-sonnet',
              'google/gemini-2.0-flash-001',
              'openai/gpt-4o-mini',
            ],
          };

          try {
            const provider = message.provider as LLMProviderConfig;
            if (!provider) {
              sendResponse({ ok: false, error: 'No provider configuration provided.' });
              return;
            }

            const cleanKey = (provider.apiKey || '').trim();
            const cleanBaseUrl = (provider.baseUrl || '').trim().replace(/\/+$/, '');

            if (!cleanBaseUrl) {
              sendResponse({ ok: false, error: 'Provider Base URL is required.' });
              return;
            }

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };

            let fetchUrl = `${cleanBaseUrl}/models`;

            if (provider.format === 'anthropic-native') {
              if (cleanKey) headers['x-api-key'] = cleanKey;
              headers['anthropic-version'] = '2023-06-01';
              headers['anthropic-dangerous-direct-browser-access'] = 'true';
              fetchUrl = `${cleanBaseUrl}/v1/models`;
            } else if (provider.id === 'gemini' || cleanBaseUrl.includes('generativelanguage.googleapis.com')) {
              // Canonical Google Gemini models listing endpoint
              const queryKey = cleanKey ? `?key=${encodeURIComponent(cleanKey)}&pageSize=1000` : '?pageSize=1000';
              fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models${queryKey}`;
              if (cleanKey) headers['x-goog-api-key'] = cleanKey;
            } else if (provider.id === 'nvidia' || cleanBaseUrl.includes('integrate.api.nvidia.com')) {
              fetchUrl = 'https://integrate.api.nvidia.com/v1/models';
              if (cleanKey) headers['Authorization'] = `Bearer ${cleanKey}`;
            } else {
              if (cleanKey) headers['Authorization'] = `Bearer ${cleanKey}`;
            }

            let resp: Response | null = null;
            let fetchError: string | null = null;

            try {
              resp = await fetch(fetchUrl, {
                method: 'GET',
                headers,
              });
            } catch (err: any) {
              fetchError = err?.message || 'Network request failed';
            }

            // If 404, try alternative endpoints (e.g. /v1/models or local Ollama /api/tags)
            if (resp && !resp.ok && resp.status === 404) {
              if (!cleanBaseUrl.endsWith('/v1') && !fetchUrl.includes('/v1/models')) {
                try {
                  const altResp = await fetch(`${cleanBaseUrl}/v1/models`, { method: 'GET', headers });
                  if (altResp.ok) resp = altResp;
                } catch {}
              }
              if ((!resp || !resp.ok) && (cleanBaseUrl.includes('localhost') || cleanBaseUrl.includes('127.0.0.1'))) {
                try {
                  const altUrl = cleanBaseUrl.replace(/\/v1$/, '') + '/api/tags';
                  const altResp = await fetch(altUrl, { method: 'GET', headers });
                  if (altResp.ok) resp = altResp;
                } catch {}
              }
            }

            let modelList: string[] = [];

            if (resp && resp.ok) {
              const data = await resp.json().catch(() => null);
              if (data) {
                if (Array.isArray(data.data)) {
                  modelList = data.data
                    .map((m: any) => (typeof m === 'string' ? m : m.id || m.name || m.model || ''))
                    .filter(Boolean);
                } else if (Array.isArray(data.models)) {
                  modelList = data.models
                    .map((m: any) => (typeof m === 'string' ? m : m.name || m.id || m.model || ''))
                    .filter(Boolean);
                } else if (Array.isArray(data)) {
                  modelList = data
                    .map((m: any) => (typeof m === 'string' ? m : m.id || m.name || m.model || ''))
                    .filter(Boolean);
                }
              }
            }

            // Remove any prefix like "models/" from Gemini if present
            modelList = modelList.map((m) => m.replace(/^models\//, ''));

            // If Gemini, prioritize generative gemini models
            if (provider.id === 'gemini' || cleanBaseUrl.includes('generativelanguage.googleapis.com')) {
              const geminiModels = modelList.filter((m) => m.toLowerCase().includes('gemini'));
              if (geminiModels.length > 0) {
                modelList = geminiModels;
              }
            }

            // If fetch was unsuccessful or returned 0 models, use fallback catalog if known provider
            if (modelList.length === 0 && FALLBACK_MODELS_MAP[provider.id]) {
              modelList = FALLBACK_MODELS_MAP[provider.id];
            }

            if (modelList.length === 0) {
              let errMsg = fetchError || (resp ? `HTTP ${resp.status}: ${resp.statusText}` : 'No models returned from provider');
              if (resp) {
                try {
                  const errJson = await resp.json();
                  errMsg = errJson.error?.message || errJson.message || errMsg;
                } catch {}
              }
              sendResponse({ ok: false, error: errMsg });
              return;
            }

            // De-duplicate
            modelList = Array.from(new Set(modelList));

            // Sort models alphabetically, prioritizing chat/instruct models
            modelList.sort((a, b) => {
              const aIsChat = /chat|instruct|llama|gpt|claude|gemini|mixtral|qwen|nemotron|deepseek/i.test(a);
              const bIsChat = /chat|instruct|llama|gpt|claude|gemini|mixtral|qwen|nemotron|deepseek/i.test(b);
              if (aIsChat && !bIsChat) return -1;
              if (!aIsChat && bIsChat) return 1;
              return a.localeCompare(b);
            });

            // Return both data and models fields for complete backwards/frontwards compatibility
            sendResponse({ ok: true, data: modelList, models: modelList });
          } catch (err: any) {
            sendResponse({ ok: false, error: String(err) });
          }
        })();
        return true;
      }

      case 'CHECK_GITHUB_UPDATE': {
        (async () => {
          try {
            const result = await checkGitHubForUpdates(message.config);
            sendResponse(result);
          } catch (err: any) {
            sendResponse({
              ok: false,
              currentVersion: '0.1.1',
              latestVersion: '0.1.1',
              hasUpdate: false,
              source: 'github-release',
              error: String(err?.message || err),
            });
          }
        })();
        return true;
      }

      default:
        // Unknown message type — don't hold the channel open
        return undefined;
    }
  }
);

// ──────────────────────────────────────────────────────────
//  Google Drive Helpers (private to this module)
// ──────────────────────────────────────────────────────────

/**
 * Find a folder by name in Google Drive, or create it if absent.
 * Returns the folder ID.
 */
async function findOrCreateGDriveFolder(
  token: string,
  folderName: string
): Promise<string> {
  const query = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (searchRes.ok) {
    const searchJson = await searchRes.json();
    if (searchJson.files?.length > 0) {
      return searchJson.files[0].id;
    }
  }

  // Create the folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const created = await createRes.json();
  return created.id;
}

/**
 * Find a file by name inside a specific folder. Returns the file ID or null.
 */
async function findGDriveFile(
  token: string,
  fileName: string,
  folderId: string
): Promise<string | null> {
  const query = encodeURIComponent(
    `name='${fileName}' and '${folderId}' in parents and trashed=false`
  );

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return null;

  const json = await res.json();
  return json.files?.[0]?.id ?? null;
}