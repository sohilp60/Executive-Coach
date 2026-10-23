import type {
  ExtensionBackupBundle,
  GitHubUpdateConfig,
  LLMProviderConfig,
  NotionConfig,
  NotionTask,
  POMemoryStore,
  RouterSettings,
} from '../../types/schema';
import { getCurrentExtensionVersion, DEFAULT_GITHUB_UPDATE_CONFIG } from '../updater/github-updater';

const BACKUP_SCHEMA_VERSION = 2;

const DEFAULT_MEMORY: POMemoryStore = {
  version: 1,
  lastUpdatedISO: new Date().toISOString(),
  userProfile: {
    role: '',
    platformDomain: '',
    coreResponsibilities: [],
    procrastinationTriggers: [],
  },
  teamAndStakeholders: [],
  productRulesAndContext: [],
  dailyCommitmentsLog: {},
};

const DEFAULT_ROUTER: RouterSettings = {
  primaryProviderId: '',
  fallbackProviderIds: [],
  strictWorkPrivacyMode: false,
};

export interface BackupExportOptions {
  includeCredentials?: boolean;
  includeTasksAndChat?: boolean;
}

export interface BackupRestoreResult {
  ok: boolean;
  bundle?: ExtensionBackupBundle;
  summary: {
    providersCount: number;
    stakeholdersCount: number;
    rulesCount: number;
    tasksCount: number;
    chatMessagesCount: number;
    notionConfigured: boolean;
  };
  error?: string;
}

/**
 * Collects all extension configurations, credentials, tasks, chat history, and PO memory
 * from chrome.storage.local into a portable JSON bundle.
 */
export async function createExtensionBackupBundle(
  options: BackupExportOptions = { includeCredentials: true, includeTasksAndChat: true }
): Promise<ExtensionBackupBundle> {
  const includeCredentials = options.includeCredentials ?? true;
  const includeTasksAndChat = options.includeTasksAndChat ?? true;

  const raw = (await chrome.storage.local.get([
    'po_memory',
    'po_memory_store',
    'po_providers',
    'po_llm_providers',
    'po_router_settings',
    'po_notion_config',
    'po_gdrive_client_id',
    'po_tasks',
    'po_chat_history',
    'po_theme',
    'po_github_update_config',
  ])) as Record<string, any>;

  const memory: POMemoryStore =
    (raw.po_memory as POMemoryStore) ||
    (raw.po_memory_store as POMemoryStore) ||
    DEFAULT_MEMORY;

  const storedProviders: Record<string, LLMProviderConfig> =
    (raw.po_providers as Record<string, LLMProviderConfig>) ||
    (raw.po_llm_providers as Record<string, LLMProviderConfig>) ||
    {};

  // Clone providers and optionally scrub API keys if user disabled includeCredentials
  const exportedProviders: Record<string, LLMProviderConfig> = {};
  for (const [id, prov] of Object.entries(storedProviders)) {
    exportedProviders[id] = {
      ...prov,
      apiKey: includeCredentials ? prov.apiKey || '' : '',
    };
  }

  const routerSettings: RouterSettings =
    (raw.po_router_settings as RouterSettings) || DEFAULT_ROUTER;

  const rawNotion: NotionConfig = (raw.po_notion_config as NotionConfig) || {
    apiKey: '',
    databaseId: '',
  };

  const notionConfig: NotionConfig = {
    ...rawNotion,
    apiKey: includeCredentials ? rawNotion.apiKey || '' : '',
    databaseId: rawNotion.databaseId || '',
    notionProxyUrl: rawNotion.notionProxyUrl || rawNotion.proxyUrl || '',
    selectedStatuses: rawNotion.selectedStatuses || [],
    availableStatuses: rawNotion.availableStatuses || [],
    syncIntervalMinutes: rawNotion.syncIntervalMinutes ?? 0,
    lastSyncedAtISO: rawNotion.lastSyncedAtISO,
  };

  const gdriveClientId: string = includeCredentials ? String(raw.po_gdrive_client_id || '') : '';

  const rawGithubCfg: GitHubUpdateConfig =
    (raw.po_github_update_config as GitHubUpdateConfig) || DEFAULT_GITHUB_UPDATE_CONFIG;

  const githubUpdateConfig: GitHubUpdateConfig = {
    ...rawGithubCfg,
    githubToken: includeCredentials ? rawGithubCfg.githubToken || '' : '',
  };

  const tasks: NotionTask[] = includeTasksAndChat && Array.isArray(raw.po_tasks) ? raw.po_tasks : [];
  const chatHistory =
    includeTasksAndChat && Array.isArray(raw.po_chat_history) ? raw.po_chat_history : [];
  const theme: 'dark' | 'light' =
    raw.po_theme === 'light' || raw.po_theme === 'dark' ? raw.po_theme : 'dark';

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: 'po-executive-coach',
    exportedAtISO: new Date().toISOString(),
    extensionVersion: getCurrentExtensionVersion(),
    includesCredentials: includeCredentials,
    data: {
      memory,
      providers: exportedProviders,
      routerSettings,
      notionConfig,
      gdriveClientId,
      tasks,
      chatHistory,
      theme,
      githubUpdateConfig,
    },
  };
}

/**
 * Triggers a browser file download of the backup JSON bundle.
 */
export function downloadBackupBundleFile(bundle: ExtensionBackupBundle): string {
  const datePart = bundle.exportedAtISO.split('T')[0];
  const fileName = `po-executive-coach-backup-${datePart}.json`;
  const jsonString = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return fileName;
}

/**
 * Validates and restores an exported backup JSON string into chrome.storage.local.
 * Supports both full `ExtensionBackupBundle` files and standalone `POMemoryStore` JSON files.
 */
export async function restoreExtensionBackupFromJson(
  rawJsonText: string
): Promise<BackupRestoreResult> {
  const emptySummary = {
    providersCount: 0,
    stakeholdersCount: 0,
    rulesCount: 0,
    tasksCount: 0,
    chatMessagesCount: 0,
    notionConfigured: false,
  };

  let parsed: any;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch (err: any) {
    return {
      ok: false,
      summary: emptySummary,
      error: `Invalid JSON file: ${err?.message || 'Unable to parse JSON.'}`,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      summary: emptySummary,
      error: 'Backup file does not contain a valid JSON object.',
    };
  }

  // Case A: Full ExtensionBackupBundle (has `data` object with `memory` or `providers`)
  // Case B: Legacy / standalone POMemoryStore (has `userProfile` and `teamAndStakeholders`)
  let bundle: ExtensionBackupBundle;

  if (parsed.data && typeof parsed.data === 'object') {
    const d = parsed.data;
    const memory: POMemoryStore = d.memory && d.memory.userProfile ? d.memory : DEFAULT_MEMORY;
    const providers: Record<string, LLMProviderConfig> =
      d.providers && typeof d.providers === 'object' ? d.providers : {};
    const routerSettings: RouterSettings =
      d.routerSettings && typeof d.routerSettings === 'object'
        ? {
            primaryProviderId: String(d.routerSettings.primaryProviderId || ''),
            fallbackProviderIds: Array.isArray(d.routerSettings.fallbackProviderIds)
              ? d.routerSettings.fallbackProviderIds
              : [],
            strictWorkPrivacyMode: Boolean(d.routerSettings.strictWorkPrivacyMode),
          }
        : DEFAULT_ROUTER;

    const notionConfig: NotionConfig =
      d.notionConfig && typeof d.notionConfig === 'object'
        ? {
            apiKey: String(d.notionConfig.apiKey || ''),
            databaseId: String(d.notionConfig.databaseId || ''),
            notionProxyUrl: String(d.notionConfig.notionProxyUrl || d.notionConfig.proxyUrl || ''),
            selectedStatuses: Array.isArray(d.notionConfig.selectedStatuses)
              ? d.notionConfig.selectedStatuses
              : [],
            availableStatuses: Array.isArray(d.notionConfig.availableStatuses)
              ? d.notionConfig.availableStatuses
              : [],
            syncIntervalMinutes: Number(d.notionConfig.syncIntervalMinutes || 0),
            lastSyncedAtISO: d.notionConfig.lastSyncedAtISO,
          }
        : { apiKey: '', databaseId: '' };

    bundle = {
      schemaVersion: Number(parsed.schemaVersion || BACKUP_SCHEMA_VERSION),
      app: 'po-executive-coach',
      exportedAtISO: String(parsed.exportedAtISO || new Date().toISOString()),
      extensionVersion: String(parsed.extensionVersion || getCurrentExtensionVersion()),
      includesCredentials: Boolean(parsed.includesCredentials ?? true),
      data: {
        memory,
        providers,
        routerSettings,
        notionConfig,
        gdriveClientId: String(d.gdriveClientId || ''),
        tasks: Array.isArray(d.tasks) ? d.tasks : undefined,
        chatHistory: Array.isArray(d.chatHistory) ? d.chatHistory : undefined,
        theme: d.theme === 'light' || d.theme === 'dark' ? d.theme : undefined,
        githubUpdateConfig:
          d.githubUpdateConfig && typeof d.githubUpdateConfig === 'object'
            ? {
                ...DEFAULT_GITHUB_UPDATE_CONFIG,
                ...d.githubUpdateConfig,
              }
            : undefined,
      },
    };
  } else if (parsed.userProfile && Array.isArray(parsed.teamAndStakeholders)) {
    // Legacy memory-only JSON export
    const existing = await createExtensionBackupBundle();
    bundle = {
      ...existing,
      data: {
        ...existing.data,
        memory: {
          ...DEFAULT_MEMORY,
          ...parsed,
          lastUpdatedISO: new Date().toISOString(),
        },
      },
    };
  } else {
    return {
      ok: false,
      summary: emptySummary,
      error:
        'Unrecognized backup structure. Please select a valid PO Executive Coach backup (.json) file.',
    };
  }

  // Persist all restored state to chrome.storage.local
  const storagePayload: Record<string, any> = {
    po_memory: bundle.data.memory,
    po_memory_store: bundle.data.memory,
    po_providers: bundle.data.providers,
    po_llm_providers: bundle.data.providers,
    po_router_settings: bundle.data.routerSettings,
    po_notion_config: bundle.data.notionConfig,
  };

  if (bundle.data.gdriveClientId !== undefined) {
    storagePayload.po_gdrive_client_id = bundle.data.gdriveClientId;
  }
  if (Array.isArray(bundle.data.tasks)) {
    storagePayload.po_tasks = bundle.data.tasks;
  }
  if (Array.isArray(bundle.data.chatHistory)) {
    storagePayload.po_chat_history = bundle.data.chatHistory;
  }
  if (bundle.data.theme) {
    storagePayload.po_theme = bundle.data.theme;
  }
  if (bundle.data.githubUpdateConfig) {
    storagePayload.po_github_update_config = bundle.data.githubUpdateConfig;
  }

  await chrome.storage.local.set(storagePayload);

  // Reconfigure Notion background delta sync alarm if configured
  try {
    chrome.runtime.sendMessage({
      type: 'CONFIGURE_NOTION_SYNC_ALARM',
      syncIntervalMinutes: Number(bundle.data.notionConfig.syncIntervalMinutes || 0),
    });
  } catch {
    // Ignore in non-extension contexts
  }

  const providersCount = Object.keys(bundle.data.providers || {}).length;
  const stakeholdersCount = bundle.data.memory?.teamAndStakeholders?.length || 0;
  const rulesCount = bundle.data.memory?.productRulesAndContext?.length || 0;
  const tasksCount = bundle.data.tasks?.length || 0;
  const chatMessagesCount = bundle.data.chatHistory?.length || 0;
  const notionConfigured = Boolean(
    bundle.data.notionConfig?.apiKey && bundle.data.notionConfig?.databaseId
  );

  return {
    ok: true,
    bundle,
    summary: {
      providersCount,
      stakeholdersCount,
      rulesCount,
      tasksCount,
      chatMessagesCount,
      notionConfigured,
    },
  };
}
