/**
 * Typed wrapper around chrome.storage.local.
 *
 * Critical pitfall #1: NEVER store state in service worker globals.
 * Edge kills SW after 30s. ALL persistent state flows through here.
 */

import type {
  POMemoryStore,
  LLMProviderConfig,
  RouterSettings,
} from '../../types/schema';

// ── Exported ChatMessage type ──

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ── Storage key constants ──

const KEYS = {
  MEMORY_STORE: 'po_memory',
  LEGACY_MEMORY_STORE: 'po_memory_store',
  PROVIDERS: 'po_providers',
  LEGACY_PROVIDERS: 'po_llm_providers',
  ROUTER_SETTINGS: 'po_router_settings',
  ACTIVE_TAB_CONTEXT: 'po_active_tab_context',
  chatHistory: (sessionId: string) => `po_chat_${sessionId}`,
} as const;

// ── Defaults ──

function defaultMemoryStore(): POMemoryStore {
  return {
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
}

function defaultRouterSettings(): RouterSettings {
  return {
    primaryProviderId: '',
    fallbackProviderIds: [],
    strictWorkPrivacyMode: false,
  };
}

// ── Typed helpers ──

async function storageGet<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function storageSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// ── Public API ──

export async function loadMemoryStore(): Promise<POMemoryStore> {
  const stored = await storageGet<POMemoryStore>(KEYS.MEMORY_STORE);
  if (stored) return stored;
  const legacyStored = await storageGet<POMemoryStore>(KEYS.LEGACY_MEMORY_STORE);
  return legacyStored ?? defaultMemoryStore();
}

export async function saveMemoryStore(store: POMemoryStore): Promise<void> {
  store.lastUpdatedISO = new Date().toISOString();
  await chrome.storage.local.set({
    [KEYS.MEMORY_STORE]: store,
    [KEYS.LEGACY_MEMORY_STORE]: store,
  });
}

export async function loadChatHistory(
  sessionId: string
): Promise<ChatMessage[]> {
  const stored = await storageGet<ChatMessage[]>(
    KEYS.chatHistory(sessionId)
  );
  return stored ?? [];
}

export async function saveChatHistory(
  sessionId: string,
  messages: ChatMessage[]
): Promise<void> {
  await storageSet(KEYS.chatHistory(sessionId), messages);
}

export async function loadProviders(): Promise<
  Record<string, LLMProviderConfig>
> {
  const stored = await storageGet<Record<string, LLMProviderConfig>>(
    KEYS.PROVIDERS
  );
  if (stored) return stored;
  const legacyStored = await storageGet<Record<string, LLMProviderConfig>>(
    KEYS.LEGACY_PROVIDERS
  );
  return legacyStored ?? {};
}

export async function saveProviders(
  providers: Record<string, LLMProviderConfig>
): Promise<void> {
  await chrome.storage.local.set({
    [KEYS.PROVIDERS]: providers,
    [KEYS.LEGACY_PROVIDERS]: providers,
  });
}

export async function loadRouterSettings(): Promise<RouterSettings> {
  const stored = await storageGet<RouterSettings>(KEYS.ROUTER_SETTINGS);
  return stored ?? defaultRouterSettings();
}

export async function saveRouterSettings(
  settings: RouterSettings
): Promise<void> {
  await storageSet(KEYS.ROUTER_SETTINGS, settings);
}

export async function getActiveTabContext(): Promise<string | null> {
  const stored = await storageGet<string>(KEYS.ACTIVE_TAB_CONTEXT);
  return stored ?? null;
}

export async function setActiveTabContext(context: string): Promise<void> {
  await storageSet(KEYS.ACTIVE_TAB_CONTEXT, context);
}
