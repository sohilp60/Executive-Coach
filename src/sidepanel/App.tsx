import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Target,
  ListTodo,
  Brain,
  Settings,
  X,
  Sparkles,
} from 'lucide-react';
import type {
  POMemoryStore,
  LLMProviderConfig,
  RouterSettings,
  NotionTask,
  CapturePayload,
} from '../types/schema';
import CoachChat from './components/CoachChat';
import FrictionBreaker from './components/FrictionBreaker';
import TaskDrawer from './components/TaskDrawer';
import MemoryVault from './components/MemoryVault';
import ProviderSettings from './components/ProviderSettings';
import CaptureModal from './components/CaptureModal';
import MorningTriageModal from './components/MorningTriageModal';

type ViewId = 'chat' | 'triage' | 'tasks' | 'memory' | 'settings';

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

const NAV_ITEMS: { id: ViewId; icon: React.ElementType; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Coach' },
  { id: 'triage', icon: Target, label: 'Triage' },
  { id: 'tasks', icon: ListTodo, label: 'Tasks' },
  { id: 'memory', icon: Brain, label: 'Memory' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function App() {
  const [currentView, setCurrentView] = useState<ViewId>('chat');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [memory, setMemory] = useState<POMemoryStore>(DEFAULT_MEMORY);
  const [providers, setProviders] = useState<Record<string, LLMProviderConfig>>({});
  const [routerSettings, setRouterSettings] = useState<RouterSettings>(DEFAULT_ROUTER);
  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [activeTabContext, setActiveTabContext] = useState<string>('');
  const [pendingCapture, setPendingCapture] = useState<CapturePayload | null>(null);
  const [isMorningTriageOpen, setIsMorningTriageOpen] = useState(false);
  const [isTriageBannerDismissed, setIsTriageBannerDismissed] = useState(false);

  // Sync theme with DOM documentElement and local storage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    chrome.storage.local.set({ po_theme: theme });
  }, [theme]);

  // Load all persisted state on mount
  useEffect(() => {
    chrome.storage.local.get(
      [
        'po_memory',
        'po_memory_store',
        'po_providers',
        'po_llm_providers',
        'po_router_settings',
        'po_tasks',
        'po_theme',
        '_pendingCapture',
      ],
      (result: Record<string, any>) => {
        if (result.po_theme === 'light' || result.po_theme === 'dark') {
          setTheme(result.po_theme);
        }
        if (result._pendingCapture) {
          setPendingCapture(result._pendingCapture as CapturePayload);
        }
        const loadedMemory = result.po_memory || result.po_memory_store;
        if (loadedMemory) setMemory(loadedMemory as POMemoryStore);

        const loadedRawProviders = result.po_providers || result.po_llm_providers;
        if (loadedRawProviders) {
          const loadedProviders = { ...(loadedRawProviders as Record<string, LLMProviderConfig>) };
          if (
            loadedProviders.gemini &&
            (!loadedProviders.gemini.modelId ||
              loadedProviders.gemini.modelId === 'gemini-2.5-flash' ||
              loadedProviders.gemini.modelId.includes('2.5-flash'))
          ) {
            loadedProviders.gemini.modelId = 'gemini-3.8-flash';
            chrome.storage.local.set({
              po_providers: loadedProviders,
              po_llm_providers: loadedProviders,
            });
          }
          setProviders(loadedProviders);
        }
        if (result.po_router_settings) setRouterSettings(result.po_router_settings as RouterSettings);
        if (result.po_tasks) setTasks(result.po_tasks as NotionTask[]);
      }
    );
  }, []);

  // Listen for background CAPTURE_READY and NOTION_TASKS_UPDATED broadcasts
  useEffect(() => {
    const handleRuntimeMessage = (message: any) => {
      if (message?.type === 'CAPTURE_READY' && message.payload) {
        setPendingCapture(message.payload as CapturePayload);
      } else if (message?.type === 'NOTION_TASKS_UPDATED' && Array.isArray(message.tasks)) {
        setTasks(message.tasks as NotionTask[]);
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  // Periodic Delta Sync scheduler for active session / web preview
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    const scheduleFromStorage = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      chrome.storage.local.get(['po_notion_config'], (res: Record<string, any>) => {
        const config = res?.po_notion_config;
        const intervalMins = Number(config?.syncIntervalMinutes || 0);
        if (intervalMins > 0 && config?.apiKey && config?.databaseId) {
          timerId = setInterval(() => {
            chrome.runtime.sendMessage(
              { type: 'FETCH_NOTION_TASKS', isDelta: true },
              (resp) => {
                if (resp?.ok && Array.isArray(resp.data)) {
                  setTasks(resp.data);
                }
              }
            );
          }, intervalMins * 60 * 1000);
        }
      });
    };

    scheduleFromStorage();

    const handleConfigBroadcast = (message: any) => {
      if (message?.type === 'CONFIGURE_NOTION_SYNC_ALARM') {
        scheduleFromStorage();
      }
    };
    chrome.runtime.onMessage.addListener(handleConfigBroadcast);

    return () => {
      if (timerId) clearInterval(timerId);
      chrome.runtime.onMessage.removeListener(handleConfigBroadcast);
    };
  }, []);

  // Pitfall #3: Side panels don't reload on tab switch – listen for tab changes
  useEffect(() => {
    const handleTabActivated = (_activeInfo: { tabId: number; windowId: number }) => {
      setActiveTabContext(''); // Clear stale context on tab switch
    };

    const handleTabUpdated = (
      _tabId: number,
      changeInfo: { status?: string },
    ) => {
      if (changeInfo.status === 'complete') {
        setActiveTabContext(''); // Clear when tab finishes loading
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, []);

  const persistMemory = useCallback(
    (updated: POMemoryStore) => {
      updated.lastUpdatedISO = new Date().toISOString();
      setMemory(updated);
      chrome.storage.local.set({
        po_memory: updated,
        po_memory_store: updated,
      });
    },
    []
  );

  const persistProviders = useCallback(
    (updated: Record<string, LLMProviderConfig>) => {
      setProviders(updated);
      chrome.storage.local.set({
        po_providers: updated,
        po_llm_providers: updated,
      });
    },
    []
  );

  const persistRouterSettings = useCallback(
    (updated: RouterSettings) => {
      setRouterSettings(updated);
      chrome.storage.local.set({ po_router_settings: updated });
    },
    []
  );

  const persistTasks = useCallback(
    (updated: NotionTask[]) => {
      setTasks(updated);
      chrome.storage.local.set({ po_tasks: updated });
    },
    []
  );

  const renderView = () => {
    switch (currentView) {
      case 'chat':
        return (
          <CoachChat
            memory={memory}
            providers={providers}
            routerSettings={routerSettings}
            tasks={tasks}
            activeTabContext={activeTabContext}
            setActiveTabContext={setActiveTabContext}
            persistMemory={persistMemory}
          />
        );
      case 'triage':
        return (
          <FrictionBreaker
            memory={memory}
            providers={providers}
            routerSettings={routerSettings}
            onOpenMorningTriage={() => setIsMorningTriageOpen(true)}
          />
        );
      case 'tasks':
        return (
          <TaskDrawer
            tasks={tasks}
            persistTasks={persistTasks}
            memory={memory}
            providers={providers}
            routerSettings={routerSettings}
          />
        );
      case 'memory':
        return <MemoryVault memory={memory} persistMemory={persistMemory} />;
      case 'settings':
        return (
          <ProviderSettings
            providers={providers}
            routerSettings={routerSettings}
            persistProviders={persistProviders}
            persistRouterSettings={persistRouterSettings}
            theme={theme}
            setTheme={setTheme}
            memory={memory}
            persistMemory={persistMemory}
            tasks={tasks}
            persistTasks={persistTasks}
          />
        );
      default:
        return null;
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const isMorningTriageCompleted = Boolean(memory.dailyCommitmentsLog?.[today]?.morningTriageCompleted);

  return (
    <div className={`flex flex-col h-screen ${theme === 'dark' ? 'dark bg-navy-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Universal Executive Capture Modal */}
      {pendingCapture && (
        <CaptureModal
          payload={pendingCapture}
          onClose={() => {
            setPendingCapture(null);
            chrome.storage.local.remove('_pendingCapture');
          }}
          tasks={tasks}
          persistTasks={persistTasks}
          memory={memory}
          providers={providers}
          routerSettings={routerSettings}
        />
      )}

      {/* Morning Triage Modal */}
      {isMorningTriageOpen && (
        <MorningTriageModal
          memory={memory}
          tasks={tasks}
          persistMemory={persistMemory}
          persistTasks={persistTasks}
          onClose={() => setIsMorningTriageOpen(false)}
        />
      )}

      {/* Morning Triage Daily Alert Banner */}
      {!isMorningTriageCompleted && !isTriageBannerDismissed && (
        <div className="bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-violet-500/15 border-b border-amber-500/30 px-3 py-2 flex items-center justify-between text-xs shrink-0 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <span className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Sparkles size={13} />
            </span>
            <div className="truncate">
              <span className="font-bold text-slate-900 dark:text-white mr-1.5">Morning Triage:</span>
              <span className="text-slate-600 dark:text-slate-300">Lock in your 1–2 Must-Wins today</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMorningTriageOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-sm transition-all"
            >
              Start
            </button>
            <button
              onClick={() => setIsTriageBannerDismissed(true)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Dismiss banner"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">{renderView()}</div>

      {/* Bottom Navigation Bar — WCAG AAA high contrast */}
      <nav className="flex items-center justify-around bg-white/95 dark:bg-navy-900/95 border-t border-slate-300 dark:border-navy-700 px-2 py-2 shrink-0 shadow-lg">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = currentView === id;
          return (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-150 ${
                isActive
                  ? 'text-white bg-indigo-600 dark:bg-indigo-600 font-bold shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-800'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-semibold tracking-tight">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
