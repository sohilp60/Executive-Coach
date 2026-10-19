import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Target,
  ListTodo,
  Brain,
  Settings,
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

  // Sync theme with DOM documentElement and local storage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    chrome.storage.local.set({ po_theme: theme });
  }, [theme]);

  // Load all persisted state on mount
  useEffect(() => {
    chrome.storage.local.get(
      ['po_memory', 'po_providers', 'po_router_settings', 'po_tasks', 'po_theme', '_pendingCapture'],
      (result: Record<string, any>) => {
        if (result.po_theme === 'light' || result.po_theme === 'dark') {
          setTheme(result.po_theme);
        }
        if (result._pendingCapture) {
          setPendingCapture(result._pendingCapture as CapturePayload);
        }
        if (result.po_memory) setMemory(result.po_memory as POMemoryStore);
        if (result.po_providers) {
          const loadedProviders = { ...(result.po_providers as Record<string, LLMProviderConfig>) };
          if (
            loadedProviders.gemini &&
            (!loadedProviders.gemini.modelId ||
              loadedProviders.gemini.modelId === 'gemini-2.5-flash' ||
              loadedProviders.gemini.modelId.includes('2.5-flash'))
          ) {
            loadedProviders.gemini.modelId = 'gemini-3.8-flash';
            chrome.storage.local.set({ po_providers: loadedProviders });
          }
          setProviders(loadedProviders);
        }
        if (result.po_router_settings) setRouterSettings(result.po_router_settings as RouterSettings);
        if (result.po_tasks) setTasks(result.po_tasks as NotionTask[]);
      }
    );
  }, []);

  // Listen for background CAPTURE_READY broadcasts
  useEffect(() => {
    const handleRuntimeMessage = (message: any) => {
      if (message?.type === 'CAPTURE_READY' && message.payload) {
        setPendingCapture(message.payload as CapturePayload);
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
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
      chrome.storage.local.set({ po_memory: updated });
    },
    []
  );

  const persistProviders = useCallback(
    (updated: Record<string, LLMProviderConfig>) => {
      setProviders(updated);
      chrome.storage.local.set({ po_providers: updated });
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
          />
        );
      default:
        return null;
    }
  };

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
