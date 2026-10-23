import { useState, useEffect } from 'react';
import {
  Save,
  ArrowUp,
  ArrowDown,
  Zap,
  Key,
  Globe,
  Shield,
  TestTube,
  Check,
  AlertCircle,
  Loader2,
  Database,
  Cloud,
  Sun,
  Moon,
  Plus,
  Trash2,
  RefreshCw,
  Edit2,
  List,
  X,
  Cpu,
  Clock,
  Filter,
} from 'lucide-react';
import type { LLMProviderConfig, RouterSettings, ProviderFormat, NotionConfig } from '../../types/schema';

interface ProviderSettingsProps {
  providers: Record<string, LLMProviderConfig>;
  routerSettings: RouterSettings;
  persistProviders: (p: Record<string, LLMProviderConfig>) => void;
  persistRouterSettings: (s: RouterSettings) => void;
  theme?: 'dark' | 'light';
  setTheme?: (theme: 'dark' | 'light') => void;
}

interface ProviderTemplate {
  id: string;
  name: string;
  baseUrl: string;
  format: ProviderFormat;
  defaultModel: string;
  supportsNativeTools: boolean;
  zeroDataRetention: boolean;
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'groq',
    name: 'Groq (Free Tier)',
    baseUrl: 'https://api.groq.com/openai/v1',
    format: 'openai-compatible',
    defaultModel: 'llama-3.3-70b-versatile',
    supportsNativeTools: true,
    zeroDataRetention: true,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    format: 'openai-compatible',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    supportsNativeTools: true,
    zeroDataRetention: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    format: 'openai-compatible',
    defaultModel: 'gemini-3.8-flash',
    supportsNativeTools: true,
    zeroDataRetention: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    format: 'anthropic-native',
    defaultModel: 'claude-sonnet-4-20250514',
    supportsNativeTools: true,
    zeroDataRetention: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    format: 'openai-compatible',
    defaultModel: 'gpt-4o-mini',
    supportsNativeTools: true,
    zeroDataRetention: false,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    format: 'openai-compatible',
    defaultModel: 'llama-3.3-70b',
    supportsNativeTools: false,
    zeroDataRetention: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    format: 'openai-compatible',
    defaultModel: 'mistral-large-latest',
    supportsNativeTools: true,
    zeroDataRetention: false,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    format: 'openai-compatible',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    supportsNativeTools: false,
    zeroDataRetention: false,
  },
];

const CUSTOM_PRESETS: Array<{
  name: string;
  baseUrl: string;
  format: ProviderFormat;
  defaultModel: string;
  supportsNativeTools: boolean;
}> = [
  {
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    format: 'openai-compatible',
    defaultModel: 'llama3.2',
    supportsNativeTools: true,
  },
  {
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    format: 'openai-compatible',
    defaultModel: 'local-model',
    supportsNativeTools: true,
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    format: 'openai-compatible',
    defaultModel: 'deepseek-chat',
    supportsNativeTools: true,
  },
  {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    format: 'openai-compatible',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    supportsNativeTools: false,
  },
];

export default function ProviderSettings({
  providers,
  routerSettings,
  persistProviders,
  persistRouterSettings,
  theme = 'dark',
  setTheme,
}: ProviderSettingsProps) {
  const [localProviders, setLocalProviders] = useState<Record<string, LLMProviderConfig>>({});
  const [localRouter, setLocalRouter] = useState<RouterSettings>(routerSettings);
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [notionProxyUrl, setNotionProxyUrl] = useState('');
  const [notionSyncInterval, setNotionSyncInterval] = useState<number>(0);
  const [notionAvailableStatuses, setNotionAvailableStatuses] = useState<string[]>([]);
  const [notionSelectedStatuses, setNotionSelectedStatuses] = useState<string[]>([]);
  const [notionLastSyncedAt, setNotionLastSyncedAt] = useState<string | undefined>(undefined);
  const [isFetchingNotionStatuses, setIsFetchingNotionStatuses] = useState(false);
  const [isRunningDeltaNow, setIsRunningDeltaNow] = useState(false);
  const [gdriveClientId, setGdriveClientId] = useState('');
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({});
  const [saved, setSaved] = useState(false);

  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [notionFeedback, setNotionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dynamic model sync & custom providers state
  const [syncingModels, setSyncingModels] = useState<Record<string, boolean>>({});
  const [syncFeedback, setSyncFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string } | null>>({});
  const [manualModelInput, setManualModelInput] = useState<Record<string, boolean>>({});
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustom, setNewCustom] = useState<{
    name: string;
    baseUrl: string;
    format: ProviderFormat;
    apiKey: string;
    modelId: string;
    supportsNativeTools: boolean;
  }>({
    name: '',
    baseUrl: '',
    format: 'openai-compatible',
    apiKey: '',
    modelId: '',
    supportsNativeTools: true,
  });
  const [customFormError, setCustomFormError] = useState('');

  // Initialize providers from templates and existing config
  useEffect(() => {
    const merged: Record<string, LLMProviderConfig> = {};
    for (const tmpl of PROVIDER_TEMPLATES) {
      const existing = providers[tmpl.id];
      let modelId = existing?.modelId || tmpl.defaultModel;

      // Migrate legacy gemini models to the latest 3.8 flash
      if (tmpl.id === 'gemini') {
        if (!modelId || modelId === 'gemini-2.5-flash' || modelId === 'gemini-2.5' || modelId.includes('2.5-flash')) {
          modelId = 'gemini-3.8-flash';
        }
      }

      merged[tmpl.id] = {
        id: tmpl.id,
        name: tmpl.name,
        format: tmpl.format,
        baseUrl: existing?.baseUrl || tmpl.baseUrl,
        apiKey: existing?.apiKey || '',
        modelId,
        supportsNativeTools: existing?.supportsNativeTools ?? tmpl.supportsNativeTools,
        zeroDataRetention: existing?.zeroDataRetention ?? tmpl.zeroDataRetention,
        isCustom: false,
        cachedModels: existing?.cachedModels || [],
      };
    }

    // Preserve any existing custom providers
    for (const [id, prov] of Object.entries(providers)) {
      if (prov.isCustom && !merged[id]) {
        merged[id] = {
          ...prov,
          isCustom: true,
          cachedModels: prov.cachedModels || [],
        };
      }
    }

    setLocalProviders(merged);
    setLocalRouter(routerSettings);
  }, [providers, routerSettings]);

  // Load Notion and GDrive settings from storage
  useEffect(() => {
    chrome.storage.local.get(['po_notion_config', 'po_gdrive_client_id'], (result: Record<string, any>) => {
      if (result.po_notion_config) {
        const cfg = result.po_notion_config as NotionConfig;
        setNotionApiKey(cfg.apiKey || '');
        setNotionDbId(cfg.databaseId || '');
        setNotionProxyUrl(cfg.notionProxyUrl || cfg.proxyUrl || '');
        if (typeof cfg.syncIntervalMinutes === 'number') {
          setNotionSyncInterval(cfg.syncIntervalMinutes);
        }
        if (Array.isArray(cfg.availableStatuses)) {
          setNotionAvailableStatuses(cfg.availableStatuses);
        }
        if (Array.isArray(cfg.selectedStatuses)) {
          setNotionSelectedStatuses(cfg.selectedStatuses);
        }
        if (cfg.lastSyncedAtISO) {
          setNotionLastSyncedAt(cfg.lastSyncedAtISO);
        }
      }
      if (result.po_gdrive_client_id) {
        setGdriveClientId(result.po_gdrive_client_id as string);
      }
    });
  }, []);

  const updateProvider = (id: string, field: keyof LLMProviderConfig, value: any) => {
    setLocalProviders((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    // Clear any previous error when user edits
    setProviderErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const setPrimary = (id: string) => {
    setLocalRouter((prev) => ({
      ...prev,
      primaryProviderId: id,
      fallbackProviderIds: prev.fallbackProviderIds.filter((fid) => fid !== id),
    }));
  };

  const toggleFallback = (id: string) => {
    setLocalRouter((prev) => {
      const fallbacks = prev.fallbackProviderIds.includes(id)
        ? prev.fallbackProviderIds.filter((fid) => fid !== id)
        : [...prev.fallbackProviderIds, id];
      return { ...prev, fallbackProviderIds: fallbacks };
    });
  };

  const moveFallback = (id: string, direction: 'up' | 'down') => {
    setLocalRouter((prev) => {
      const fallbacks = [...prev.fallbackProviderIds];
      const idx = fallbacks.indexOf(id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= fallbacks.length) return prev;
      [fallbacks[idx], fallbacks[swapIdx]] = [fallbacks[swapIdx], fallbacks[idx]];
      return { ...prev, fallbackProviderIds: fallbacks };
    });
  };

  const handleSyncModels = async (id: string) => {
    const provider = localProviders[id];
    if (!provider) return;

    const isKeylessProvider =
      id === 'nvidia' ||
      id === 'openrouter' ||
      provider.baseUrl?.includes('localhost') ||
      provider.baseUrl?.includes('127.0.0.1') ||
      provider.baseUrl?.includes('integrate.api.nvidia.com') ||
      provider.baseUrl?.includes('openrouter.ai');

    if (!isKeylessProvider && !provider.apiKey?.trim()) {
      setSyncFeedback((prev) => ({
        ...prev,
        [id]: { type: 'error', message: 'Please enter an API Key first before syncing models.' },
      }));
      return;
    }

    setSyncingModels((prev) => ({ ...prev, [id]: true }));
    setSyncFeedback((prev) => ({ ...prev, [id]: null }));

    try {
      const resp = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_PROVIDER_MODELS', provider },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      const models: string[] = ((resp?.data || resp?.models) || []) as string[];

      if (resp?.ok && Array.isArray(models) && models.length > 0) {
        setLocalProviders((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            cachedModels: models,
            modelId: prev[id].modelId || models[0],
          },
        }));
        setSyncFeedback((prev) => ({
          ...prev,
          [id]: { type: 'success', message: `Synced ${models.length} available models!` },
        }));
        // Switch to dropdown selection mode
        setManualModelInput((prev) => ({ ...prev, [id]: false }));
      } else {
        setSyncFeedback((prev) => ({
          ...prev,
          [id]: {
            type: 'error',
            message: resp?.error || 'No models returned from provider.',
          },
        }));
      }
    } catch (err: any) {
      setSyncFeedback((prev) => ({
        ...prev,
        [id]: {
          type: 'error',
          message: err?.message || 'Failed to sync models.',
        },
      }));
    } finally {
      setSyncingModels((prev) => ({ ...prev, [id]: false }));
      setTimeout(() => {
        setSyncFeedback((prev) => (prev[id]?.type === 'success' ? { ...prev, [id]: null } : prev));
      }, 4000);
    }
  };

  const handleAddCustomProvider = () => {
    setCustomFormError('');
    if (!newCustom.name.trim()) {
      setCustomFormError('Provider name is required.');
      return;
    }
    if (!newCustom.baseUrl.trim()) {
      setCustomFormError('Base URL is required.');
      return;
    }

    const cleanBaseUrl = newCustom.baseUrl.trim().replace(/\/+$/, '');
    const customId = `custom_${Date.now()}`;

    const created: LLMProviderConfig = {
      id: customId,
      name: newCustom.name.trim(),
      baseUrl: cleanBaseUrl,
      format: newCustom.format,
      apiKey: newCustom.apiKey.trim(),
      modelId: newCustom.modelId.trim() || 'default-model',
      supportsNativeTools: newCustom.supportsNativeTools,
      zeroDataRetention: false,
      isCustom: true,
      cachedModels: [],
    };

    setLocalProviders((prev) => ({
      ...prev,
      [customId]: created,
    }));

    // Reset and close modal
    setNewCustom({
      name: '',
      baseUrl: '',
      format: 'openai-compatible',
      apiKey: '',
      modelId: '',
      supportsNativeTools: true,
    });
    setShowAddCustom(false);

    // Auto-sync models if key or local url provided
    const isLocal = cleanBaseUrl.includes('localhost') || cleanBaseUrl.includes('127.0.0.1');
    if (created.apiKey || isLocal) {
      setTimeout(() => {
        handleSyncModels(customId);
      }, 250);
    }
  };

  const handleDeleteCustomProvider = (id: string) => {
    setLocalProviders((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setLocalRouter((prev) => ({
      ...prev,
      primaryProviderId: prev.primaryProviderId === id ? 'gemini' : prev.primaryProviderId,
      fallbackProviderIds: prev.fallbackProviderIds.filter((fid) => fid !== id),
    }));

    setProviderErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setSyncFeedback((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const testProvider = async (id: string) => {
    const provider = localProviders[id];
    if (!provider) return;

    const isLocal = provider.baseUrl?.includes('localhost') || provider.baseUrl?.includes('127.0.0.1');
    if (!provider?.apiKey?.trim() && !isLocal) return;

    setTestStatus((prev) => ({ ...prev, [id]: 'testing' }));
    setProviderErrors((prev) => ({ ...prev, [id]: '' }));

    const cleanKey = provider.apiKey?.trim() || '';
    const cleanModel = provider.modelId.trim();
    const cleanBaseUrl = provider.baseUrl.trim().replace(/\/+$/, '');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (provider.format === 'anthropic-native') {
        if (cleanKey) headers['x-api-key'] = cleanKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';

        const resp = await fetch(`${cleanBaseUrl}/v1/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: cleanModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "ok"' }],
          }),
        });

        if (resp.ok) {
          setTestStatus((prev) => ({ ...prev, [id]: 'ok' }));
        } else {
          let errText = `HTTP ${resp.status}`;
          try {
            const errJson = await resp.json();
            errText = errJson.error?.message || errText;
          } catch {
            const txt = await resp.text().catch(() => '');
            if (txt) errText = txt;
          }
          setTestStatus((prev) => ({ ...prev, [id]: 'fail' }));
          setProviderErrors((prev) => ({ ...prev, [id]: errText }));
        }
      } else {
        if (cleanKey) headers['Authorization'] = `Bearer ${cleanKey}`;
        if (id === 'gemini' && cleanKey) {
          headers['x-goog-api-key'] = cleanKey;
        }

        const resp = await fetch(`${cleanBaseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: cleanModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "ok"' }],
          }),
        });

        if (resp.ok) {
          setTestStatus((prev) => ({ ...prev, [id]: 'ok' }));
        } else {
          let errText = `HTTP ${resp.status}`;
          try {
            const errJson = await resp.json();
            errText = errJson.error?.message || errJson.message || errText;
          } catch {
            const txt = await resp.text().catch(() => '');
            if (txt) errText = txt;
          }
          setTestStatus((prev) => ({ ...prev, [id]: 'fail' }));
          setProviderErrors((prev) => ({ ...prev, [id]: errText }));
        }
      }
    } catch (err: any) {
      setTestStatus((prev) => ({ ...prev, [id]: 'fail' }));
      setProviderErrors((prev) => ({ ...prev, [id]: err?.message || 'Network request failed' }));
    }

    setTimeout(() => {
      setTestStatus((prev) => (prev[id] === 'ok' ? { ...prev, [id]: 'idle' } : prev));
    }, 4000);
  };

  const isStatusDone = (statusName: string) => {
    const s = (statusName || '').toLowerCase().trim();
    const doneKws = ['done', 'completed', 'complete', 'archived', 'archive', 'closed', 'close', 'finished', 'resolved', 'shipped', 'cancelled', 'canceled'];
    return doneKws.some((kw) => s === kw || s.startsWith(kw) || s.includes(kw));
  };

  const fetchStatusesInSettings = async () => {
    setIsFetchingNotionStatuses(true);
    setNotionFeedback(null);

    const cleanKey = notionApiKey.trim();
    const cleanDb = notionDbId.trim();
    const cleanProxy = notionProxyUrl.trim();

    try {
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_NOTION_STATUSES',
            config: {
              apiKey: cleanKey,
              databaseId: cleanDb,
              notionProxyUrl: cleanProxy,
              selectedStatuses: notionSelectedStatuses,
              syncIntervalMinutes: Number(notionSyncInterval) || 0,
              lastSyncedAtISO: notionLastSyncedAt,
            },
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(resp);
            }
          }
        );
      });

      if (response?.ok && Array.isArray(response.statuses)) {
        const discovered: string[] = response.statuses;
        setNotionAvailableStatuses(discovered);

        const validCurrent = notionSelectedStatuses.filter((s) => discovered.includes(s));
        const nextSelected =
          validCurrent.length > 0
            ? validCurrent
            : discovered.filter((s) => !isStatusDone(s)).length > 0
              ? discovered.filter((s) => !isStatusDone(s))
              : discovered;

        setNotionSelectedStatuses(nextSelected);
        setNotionFeedback({
          type: 'success',
          message: `Discovered ${discovered.length} statuses from Notion. Select the statuses you want to sync below.`,
        });
      } else {
        setNotionFeedback({
          type: 'error',
          message: response?.error || 'Could not retrieve statuses from Notion.',
        });
      }
    } catch (err: any) {
      setNotionFeedback({
        type: 'error',
        message: err?.message || 'Failed to fetch statuses from Notion.',
      });
    } finally {
      setIsFetchingNotionStatuses(false);
    }
  };

  const runDeltaUpdateInSettings = async () => {
    setIsRunningDeltaNow(true);
    setNotionFeedback(null);

    const cleanKey = notionApiKey.trim();
    const cleanDb = notionDbId.trim();
    const cleanProxy = notionProxyUrl.trim();

    try {
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_NOTION_TASKS',
            config: {
              apiKey: cleanKey,
              databaseId: cleanDb,
              notionProxyUrl: cleanProxy,
              selectedStatuses: notionSelectedStatuses,
              availableStatuses: notionAvailableStatuses,
              syncIntervalMinutes: Number(notionSyncInterval) || 0,
              lastSyncedAtISO: notionLastSyncedAt,
            },
            selectedStatuses: notionSelectedStatuses,
            isDelta: true,
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(resp);
            }
          }
        );
      });

      if (response?.ok) {
        const ds = response.deltaStats;
        if (ds?.syncedAt) setNotionLastSyncedAt(ds.syncedAt);
        setNotionFeedback({
          type: 'success',
          message: ds
            ? `${ds.isDelta ? 'Delta update' : 'Initial sync'} complete! +${ds.added} added, ${ds.updated} updated, ${ds.removed} removed (${response.data?.length || 0} active synced tasks).`
            : `Synced ${response.data?.length || 0} tasks successfully.`,
        });
      } else {
        setNotionFeedback({
          type: 'error',
          message: response?.error || 'Delta update failed.',
        });
      }
    } catch (err: any) {
      setNotionFeedback({
        type: 'error',
        message: err?.message || 'Failed to execute delta update.',
      });
    } finally {
      setIsRunningDeltaNow(false);
    }
  };

  const toggleNotionStatus = (statusName: string) => {
    setNotionSelectedStatuses((prev) =>
      prev.includes(statusName) ? prev.filter((s) => s !== statusName) : [...prev, statusName]
    );
  };

  const testNotion = async () => {
    setTestStatus((prev) => ({ ...prev, notion: 'testing' }));
    setNotionFeedback(null);

    const cleanKey = notionApiKey.trim();
    const cleanDb = notionDbId.trim();
    const cleanProxy = notionProxyUrl.trim();

    try {
      // First fetch available statuses from Notion so the user can choose statuses right away
      const statusRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_NOTION_STATUSES',
            config: {
              apiKey: cleanKey,
              databaseId: cleanDb,
              notionProxyUrl: cleanProxy,
            },
          },
          (resp) => resolve(resp)
        );
      });

      let statusesToUse = notionSelectedStatuses;
      if (statusRes?.ok && Array.isArray(statusRes.statuses)) {
        const discovered: string[] = statusRes.statuses;
        setNotionAvailableStatuses(discovered);
        const validCurrent = notionSelectedStatuses.filter((s) => discovered.includes(s));
        if (validCurrent.length === 0) {
          const activeDefaults = discovered.filter((s) => !isStatusDone(s));
          statusesToUse = activeDefaults.length > 0 ? activeDefaults : discovered;
          setNotionSelectedStatuses(statusesToUse);
        }
      }

      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_NOTION_TASKS',
            config: {
              apiKey: cleanKey,
              databaseId: cleanDb,
              notionProxyUrl: cleanProxy,
              selectedStatuses: statusesToUse,
              syncIntervalMinutes: Number(notionSyncInterval) || 0,
            },
            selectedStatuses: statusesToUse,
            isDelta: false,
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(resp);
            }
          }
        );
      });

      if (response?.ok) {
        setTestStatus((prev) => ({ ...prev, notion: 'ok' }));
        const taskCount = response.data?.length || 0;
        if (response.deltaStats?.syncedAt) {
          setNotionLastSyncedAt(response.deltaStats.syncedAt);
        }
        setNotionFeedback({
          type: 'success',
          message: `Connected successfully! Synced ${taskCount} tasks matching ${statusesToUse.length || 'all'} selected statuses.`,
        });
      } else {
        setTestStatus((prev) => ({ ...prev, notion: 'fail' }));
        setNotionFeedback({
          type: 'error',
          message: response?.error || 'Connection failed. Please check your token and database ID.',
        });
      }
    } catch (err: any) {
      setTestStatus((prev) => ({ ...prev, notion: 'fail' }));
      setNotionFeedback({
        type: 'error',
        message: err?.message || 'Failed to communicate with extension service worker.',
      });
    }
  };

  const handleSave = () => {
    // Persist providers with an API key, custom providers, or local host providers
    const activeProviders: Record<string, LLMProviderConfig> = {};
    for (const [id, config] of Object.entries(localProviders)) {
      const isLocal = config.baseUrl?.includes('localhost') || config.baseUrl?.includes('127.0.0.1');
      if (config.apiKey || config.isCustom || isLocal) {
        activeProviders[id] = config;
      }
    }

    persistProviders(activeProviders);
    persistRouterSettings(localRouter);

    const intervalMins = Math.max(0, Number(notionSyncInterval) || 0);

    // Save Notion and GDrive settings
    chrome.storage.local.set({
      po_notion_config: {
        apiKey: notionApiKey.trim(),
        databaseId: notionDbId.trim(),
        notionProxyUrl: notionProxyUrl.trim(),
        syncIntervalMinutes: intervalMins,
        selectedStatuses: notionSelectedStatuses,
        availableStatuses: notionAvailableStatuses,
        lastSyncedAtISO: notionLastSyncedAt,
      },
      po_gdrive_client_id: gdriveClientId,
    });

    // Update background alarm for periodic Notion delta sync
    chrome.runtime.sendMessage({
      type: 'CONFIGURE_NOTION_SYNC_ALARM',
      syncIntervalMinutes: intervalMins,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const getStatusIcon = (id: string) => {
    const status = testStatus[id];
    if (status === 'testing') return <Loader2 size={12} className="animate-spin text-indigo-400" />;
    if (status === 'ok') return <Check size={12} className="text-emerald-400" />;
    if (status === 'fail') return <AlertCircle size={12} className="text-red-400" />;
    return null;
  };

  const getProviderOrder = (id: string): string => {
    if (localRouter.primaryProviderId === id) return '🥇';
    const fbIdx = localRouter.fallbackProviderIds.indexOf(id);
    if (fbIdx >= 0) return `#${fbIdx + 2}`;
    return '';
  };

  // Helper to render an individual provider card
  const renderProviderCard = (config: LLMProviderConfig) => {
    const order = getProviderOrder(config.id);
    const isPrimary = localRouter.primaryProviderId === config.id;
    const isSyncing = syncingModels[config.id] || false;
    const feedback = syncFeedback[config.id];
    const hasCachedModels = Array.isArray(config.cachedModels) && config.cachedModels.length > 0;
    const isManual = manualModelInput[config.id] || !hasCachedModels;
    const isLocal = config.baseUrl?.includes('localhost') || config.baseUrl?.includes('127.0.0.1');
    const isKeylessProvider =
      config.id === 'nvidia' ||
      config.id === 'openrouter' ||
      isLocal ||
      config.baseUrl?.includes('integrate.api.nvidia.com') ||
      config.baseUrl?.includes('openrouter.ai');

    return (
      <div
        key={config.id}
        className={`bg-white dark:bg-navy-900 border rounded-xl overflow-hidden transition-all shadow-sm ${
          isPrimary
            ? 'border-indigo-600 dark:border-indigo-500 ring-1 ring-indigo-500/30'
            : 'border-slate-300 dark:border-navy-700'
        }`}
      >
        {/* Provider Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-100/60 dark:bg-navy-950/40 border-b border-slate-200 dark:border-navy-800">
          {order && (
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 w-5 text-center">
              {order}
            </span>
          )}
          <span className="text-xs font-bold text-slate-900 dark:text-white flex-1 truncate">
            {config.name}
          </span>
          {config.isCustom && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
              Custom
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-navy-700">
            {config.format}
          </span>
          {getStatusIcon(config.id)}
          {config.isCustom && (
            <button
              type="button"
              onClick={() => handleDeleteCustomProvider(config.id)}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors ml-1"
              title="Delete custom provider"
              aria-label={`Delete custom provider ${config.name}`}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Provider Fields */}
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Editable Base URL for Custom Providers */}
          {config.isCustom && (
            <div className="relative">
              <Globe
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              />
              <input
                value={config.baseUrl}
                onChange={(e) => updateProvider(config.id, 'baseUrl', e.target.value)}
                placeholder="Base URL (e.g. http://localhost:11434/v1)"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-mono"
              />
            </div>
          )}

          {/* API Key */}
          <div className="relative">
            <Key
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
            />
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => updateProvider(config.id, 'apiKey', e.target.value)}
              placeholder={isLocal ? 'API Key (optional for local models)' : 'API Key'}
              className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium"
            />
          </div>

          {/* Model Selection & Sync Controls */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Cpu size={12} className="text-indigo-500" />
                Model ID
              </span>
              <div className="flex items-center gap-2">
                {hasCachedModels && (
                  <button
                    type="button"
                    onClick={() =>
                      setManualModelInput((prev) => ({
                        ...prev,
                        [config.id]: !prev[config.id],
                      }))
                    }
                    className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title={isManual ? 'Switch back to model dropdown' : 'Enter custom model name'}
                  >
                    {isManual ? <List size={11} /> : <Edit2 size={11} />}
                    {isManual ? 'Select from list' : 'Type custom'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSyncModels(config.id)}
                  disabled={isSyncing || (!config.apiKey?.trim() && !isKeylessProvider)}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Query provider /models endpoint to fetch available models"
                >
                  <RefreshCw size={10} className={isSyncing ? 'animate-spin text-indigo-500' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync Models'}
                </button>
              </div>
            </div>

            {hasCachedModels && !isManual ? (
              <select
                value={config.modelId}
                onChange={(e) => updateProvider(config.id, 'modelId', e.target.value)}
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 font-mono font-medium cursor-pointer"
              >
                {!config.cachedModels?.includes(config.modelId) && config.modelId && (
                  <option value={config.modelId}>{config.modelId} (active)</option>
                )}
                {config.cachedModels?.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={config.modelId}
                onChange={(e) => updateProvider(config.id, 'modelId', e.target.value)}
                placeholder="Model ID (e.g. meta/llama-3.3-70b-instruct)"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium font-mono"
              />
            )}
          </div>

          {/* Sync Feedback Alert */}
          {feedback && (
            <div
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle size={12} className="shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span className="truncate">{feedback.message}</span>
            </div>
          )}

          {/* Provider Controls */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setPrimary(config.id)}
              className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                isPrimary
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-navy-700 border border-slate-300 dark:border-navy-700'
              }`}
            >
              Primary
            </button>
            <button
              type="button"
              onClick={() => toggleFallback(config.id)}
              disabled={isPrimary}
              className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${
                localRouter.fallbackProviderIds.includes(config.id)
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-navy-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-navy-700 border border-slate-300 dark:border-navy-700'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Fallback
            </button>

            {localRouter.fallbackProviderIds.includes(config.id) && (
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => moveFallback(config.id, 'up')}
                  className="p-1 rounded bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                  aria-label="Move fallback up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveFallback(config.id, 'down')}
                  className="p-1 rounded bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                  aria-label="Move fallback down"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
            )}

            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={config.supportsNativeTools}
                onChange={(e) => updateProvider(config.id, 'supportsNativeTools', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-400 bg-slate-100 accent-indigo-600"
              />
              Tools
            </label>

            <button
              type="button"
              onClick={() => testProvider(config.id)}
              disabled={(!config.apiKey?.trim() && !isLocal) || testStatus[config.id] === 'testing'}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-200 dark:bg-navy-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-navy-700 font-bold border border-slate-300 dark:border-navy-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <TestTube size={12} />
              Test
            </button>
          </div>

          {config.id === 'gemini' && config.modelId !== 'gemini-3.8-flash' && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => updateProvider('gemini', 'modelId', 'gemini-3.8-flash')}
                className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 px-2.5 py-1 rounded-md transition-colors"
              >
                ✨ Switch to latest: gemini-3.8-flash
              </button>
            </div>
          )}

          {providerErrors[config.id] && (
            <div className="text-xs font-semibold text-red-900 dark:text-red-200 bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800 rounded-lg p-2.5 mt-1 break-words">
              ⚠️ {providerErrors[config.id]}
            </div>
          )}
        </div>
      </div>
    );
  };

  const customProviders = Object.values(localProviders).filter((p) => p.isCustom);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-300 dark:border-navy-800 bg-white dark:bg-navy-900/60 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-indigo-200 tracking-wide">⚙️ Settings</h1>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-0.5">
              LLM providers, model sync, integrations, privacy
            </p>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
              saved
                ? 'bg-emerald-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* ── Appearance & Contrast ───────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200 font-bold flex items-center gap-1.5">
              {theme === 'dark' ? <Moon size={14} className="text-indigo-400" /> : <Sun size={14} className="text-amber-500" />}
              Theme & Contrast
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              WCAG AAA (≥ 7:1)
            </span>
          </div>
          <div className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme?.('dark')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-bold text-xs transition-all ${
                  theme === 'dark'
                    ? 'bg-navy-950 border-indigo-500 text-white shadow-sm ring-2 ring-indigo-500/50'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}
              >
                <Moon size={14} className={theme === 'dark' ? 'text-indigo-400' : 'text-slate-600'} />
                Dark Mode
              </button>
              <button
                type="button"
                onClick={() => setTheme?.('light')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-bold text-xs transition-all ${
                  theme === 'light'
                    ? 'bg-white border-indigo-600 text-slate-950 shadow-sm ring-2 ring-indigo-600/50'
                    : 'bg-navy-800 hover:bg-navy-700 border-navy-700 text-slate-200'
                }`}
              >
                <Sun size={14} className={theme === 'light' ? 'text-amber-500' : 'text-slate-400'} />
                Light Mode
              </button>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-2 font-medium">
              {theme === 'dark'
                ? 'Deep obsidian dark mode with high contrast ratios up to 19:1.'
                : 'High-contrast light mode with deep charcoal text exceeding the 7:1 WCAG AAA standard.'}
            </p>
          </div>
        </section>

        {/* ── LLM Providers Section ──────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200 font-bold flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" />
              LLM Providers
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowAddCustom(true);
                setCustomFormError('');
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors"
            >
              <Plus size={12} />
              Add Custom Provider
            </button>
          </div>

          {/* Standard Providers */}
          <div className="space-y-2.5">
            {PROVIDER_TEMPLATES.map((tmpl) => {
              const config = localProviders[tmpl.id];
              if (!config) return null;
              return renderProviderCard(config);
            })}
          </div>

          {/* Custom Providers Sub-section */}
          {customProviders.length > 0 && (
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] uppercase tracking-wider text-purple-700 dark:text-purple-300 font-bold flex items-center gap-1.5">
                  <Globe size={13} className="text-purple-500" />
                  Custom Providers ({customProviders.length})
                </h3>
              </div>
              {customProviders.map((config) => renderProviderCard(config))}
            </div>
          )}
        </section>

        {/* ── Add Custom Provider Modal ────────────────── */}
        {showAddCustom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-2xl w-full max-w-md p-4 space-y-3.5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Plus size={14} className="text-indigo-600 dark:text-indigo-400" />
                    Add Custom LLM Provider
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Connect local models or private OpenAI/Claude-compatible APIs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOM_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setNewCustom({
                          name: preset.name,
                          baseUrl: preset.baseUrl,
                          format: preset.format,
                          apiKey: '',
                          modelId: preset.defaultModel,
                          supportsNativeTools: preset.supportsNativeTools,
                        });
                        setCustomFormError('');
                      }}
                      className="text-[11px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-300 dark:border-navy-700 hover:border-indigo-400 transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Form Fields */}
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Provider Name *
                  </label>
                  <input
                    value={newCustom.name}
                    onChange={(e) => setNewCustom((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Ollama Local, DeepSeek, Together AI"
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Base URL *
                  </label>
                  <input
                    value={newCustom.baseUrl}
                    onChange={(e) => setNewCustom((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="e.g. http://localhost:11434/v1 or https://api.deepseek.com/v1"
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      API Protocol
                    </label>
                    <select
                      value={newCustom.format}
                      onChange={(e) => setNewCustom((prev) => ({ ...prev, format: e.target.value as ProviderFormat }))}
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 font-medium cursor-pointer"
                    >
                      <option value="openai-compatible">OpenAI-Compatible</option>
                      <option value="anthropic-native">Anthropic-Native</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Initial Model ID
                    </label>
                    <input
                      value={newCustom.modelId}
                      onChange={(e) => setNewCustom((prev) => ({ ...prev, modelId: e.target.value }))}
                      placeholder="e.g. llama3.2"
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    API Key (optional for local models)
                  </label>
                  <input
                    type="password"
                    value={newCustom.apiKey}
                    onChange={(e) => setNewCustom((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter key or leave blank for local Ollama"
                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium"
                  />
                </div>

                <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCustom.supportsNativeTools}
                    onChange={(e) => setNewCustom((prev) => ({ ...prev, supportsNativeTools: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-400 bg-slate-100 accent-indigo-600"
                  />
                  Supports Native Tool / Function Calling
                </label>
              </div>

              {customFormError && (
                <div className="text-xs font-semibold text-red-900 dark:text-red-200 bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800 rounded-lg p-2.5">
                  ⚠️ {customFormError}
                </div>
              )}

              {/* Dialog Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-300 dark:border-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomProvider}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                >
                  Add Provider
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Privacy ────────────────────────────── */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200 font-bold mb-2 flex items-center gap-1.5">
            <Shield size={14} className="text-indigo-500" />
            Privacy Mode
          </h2>
          <div className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl p-3 shadow-sm">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Strict Work Privacy Mode
                </p>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                  Scrubs emails, phone numbers, SSNs, and IPs before dispatching to LLM
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localRouter.strictWorkPrivacyMode}
                  onChange={(e) =>
                    setLocalRouter((prev) => ({
                      ...prev,
                      strictWorkPrivacyMode: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-300 dark:bg-navy-700 rounded-full peer peer-checked:bg-indigo-600 transition-colors" />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
              </div>
            </label>
          </div>
        </section>

        {/* ── Notion Integration ─────────────────── */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200 font-bold mb-2 flex items-center gap-1.5">
            <Database size={14} className="text-indigo-500" />
            Notion Integration
          </h2>
          <div className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl p-3 space-y-2.5 shadow-sm">
            <div className="relative">
              <Key
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              />
              <input
                type="password"
                value={notionApiKey}
                onChange={(e) => {
                  setNotionApiKey(e.target.value);
                  setNotionFeedback(null);
                }}
                placeholder="Notion API Key (secret_...)"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium"
              />
            </div>
            <div className="relative">
              <Globe
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              />
              <input
                value={notionDbId}
                onChange={(e) => {
                  setNotionDbId(e.target.value);
                  setNotionFeedback(null);
                }}
                placeholder="Notion Database ID or full Database URL"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium"
              />
            </div>

            {/* Google Apps Script Relay / Proxy URL (Corporate Firewall Bypass) */}
            <div className="relative">
              <Zap
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              />
              <input
                value={notionProxyUrl}
                onChange={(e) => {
                  setNotionProxyUrl(e.target.value);
                  setNotionFeedback(null);
                }}
                placeholder="Google Apps Script Relay URL (optional, for corporate firewalls)"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={testNotion}
                disabled={!notionApiKey?.trim() || !notionDbId?.trim() || testStatus.notion === 'testing'}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-navy-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-navy-700 font-bold border border-slate-300 dark:border-navy-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testStatus.notion === 'testing' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <TestTube size={12} />
                )}
                Test Connection
                {getStatusIcon('notion')}
              </button>

              <button
                type="button"
                onClick={fetchStatusesInSettings}
                disabled={!notionApiKey?.trim() || !notionDbId?.trim() || isFetchingNotionStatuses}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isFetchingNotionStatuses ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Filter size={12} />
                )}
                Fetch Statuses
              </button>

              <button
                type="button"
                onClick={runDeltaUpdateInSettings}
                disabled={!notionApiKey?.trim() || !notionDbId?.trim() || isRunningDeltaNow}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-bold border border-amber-300 dark:border-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRunningDeltaNow ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                Delta Update Now
              </button>
            </div>

            {/* ── Task Statuses to Sync (Anti-Clutter Filter) ── */}
            <div className="pt-2 border-t border-slate-200 dark:border-navy-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Filter size={12} className="text-indigo-500" />
                    Statuses to Sync
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Only tasks matching your selected statuses will be pulled from Notion.
                  </p>
                </div>
                {notionAvailableStatuses.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const activeOnly = notionAvailableStatuses.filter((s) => !isStatusDone(s));
                        setNotionSelectedStatuses(activeOnly.length > 0 ? activeOnly : notionAvailableStatuses);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    >
                      Active Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotionSelectedStatuses([...notionAvailableStatuses])}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-navy-700"
                    >
                      All
                    </button>
                  </div>
                )}
              </div>

              {notionAvailableStatuses.length === 0 ? (
                <p className="text-[11px] italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-950/60 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-navy-800">
                  Click &ldquo;Fetch Statuses&rdquo; above (or &ldquo;Sync&rdquo; in the Task Board) to load available statuses from your Notion database.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {notionAvailableStatuses.map((statusName) => {
                    const isSelected = notionSelectedStatuses.includes(statusName);
                    return (
                      <button
                        key={statusName}
                        type="button"
                        onClick={() => toggleNotionStatus(statusName)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-navy-950 border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                        <span>{statusName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Auto-Sync Interval (Minutes) & Delta Updates ── */}
            <div className="pt-2 border-t border-slate-200 dark:border-navy-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock size={12} className="text-indigo-500" />
                    Delta Sync Interval (Minutes)
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Periodically fetches only tasks modified in Notion since the last sync.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={notionSyncInterval}
                    onChange={(e) => setNotionSyncInterval(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                    className="w-16 bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-2 py-1 text-xs text-center font-mono tabular-nums font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                    aria-label="Delta sync interval in minutes"
                  />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">min</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'Off (Manual)', value: 0 },
                  { label: '5m', value: 5 },
                  { label: '10m', value: 10 },
                  { label: '15m', value: 15 },
                  { label: '30m', value: 30 },
                  { label: '60m', value: 60 },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setNotionSyncInterval(preset.value)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors font-mono tabular-nums ${
                      notionSyncInterval === preset.value
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-navy-950 border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {notionLastSyncedAt && (
                <p className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Last delta checkpoint: {new Date(notionLastSyncedAt).toLocaleString()}
                </p>
              )}
            </div>

            {notionFeedback && (
              <div
                className={`text-xs font-semibold px-3 py-2.5 rounded-lg border flex items-start gap-2 break-words ${
                  notionFeedback.type === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-100 dark:bg-red-950/70 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                }`}
              >
                {notionFeedback.type === 'success' ? (
                  <Check size={16} className="shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-700 dark:text-red-300" />
                )}
                <span className="leading-snug">{notionFeedback.message}</span>
              </div>
            )}

            <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-navy-950/60 p-3 rounded-lg border border-slate-300 dark:border-navy-800 space-y-1.5 font-medium">
              <p className="font-bold text-slate-900 dark:text-white">💡 Notion Checklist & Firewall Bypass:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>Share database:</strong> In Notion, open your Database page → click{' '}
                  <span className="font-mono bg-slate-200 dark:bg-navy-800 px-1 rounded text-slate-900 dark:text-white">···</span> (top right) →{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">Connections</span> → select your Integration.
                </li>
                <li>
                  <strong>Database ID:</strong> You can paste either the 32-character ID or the full Notion database URL directly.
                </li>
                <li>
                  <strong>Corporate Firewall Bypass:</strong> If your company network blocks <code className="font-mono text-slate-800 dark:text-slate-200">api.notion.com</code>, deploy our Google Apps Script relay and paste your Web App URL (<code className="font-mono text-slate-800 dark:text-slate-200">https://script.google.com/macros/s/.../exec</code>) above to route all requests seamlessly.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Google Drive Sync ──────────────────── */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200 font-bold mb-2 flex items-center gap-1.5">
            <Cloud size={14} className="text-indigo-500" />
            Google Drive Sync
          </h2>
          <div className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl p-3 space-y-2 shadow-sm">
            <div className="relative">
              <Key
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              />
              <input
                value={gdriveClientId}
                onChange={(e) => setGdriveClientId(e.target.value)}
                placeholder="Google OAuth Client ID"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 placeholder-slate-500 dark:placeholder-slate-400 font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Uses PKCE OAuth flow via <code className="bg-slate-200 dark:bg-navy-800 px-1 rounded text-slate-900 dark:text-white font-mono">chrome.identity.launchWebAuthFlow</code> — compatible with Chrome and Edge.
            </p>
          </div>
        </section>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
}
