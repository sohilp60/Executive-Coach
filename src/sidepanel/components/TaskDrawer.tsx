import { useState, useMemo, useEffect } from 'react';
import {
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Calendar,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Flame,
  Zap,
} from 'lucide-react';
import type {
  NotionTask,
  POMemoryStore,
  LLMProviderConfig,
  RouterSettings,
} from '../../types/schema';
import { executeLLMRequest } from '../../core/llms/router';
import MarkdownRenderer from './MarkdownRenderer';

interface TaskDrawerProps {
  tasks: NotionTask[];
  persistTasks: (tasks: NotionTask[]) => void;
  memory?: POMemoryStore;
  providers?: Record<string, LLMProviderConfig>;
  routerSettings?: RouterSettings;
}

type FilterMode = 'active' | 'attention' | 'all' | 'done';

export function isDoneOrArchived(task: NotionTask): boolean {
  if (task.archived) return true;
  const statusLower = (task.status || '').toLowerCase().trim();
  const doneKeywords = [
    'done',
    'completed',
    'complete',
    'archived',
    'archive',
    'closed',
    'close',
    'finished',
    'finish',
    'resolved',
    'shipped',
    'cancelled',
    'canceled',
  ];
  return doneKeywords.some(
    (kw) => statusLower === kw || statusLower.startsWith(kw) || statusLower.includes(kw)
  );
}

function getTaskCategory(task: NotionTask): 'overdue' | 'today' | 'upcoming' | 'nodate' | 'done' {
  if (isDoneOrArchived(task)) return 'done';
  if (!task.dueDate) return 'nodate';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

const CATEGORY_CONFIG = {
  overdue: {
    label: 'Overdue',
    icon: AlertCircle,
    dotColor: 'bg-red-600 dark:bg-red-500',
    textColor: 'text-red-900 dark:text-red-300',
    borderColor: 'border-red-300 dark:border-red-800/60',
    bgColor: 'bg-red-50/70 dark:bg-red-950/20',
  },
  today: {
    label: 'Due Today',
    icon: Clock,
    dotColor: 'bg-amber-600 dark:bg-amber-500',
    textColor: 'text-amber-950 dark:text-amber-300',
    borderColor: 'border-amber-300 dark:border-amber-800/60',
    bgColor: 'bg-amber-50/70 dark:bg-amber-950/20',
  },
  upcoming: {
    label: 'Upcoming',
    icon: Calendar,
    dotColor: 'bg-emerald-600 dark:bg-emerald-500',
    textColor: 'text-emerald-950 dark:text-emerald-300',
    borderColor: 'border-emerald-300 dark:border-emerald-800/60',
    bgColor: 'bg-emerald-50/70 dark:bg-emerald-950/20',
  },
  nodate: {
    label: 'No Deadline ⚠️',
    icon: AlertTriangle,
    dotColor: 'bg-slate-600 dark:bg-slate-400',
    textColor: 'text-slate-900 dark:text-slate-300',
    borderColor: 'border-slate-300 dark:border-slate-700/60',
    bgColor: 'bg-slate-100/70 dark:bg-navy-900/40',
  },
  done: {
    label: 'Completed & Archived',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-600 dark:bg-emerald-500',
    textColor: 'text-emerald-950 dark:text-emerald-300',
    borderColor: 'border-emerald-300 dark:border-emerald-800/60',
    bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/20',
  },
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700/60',
  'Done': 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60',
  'Completed': 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60',
  'To Do': 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-navy-800 dark:text-slate-200 dark:border-navy-700',
  'Not Started': 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-navy-800 dark:text-slate-200 dark:border-navy-700',
  'Blocked': 'bg-red-100 text-red-950 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700/60',
};

function getPriorityIndicator(priority: string) {
  switch (priority.toLowerCase()) {
    case 'urgent':
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

export default function TaskDrawer({
  tasks,
  persistTasks,
  memory,
  providers,
  routerSettings,
}: TaskDrawerProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Per-task strategy state
  const [generatingTaskId, setGeneratingTaskId] = useState<string | null>(null);
  const [taskStrategyErrors, setTaskStrategyErrors] = useState<Record<string, string>>({});
  const [expandedStrategyMap, setExpandedStrategyMap] = useState<Record<string, boolean>>({});
  const [isCapturingTab, setIsCapturingTab] = useState(false);

  const handleCaptureTab = () => {
    setIsCapturingTab(true);
    chrome.runtime.sendMessage({ type: 'TRIGGER_ACTIVE_TAB_CAPTURE' }, () => {
      setIsCapturingTab(false);
    });
  };

  // Load saved filter preference & analysis
  useEffect(() => {
    chrome.storage.local.get(['po_task_filter_mode', 'po_task_ai_analysis'], (res: Record<string, any>) => {
      if (res.po_task_filter_mode) {
        setFilterMode(res.po_task_filter_mode as FilterMode);
      }
      if (res.po_task_ai_analysis) {
        setAiAnalysis(res.po_task_ai_analysis as string);
      }
    });
  }, []);

  const setAndPersistFilterMode = (mode: FilterMode) => {
    setFilterMode(mode);
    chrome.storage.local.set({ po_task_filter_mode: mode });
  };

  const toggleStrategyExpanded = (taskId: string) => {
    setExpandedStrategyMap((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Compute Task Board Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    let done = 0;
    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;
    let nodate = 0;
    let highPriority = 0;
    let strategized = 0;

    for (const task of tasks) {
      if (isDoneOrArchived(task)) {
        done++;
        continue;
      }
      if (task.coachStrategy) strategized++;

      const cat = getTaskCategory(task);
      if (cat === 'overdue') overdue++;
      else if (cat === 'today') dueToday++;
      else if (cat === 'upcoming') upcoming++;
      else if (cat === 'nodate') nodate++;

      const p = (task.priority || '').toLowerCase();
      if (p === 'urgent' || p === 'critical' || p === 'high') {
        highPriority++;
      }
    }

    const active = total - done;
    return { total, active, done, overdue, dueToday, upcoming, nodate, highPriority, strategized };
  }, [tasks]);

  // Filter tasks according to user choice and search
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const isDone = isDoneOrArchived(task);
      const cat = getTaskCategory(task);

      if (filterMode === 'active' && isDone) return false;
      if (filterMode === 'done' && !isDone) return false;
      if (filterMode === 'attention' && (isDone || (cat !== 'overdue' && cat !== 'nodate'))) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = task.title.toLowerCase().includes(q);
        const statusMatch = (task.status || '').toLowerCase().includes(q);
        const priorityMatch = (task.priority || '').toLowerCase().includes(q);
        return titleMatch || statusMatch || priorityMatch;
      }

      return true;
    });
  }, [tasks, filterMode, searchQuery]);

  // Group filtered tasks into categories
  const groupedTasks = useMemo(() => {
    return filteredTasks.reduce(
      (acc, task) => {
        const cat = getTaskCategory(task);
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(task);
        return acc;
      },
      {} as Record<string, NotionTask[]>
    );
  }, [filteredTasks]);

  const categoryOrder: Array<'overdue' | 'today' | 'upcoming' | 'nodate' | 'done'> = useMemo(() => {
    if (filterMode === 'done') return ['done'];
    if (filterMode === 'attention') return ['overdue', 'nodate'];
    if (filterMode === 'active') return ['overdue', 'today', 'upcoming', 'nodate'];
    return ['overdue', 'today', 'upcoming', 'nodate', 'done'];
  }, [filterMode]);

  // Top heuristic focus recommendation
  const topFocusTask = useMemo(() => {
    const activeTasks = tasks.filter((t) => !isDoneOrArchived(t));
    if (activeTasks.length === 0) return null;

    const overdueHigh = activeTasks.find(
      (t) => getTaskCategory(t) === 'overdue' && ['urgent', 'critical', 'high'].includes((t.priority || '').toLowerCase())
    );
    if (overdueHigh) return overdueHigh;

    const overdueAny = activeTasks.find((t) => getTaskCategory(t) === 'overdue');
    if (overdueAny) return overdueAny;

    const todayHigh = activeTasks.find(
      (t) => getTaskCategory(t) === 'today' && ['urgent', 'critical', 'high'].includes((t.priority || '').toLowerCase())
    );
    if (todayHigh) return todayHigh;

    const todayAny = activeTasks.find((t) => getTaskCategory(t) === 'today');
    if (todayAny) return todayAny;

    return activeTasks[0];
  }, [tasks]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError('');

    try {
      const stored = await chrome.storage.local.get('po_notion_config');
      const config = stored.po_notion_config;

      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_NOTION_TASKS',
            config,
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

      if (!response?.ok) {
        setSyncError(response?.error || 'Sync failed. Check Notion settings.');
      } else if (response?.data) {
        persistTasks(response.data);
      }
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed. Check Notion settings.');
    } finally {
      setIsSyncing(false);
    }
  };

  const runAiTriage = async () => {
    if (!providers || !routerSettings) {
      setAnalysisError('Please configure an LLM provider in Settings first.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const activeTasks = tasks.filter((t) => !isDoneOrArchived(t));
      if (activeTasks.length === 0) {
        const msg = '🎉 Your backlog is completely clear of active tasks! Great job.';
        setAiAnalysis(msg);
        chrome.storage.local.set({ po_task_ai_analysis: msg });
        setIsAnalyzing(false);
        return;
      }

      const taskSummaries = activeTasks
        .slice(0, 30)
        .map((t) => {
          const cat = getTaskCategory(t);
          return `- "${t.title}" | Status: ${t.status || 'None'} | Due: ${t.dueDate || 'No deadline ⚠️'} | Priority: ${t.priority || 'Normal'} | Category: ${cat}`;
        })
        .join('\n');

      const prompt = `You are a Senior Executive Product Coach. Analyze this active task backlog (${activeTasks.length} active tasks):

${taskSummaries}

Context:
- Role: ${memory?.userProfile.role || 'Senior Product Owner'}
- Platform Domain: ${memory?.userProfile.platformDomain || 'Product Platform'}
- Known Procrastination Triggers: ${memory?.userProfile.procrastinationTriggers.join(', ') || 'ambiguity, missing specs'}

Deliver a sharp, ruthless, 3-point executive triage:
1. **Top 1–2 Must-Wins Today:** Identify the highest-leverage tasks to lock in immediately.
2. **Ambiguity & Procrastination Traps:** Call out tasks with missing deadlines or vague scope that will cause drag.
3. **15-Minute Action:** ONE concrete atomic action to execute right now.

Format with clear bold titles. Keep it punchy, executive-level, and under 150 words.`;

      const response = await executeLLMRequest(
        [{ role: 'user', content: prompt }],
        routerSettings,
        providers,
        'You are a ruthless executive product coach. Give high-leverage, direct triage without fluff.'
      );

      setAiAnalysis(response);
      chrome.storage.local.set({ po_task_ai_analysis: response });
    } catch (err: any) {
      setAnalysisError(err?.message || 'Failed to analyze tasks. Check provider settings.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Generates or regenerates an AI Coach Strategy for a specific task.
   * If regenerating, it replaces the existing strategy block in Notion so it doesn't duplicate.
   * Also uses any body notes/content from the Notion task page as additional context!
   */
  const handleGenerateStrategy = async (task: NotionTask, isRegenerate = false) => {
    if (!providers || !routerSettings) {
      setTaskStrategyErrors((prev) => ({
        ...prev,
        [task.id]: 'Configure an LLM provider in Settings first.',
      }));
      return;
    }

    setGeneratingTaskId(task.id);
    setTaskStrategyErrors((prev) => ({ ...prev, [task.id]: '' }));
    setExpandedStrategyMap((prev) => ({ ...prev, [task.id]: true }));

    try {
      // 1. Fetch detailed body context from Notion
      const detailsRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_NOTION_TASK_DETAILS', taskId: task.id },
          resolve
        );
      });

      const pageContent = detailsRes?.data?.pageContent || '';
      const existingBlockId = detailsRes?.data?.existingStrategyBlockId || task.coachStrategyBlockId;
      const existingStrategyText = detailsRes?.data?.existingStrategyText;

      // If not regenerating and an existing strategy was already found on Notion, use it
      if (!isRegenerate && existingStrategyText && !task.coachStrategy) {
        const updatedTasks = tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                coachStrategy: existingStrategyText,
                coachStrategyBlockId: existingBlockId,
                coachStrategyUpdatedAt: new Date().toISOString(),
              }
            : t
        );
        persistTasks(updatedTasks);
        setGeneratingTaskId(null);
        return;
      }

      // 2. Formulate AI Strategy using the task details + page content
      const prompt = `You are a Senior Executive Product Coach advising a Senior PO.
Task: "${task.title}"
Status: ${task.status || 'Not set'}
Due Date: ${task.dueDate || 'No deadline'}
Priority: ${task.priority || 'Normal'}
Notion Page Notes & Additional Context:
${pageContent || '(No additional notes in task body)'}

Context:
- User Role: ${memory?.userProfile.role || 'Senior Product Owner'}
- Platform Domain: ${memory?.userProfile.platformDomain || 'Product Platform'}
- Known Procrastination Triggers: ${memory?.userProfile.procrastinationTriggers.join(', ') || 'ambiguity, missing specs'}

Formulate a sharp, tactical, high-leverage Coach Strategy:
1. **Angle of Attack:** Scope boundaries, ruthless PO prioritization, and what NOT to waste time on.
2. **First 5-Min Micro-Step:** The immediate atomic action to unblock this task right now.
3. **Downstream Alignment & Done Definition:** Who to sync with and what "done" actually looks like.

Format with clear bold titles. Keep it punchy, executive-level, and under 130 words.`;

      const strategyResult = await executeLLMRequest(
        [{ role: 'user', content: prompt }],
        routerSettings,
        providers,
        'You are a ruthless executive product coach. Give high-leverage, direct triage without fluff.'
      );

      // 3. Inject directly into Notion task page (deletes older block if regenerating)
      const injectRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'INJECT_NOTION_STRATEGY',
            taskId: task.id,
            strategyText: strategyResult,
            existingBlockId: isRegenerate ? existingBlockId : undefined,
          },
          resolve
        );
      });

      if (!injectRes?.ok) {
        console.warn('Could not inject strategy into Notion:', injectRes?.error);
      }

      // 4. Update task state and persist
      const newBlockId = injectRes?.blockId || existingBlockId;
      const nowIso = new Date().toISOString();
      const updatedTasks = tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              coachStrategy: strategyResult,
              coachStrategyBlockId: newBlockId,
              coachStrategyUpdatedAt: nowIso,
            }
          : t
      );
      persistTasks(updatedTasks);
    } catch (err: any) {
      setTaskStrategyErrors((prev) => ({
        ...prev,
        [task.id]: err?.message || 'Failed to generate strategy.',
      }));
    } finally {
      setGeneratingTaskId(null);
    }
  };

  const openTask = (url: string) => {
    chrome.tabs.create({ url });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-950 dark:text-slate-100 flex items-center gap-1.5">
              <span>📋</span> Task Board
            </h1>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
              {metrics.active} active tasks · {metrics.done} done ({metrics.total} total)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAnalyzerOpen(!isAnalyzerOpen)}
              title={isAnalyzerOpen ? 'Hide Analyzer' : 'Open Smart Analyzer'}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                isAnalyzerOpen
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-navy-800 dark:border-indigo-500 dark:text-indigo-300'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-navy-700'
              }`}
            >
              <Sparkles size={13} className="text-amber-500" />
              <span className="hidden sm:inline">Analyzer</span>
              {isAnalyzerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button
              onClick={handleCaptureTab}
              disabled={isCapturingTab}
              title="Capture active tab to Notion"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {isCapturingTab ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <span>🎯</span>
              )}
              <span className="hidden sm:inline">Capture</span>
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isSyncing
                  ? 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              }`}
            >
              {isSyncing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>
      </div>

      {/* Sync Error */}
      {syncError && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-xs font-bold text-red-900 dark:text-red-200">⚠️ {syncError}</p>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
        {/* ─── Smart Task Analyzer Section ─── */}
        {isAnalyzerOpen && (
          <div className="bg-white dark:bg-navy-900 border border-indigo-200 dark:border-navy-700 rounded-xl p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-indigo-200">
                  Smart Task Analyzer
                </h2>
              </div>
              <button
                onClick={runAiTriage}
                disabled={isAnalyzing}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shadow-xs ${
                  isAnalyzing
                    ? 'bg-slate-200 dark:bg-navy-800 text-slate-500'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isAnalyzing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Flame size={12} className="text-amber-300" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Run AI Triage'}
              </button>
            </div>

            {/* Health Metrics Grid (Interactive filter shortcuts) */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <button
                onClick={() => setAndPersistFilterMode('active')}
                className={`p-2 rounded-lg border transition-all ${
                  filterMode === 'active'
                    ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-950/40 dark:border-indigo-600 ring-1 ring-indigo-500'
                    : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-800 hover:bg-slate-100'
                }`}
              >
                <div className="text-base font-bold text-slate-950 dark:text-slate-100">
                  {metrics.active}
                </div>
                <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                  Active
                </div>
              </button>

              <button
                onClick={() => setAndPersistFilterMode('attention')}
                className={`p-2 rounded-lg border transition-all ${
                  filterMode === 'attention'
                    ? 'bg-red-50 border-red-400 dark:bg-red-950/40 dark:border-red-600 ring-1 ring-red-500'
                    : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-800 hover:bg-slate-100'
                }`}
              >
                <div className={`text-base font-bold ${metrics.overdue > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-950 dark:text-slate-100'}`}>
                  {metrics.overdue}
                </div>
                <div className="text-[10px] font-bold text-red-900 dark:text-red-300 truncate">
                  Overdue
                </div>
              </button>

              <button
                onClick={() => setAndPersistFilterMode('attention')}
                className={`p-2 rounded-lg border transition-all ${
                  filterMode === 'attention'
                    ? 'bg-amber-50 border-amber-400 dark:bg-amber-950/40 dark:border-amber-600 ring-1 ring-amber-500'
                    : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-800 hover:bg-slate-100'
                }`}
              >
                <div className={`text-base font-bold ${metrics.nodate > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-950 dark:text-slate-100'}`}>
                  {metrics.nodate}
                </div>
                <div className="text-[10px] font-bold text-amber-950 dark:text-amber-300 truncate">
                  No Date
                </div>
              </button>

              <button
                onClick={() => setAndPersistFilterMode('done')}
                className={`p-2 rounded-lg border transition-all ${
                  filterMode === 'done'
                    ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-600 ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-800 hover:bg-slate-100'
                }`}
              >
                <div className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                  {metrics.done}
                </div>
                <div className="text-[10px] font-bold text-emerald-950 dark:text-emerald-300 truncate">
                  Done
                </div>
              </button>
            </div>

            {/* Instant Heuristic Alerts */}
            <div className="bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-lg p-2.5 text-[11px] space-y-1.5">
              {metrics.overdue > 0 && (
                <div className="flex items-center gap-1.5 text-red-900 dark:text-red-200 font-bold">
                  <AlertCircle size={13} className="text-red-600 shrink-0" />
                  <span>{metrics.overdue} task{metrics.overdue > 1 ? 's are' : ' is'} overdue. Renegotiate or execute first.</span>
                </div>
              )}
              {metrics.nodate > 0 && (
                <div className="flex items-center gap-1.5 text-amber-950 dark:text-amber-200 font-bold">
                  <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                  <span>{metrics.nodate} task{metrics.nodate > 1 ? 's have' : ' has'} no deadline (procrastination trap).</span>
                </div>
              )}
              {topFocusTask && (
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
                  <span className="font-bold text-indigo-700 dark:text-indigo-400 shrink-0">🎯 Top Focus:</span>
                  <span className="truncate font-semibold">{topFocusTask.title}</span>
                </div>
              )}
            </div>

            {/* AI Coach Triage Result */}
            {aiAnalysis && (
              <div className="bg-indigo-50/70 dark:bg-navy-950 border border-indigo-300 dark:border-indigo-800/60 rounded-xl p-3 text-[12px] space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-indigo-200 dark:border-navy-800">
                  <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
                    <Sparkles size={12} className="text-amber-500" />
                    Coach Triage Briefing
                  </span>
                  <button
                    onClick={() => {
                      setAiAnalysis(null);
                      chrome.storage.local.remove('po_task_ai_analysis');
                    }}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <MarkdownRenderer content={aiAnalysis} />
              </div>
            )}

            {analysisError && (
              <div className="p-2 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-700 rounded-lg text-[11px] font-bold text-red-900 dark:text-red-200">
                ⚠️ {analysisError}
              </div>
            )}
          </div>
        )}

        {/* ─── Filter Pills & Search Bar ─── */}
        <div className="space-y-2">
          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-navy-900 p-1 rounded-xl">
            <button
              onClick={() => setAndPersistFilterMode('active')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                filterMode === 'active'
                  ? 'bg-white dark:bg-navy-950 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Active ({metrics.active})
            </button>
            <button
              onClick={() => setAndPersistFilterMode('attention')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                filterMode === 'attention'
                  ? 'bg-white dark:bg-navy-950 text-red-700 dark:text-red-300 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Focus ({metrics.overdue + metrics.nodate})
            </button>
            <button
              onClick={() => setAndPersistFilterMode('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-navy-950 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              All ({metrics.total})
            </button>
            <button
              onClick={() => setAndPersistFilterMode('done')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                filterMode === 'done'
                  ? 'bg-white dark:bg-navy-950 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              Done ({metrics.done})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks by name, status, or priority..."
              className="w-full bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-lg pl-8 pr-7 py-1.5 text-[12px] text-slate-950 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ─── Task List ─── */}
        <div className="space-y-4">
          {filteredTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-navy-800/80 border border-slate-300 dark:border-navy-700 flex items-center justify-center mb-3">
                <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-slate-100 mb-1">
                {filterMode === 'active'
                  ? 'No active tasks found'
                  : filterMode === 'attention'
                  ? 'No tasks require immediate triage'
                  : filterMode === 'done'
                  ? 'No completed tasks found'
                  : 'No tasks found'}
              </h2>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[220px]">
                {filterMode === 'active' && metrics.done > 0
                  ? `All ${metrics.done} tasks are completed or archived! Switch filter to "All" or "Done" to review.`
                  : tasks.length === 0
                  ? 'Configure your Notion integration in Settings, then tap Sync.'
                  : 'Try clearing your search query or switching filters.'}
              </p>
              {filterMode !== 'active' && (
                <button
                  onClick={() => {
                    setAndPersistFilterMode('active');
                    setSearchQuery('');
                  }}
                  className="mt-3 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
                >
                  Reset to Active Tasks
                </button>
              )}
            </div>
          )}

          {categoryOrder.map((cat) => {
            const catTasks = groupedTasks[cat];
            if (!catTasks || catTasks.length === 0) return null;
            const config = CATEGORY_CONFIG[cat];

            return (
              <div key={cat}>
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${config.textColor}`}>
                    {config.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    ({catTasks.length})
                  </span>
                </div>

                {/* Tasks */}
                <div className="space-y-2">
                  {catTasks.map((task) => {
                    const isDone = isDoneOrArchived(task);
                    const isGeneratingThis = generatingTaskId === task.id;
                    const isStrategyExpanded = expandedStrategyMap[task.id] ?? Boolean(task.coachStrategy);
                    const errorMsg = taskStrategyErrors[task.id];

                    return (
                      <div
                        key={task.id}
                        className={`w-full text-left p-3 rounded-xl border ${config.borderColor} ${config.bgColor} bg-white dark:bg-navy-900/90 transition-all shadow-xs`}
                      >
                        {/* Task Main Row */}
                        <div className="flex items-start gap-2">
                          <span className="text-[12px] mt-0.5 shrink-0">
                            {isDone ? '✅' : getPriorityIndicator(task.priority)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => task.url && openTask(task.url)}
                              className="text-left w-full group/title"
                            >
                              <p
                                className={`text-[13px] font-semibold truncate ${
                                  isDone
                                    ? 'line-through text-slate-500 dark:text-slate-400'
                                    : 'text-slate-950 dark:text-slate-100 group-hover/title:text-indigo-600 dark:group-hover/title:text-indigo-300'
                                }`}
                              >
                                {task.title}
                              </p>
                            </button>

                            <div className="flex items-center flex-wrap gap-2 mt-1.5">
                              {task.status && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                    isDone
                                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60'
                                      : STATUS_BADGE_COLORS[task.status] ||
                                        'bg-slate-100 text-slate-800 border-slate-300 dark:bg-navy-800 dark:text-slate-200 dark:border-navy-700'
                                  }`}
                                >
                                  {task.status}
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <Calendar size={10} />
                                  {new Date(task.dueDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              )}
                              {task.coachStrategy && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-indigo-100 text-indigo-950 border border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-700 flex items-center gap-1">
                                  <Sparkles size={9} className="text-amber-500" />
                                  Strategized
                                </span>
                              )}
                              {task.archived && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-bold">
                                  Archived
                                </span>
                              )}
                            </div>
                          </div>

                          {task.url && (
                            <button
                              onClick={() => openTask(task.url)}
                              title="Open task in Notion"
                              className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white shrink-0 transition-colors"
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                        </div>

                        {/* ─── Coach Strategy Section ─── */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-navy-800/80">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => toggleStrategyExpanded(task.id)}
                              className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 transition-colors"
                            >
                              <Zap size={12} className="text-amber-500" />
                              <span>Coach Strategy</span>
                              {task.coachStrategy && (
                                isStrategyExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                              )}
                            </button>

                            <div className="flex items-center gap-1.5">
                              {task.coachStrategy ? (
                                <button
                                  onClick={() => handleGenerateStrategy(task, true)}
                                  disabled={isGeneratingThis}
                                  title="Regenerate strategy with latest task notes and replace in Notion"
                                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                                    isGeneratingThis
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-navy-800 dark:text-indigo-300 dark:border-navy-700'
                                  }`}
                                >
                                  <RefreshCw size={10} className={isGeneratingThis ? 'animate-spin' : ''} />
                                  <span>{isGeneratingThis ? 'Updating...' : 'Regenerate'}</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleGenerateStrategy(task, false)}
                                  disabled={isGeneratingThis}
                                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition-all shadow-xs ${
                                    isGeneratingThis
                                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                  }`}
                                >
                                  {isGeneratingThis ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={10} className="text-amber-300" />
                                  )}
                                  <span>{isGeneratingThis ? 'Formulating...' : 'Generate Strategy'}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Strategy Content Box */}
                          {isStrategyExpanded && (
                            <div className="mt-2 space-y-1.5">
                              {isGeneratingThis && (
                                <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-navy-950 border border-indigo-200 dark:border-navy-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  <Loader2 size={14} className="animate-spin text-indigo-600 shrink-0" />
                                  <span>Reading Notion task context, formulating PO strategy & injecting into Notion...</span>
                                </div>
                              )}

                              {errorMsg && (
                                <div className="p-2 rounded bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-[11px] font-bold text-red-900 dark:text-red-200">
                                  ⚠️ {errorMsg}
                                </div>
                              )}

                              {task.coachStrategy && !isGeneratingThis && (
                                <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-navy-950 border border-indigo-200 dark:border-indigo-900/60 text-[12px] space-y-2">
                                  <MarkdownRenderer content={task.coachStrategy} />
                                  <div className="pt-2 border-t border-indigo-200/80 dark:border-navy-800 flex items-center justify-between text-[10px] font-bold text-emerald-900 dark:text-emerald-300">
                                    <span className="flex items-center gap-1">
                                      <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                                      Injected directly into Notion page
                                    </span>
                                    {task.coachStrategyUpdatedAt && (
                                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                                        Updated: {new Date(task.coachStrategyUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
