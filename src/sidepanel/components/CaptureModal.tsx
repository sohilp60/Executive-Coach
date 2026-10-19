import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Target,
  Layers,
  FileText,
  Search,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  CapturePayload,
  NotionTask,
  POMemoryStore,
  LLMProviderConfig,
  RouterSettings,
} from '../../types/schema';
import { executeLLMRequest } from '../../core/llms/router';

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getThisFridayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 5 ? 0 : (5 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getNextMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (1 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getInOneWeekISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return 'Select Due Date';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface CaptureModalProps {
  payload: CapturePayload | null;
  onClose: () => void;
  tasks: NotionTask[];
  persistTasks: (tasks: NotionTask[]) => void;
  memory?: POMemoryStore;
  providers?: Record<string, LLMProviderConfig>;
  routerSettings?: RouterSettings;
}

export default function CaptureModal({
  payload,
  onClose,
  tasks,
  persistTasks,
  memory,
  providers,
  routerSettings,
}: CaptureModalProps) {
  // Destination
  const [destinationMode, setDestinationMode] = useState<'new' | 'append'>('new');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  // Editable Fields
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<string>('Medium');
  const [status, setStatus] = useState<string>('To Do');
  const [contextSummary, setContextSummary] = useState('');
  const [generateStrategy, setGenerateStrategy] = useState(true);

  // Notion Database Schema Options
  const [dbStatusOptions, setDbStatusOptions] = useState<string[]>([]);
  const [dbPriorityOptions, setDbPriorityOptions] = useState<string[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Date Picker State
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // UI state
  const [isDistilling, setIsDistilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedResult, setSavedResult] = useState<{
    taskId?: string;
    taskUrl?: string;
    taskTitle?: string;
  } | null>(null);

  // Run AI Distillation on mount or when payload changes
  const runDistillation = useCallback(
    async (capture: CapturePayload) => {
      // Sensible preliminary defaults
      const snippet = capture.selectedText.trim();
      const firstLine = snippet.split('\n')[0].replace(/^["'*\s]+|["'*\s]+$/g, '');
      setTitle(firstLine.slice(0, 80) || capture.pageTitle);
      setContextSummary(snippet || capture.pageTitle);

      if (!providers || !routerSettings) return;

      setIsDistilling(true);
      try {
        const prompt = `You are an Executive Product Coach assisting a Senior Product Owner.
Analyze this raw capture from a work tool and distill it into an actionable task:

SOURCE: ${capture.source.toUpperCase()}
SOURCE URL: ${capture.sourceUrl}
PAGE / THREAD TITLE: ${capture.pageTitle}
SELECTED TEXT:
"${capture.selectedText}"

FULL CONTEXT DETAILS:
${JSON.stringify(capture, null, 2).slice(0, 3500)}

USER PROFILE:
- Role: ${memory?.userProfile.role || 'Senior Product Owner'}
- Platform: ${memory?.userProfile.platformDomain || 'Product Platform'}
- Stakeholders in Memory Vault: ${(memory?.teamAndStakeholders || []).map((s) => s.nameOrRole).join(', ') || 'None'}

Return ONLY a valid JSON object with these exact keys:
{
  "title": "A concise, action-oriented task title (starts with an imperative verb, max 80 chars, e.g. 'Align with Sameer on X4C payload schema')",
  "dueDate": "Inferred deadline in YYYY-MM-DD format if mentioned in text or context (e.g. 'by Friday', 'by tomorrow', 'by Oct 25') or null if no deadline",
  "priority": "High" | "Medium" | "Low",
  "contextSummary": "A 2-3 sentence executive context summary explaining why this was captured and what decision or delivery is required"
}`;

        const rawResponse = await executeLLMRequest(
          [{ role: 'user', content: prompt }],
          routerSettings,
          providers,
          'You are a high-speed executive task distiller. Respond ONLY with valid JSON, no markdown formatting or commentary.'
        );

        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.title) setTitle(parsed.title.trim());
          if (parsed.dueDate) setDueDate(parsed.dueDate.trim());
          if (parsed.priority && ['High', 'Medium', 'Low', 'None'].includes(parsed.priority)) {
            setPriority(parsed.priority);
          }
          if (parsed.contextSummary) setContextSummary(parsed.contextSummary.trim());
        }
      } catch (err) {
        console.warn('[CaptureModal] AI Distillation failed, using fallback fields:', err);
      } finally {
        setIsDistilling(false);
      }
    },
    [memory, providers, routerSettings]
  );

  useEffect(() => {
    if (payload) {
      runDistillation(payload);
    }
  }, [payload, runDistillation]);

  // Fetch dynamic database schema (available status and priority options from Notion)
  useEffect(() => {
    setIsLoadingSchema(true);
    chrome.runtime.sendMessage({ type: 'FETCH_NOTION_METADATA' }, (res) => {
      setIsLoadingSchema(false);
      if (res?.ok && res.data) {
        if (res.data.statusProp?.options?.length > 0) {
          setDbStatusOptions(res.data.statusProp.options);
          setStatus((prev) => {
            if (!prev || prev === 'To Do') {
              return res.data.statusProp.defaultOption || res.data.statusProp.options[0];
            }
            return prev;
          });
        }
        if (res.data.priorityProp?.options?.length > 0) {
          setDbPriorityOptions(res.data.priorityProp.options);
        }
      }
    });
  }, []);

  // Compute available statuses (merge db schema with any seen in loaded tasks)
  const availableStatuses = useMemo(() => {
    const list: string[] = [];
    if (dbStatusOptions.length > 0) {
      list.push(...dbStatusOptions);
    }
    for (const t of tasks) {
      if (t.status && !list.includes(t.status)) {
        list.push(t.status);
      }
    }
    if (list.length === 0) {
      return ['Not started', 'In progress', 'Done', 'To Do'];
    }
    return list;
  }, [dbStatusOptions, tasks]);

  // Compute available priorities
  const availablePriorities = useMemo(() => {
    if (dbPriorityOptions.length > 0) {
      return dbPriorityOptions;
    }
    const list: string[] = ['High', 'Medium', 'Low', 'None'];
    for (const t of tasks) {
      if (t.priority && !list.includes(t.priority)) {
        list.push(t.priority);
      }
    }
    return list;
  }, [dbPriorityOptions, tasks]);

  // Ensure current status is valid
  useEffect(() => {
    if (availableStatuses.length > 0 && (!status || !availableStatuses.includes(status))) {
      const matched = availableStatuses.find((s) => s.toLowerCase() === status?.toLowerCase()) || availableStatuses[0];
      setStatus(matched);
    }
  }, [availableStatuses, status]);

  // Date Preset handler
  const applyPreset = (preset: 'today' | 'tomorrow' | 'friday' | 'nextMon' | 'in1Week') => {
    let iso = '';
    if (preset === 'today') iso = getTodayISO();
    else if (preset === 'tomorrow') iso = getTomorrowISO();
    else if (preset === 'friday') iso = getThisFridayISO();
    else if (preset === 'nextMon') iso = getNextMondayISO();
    else if (preset === 'in1Week') iso = getInOneWeekISO();

    setDueDate(iso);
    const [y, m, d] = iso.split('-').map(Number);
    setCalendarMonth(new Date(y, m - 1, d));
  };

  // Calendar days grid calculation
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIdx = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (null | { dayNumber: number; isoString: string })[] = [];
    for (let i = 0; i < firstDayIdx; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, isoString });
    }
    return days;
  }, [calendarMonth]);

  // Set default append task if available
  useEffect(() => {
    if (tasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  if (!payload) return null;

  // Filter tasks for Append mode
  const filteredTasks = tasks.filter((t) =>
    (t.title || '').toLowerCase().includes(taskSearchQuery.toLowerCase())
  );

  // Render Source Badge
  const renderSourceBadge = () => {
    switch (payload.source) {
      case 'teams':
        return (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50 dark:bg-navy-800/80 border border-indigo-200 dark:border-navy-700">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-base">🟦</span>
              <div className="truncate">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Microsoft Teams
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  From: <strong className="font-semibold text-slate-900 dark:text-slate-100">{payload.senderName}</strong> • {payload.channelOrChat}
                </p>
              </div>
            </div>
            {payload.sourceUrl && (
              <a
                href={payload.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 shrink-0"
                title="Open Source Link"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        );

      case 'outlook':
        return (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 dark:bg-navy-800/80 border border-blue-200 dark:border-navy-700">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-base">✉️</span>
              <div className="truncate">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Outlook Email
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  From: <strong className="font-semibold text-slate-900 dark:text-slate-100">{payload.senderName}</strong> • {payload.subject}
                </p>
              </div>
            </div>
            {payload.sourceUrl && (
              <a
                href={payload.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 shrink-0"
                title="Open Source Link"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        );

      case 'jira':
        return (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 dark:bg-navy-800/80 border border-sky-200 dark:border-navy-700">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-base">🔷</span>
              <div className="truncate">
                <span className="text-xs font-bold text-sky-900 dark:text-sky-200">
                  Jira Issue [{payload.issueKey}]
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  {payload.summary} • {payload.status} ({payload.priority})
                </p>
              </div>
            </div>
            {payload.sourceUrl && (
              <a
                href={payload.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 shrink-0"
                title="Open Source Link"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        );

      case 'confluence':
        return (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-navy-800/80 border border-emerald-200 dark:border-navy-700">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-base">📘</span>
              <div className="truncate">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Confluence Wiki
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  {payload.pageTitle} • Author: {payload.author} (Space: {payload.spaceKey})
                </p>
              </div>
            </div>
            {payload.sourceUrl && (
              <a
                href={payload.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 shrink-0"
                title="Open Source Link"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        );

      case 'generic':
      default:
        return (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-base">🌐</span>
              <div className="truncate">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  {payload.pageTitle || 'Web Capture'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {payload.sourceUrl}
                </p>
              </div>
            </div>
            {payload.sourceUrl && (
              <a
                href={payload.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shrink-0"
                title="Open Source Link"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        );
    }
  };

  const handleCaptureSave = async () => {
    if (destinationMode === 'new' && !title.trim()) {
      setSaveError('Task Title is required.');
      return;
    }
    if (destinationMode === 'append' && !selectedTaskId) {
      setSaveError('Please select a target task.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // If Coach Strategy generation is checked
      let strategyText = '';
      if (generateStrategy && providers && routerSettings) {
        try {
          const taskLabel = destinationMode === 'new' ? title : (tasks.find((t) => t.id === selectedTaskId)?.title || 'Selected Task');
          const strategyPrompt = `You are a Senior Executive Product Coach advising a Senior PO.
Task: "${taskLabel}"
Due Date: ${dueDate || 'No deadline'}
Priority: ${priority}
Context Summary:
${contextSummary}
Source Quote / Content:
"${payload.selectedText}"

Context:
- User Role: ${memory?.userProfile.role || 'Senior Product Owner'}
- Platform Domain: ${memory?.userProfile.platformDomain || 'Product Platform'}

Formulate a sharp, tactical, high-leverage Coach Strategy:
1. **Angle of Attack:** Scope boundaries, ruthless PO prioritization, and what NOT to waste time on.
2. **First 5-Min Micro-Step:** The immediate atomic action to unblock this task right now.
3. **Downstream Alignment & Done Definition:** Who to sync with and what "done" actually looks like.

Format with clear bold titles. Keep it punchy, executive-level, and under 130 words.`;

          strategyText = await executeLLMRequest(
            [{ role: 'user', content: strategyPrompt }],
            routerSettings,
            providers,
            'You are a ruthless executive product coach. Give high-leverage, direct triage without fluff.'
          );
        } catch (stratErr) {
          console.warn('[CaptureModal] Coach strategy pre-gen skipped:', stratErr);
        }
      }

      if (destinationMode === 'new') {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'CREATE_NOTION_TASK',
              payload: {
                title: title.trim(),
                dueDate: dueDate || null,
                priority,
                status,
                capturePayload: payload,
                contextSummary: contextSummary.trim(),
                generateStrategy,
                strategyText,
              },
            },
            resolve
          );
        });

        if (!res?.ok) {
          throw new Error(res?.error || 'Failed to create Notion task.');
        }

        setSavedResult({
          taskId: res.taskId,
          taskUrl: res.taskUrl,
          taskTitle: title,
        });

        // Optimistically update local task cache
        const newTask: NotionTask = {
          id: res.taskId,
          title,
          status,
          dueDate: dueDate || null,
          priority,
          url: res.taskUrl || '',
          coachStrategy: strategyText || undefined,
          coachStrategyUpdatedAt: strategyText ? new Date().toISOString() : undefined,
        };
        persistTasks([newTask, ...tasks]);
      } else {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'APPEND_NOTION_CONTEXT',
              payload: {
                taskId: selectedTaskId,
                capturePayload: payload,
                contextSummary: contextSummary.trim(),
                generateStrategy,
                strategyText,
              },
            },
            resolve
          );
        });

        if (!res?.ok) {
          throw new Error(res?.error || 'Failed to append to Notion task.');
        }

        const targetTask = tasks.find((t) => t.id === selectedTaskId);
        setSavedResult({
          taskId: selectedTaskId,
          taskUrl: targetTask?.url,
          taskTitle: targetTask?.title || 'Existing Task',
        });

        if (strategyText) {
          const updated = tasks.map((t) =>
            t.id === selectedTaskId
              ? {
                  ...t,
                  coachStrategy: strategyText,
                  coachStrategyUpdatedAt: new Date().toISOString(),
                }
              : t
          );
          persistTasks(updated);
        }
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error communicating with Notion.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📎</span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Universal Executive Capture
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                1-Click Capture into Notion with AI Distillation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-700 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {savedResult ? (
            /* Success Screen */
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {destinationMode === 'new' ? 'Task Created in Notion!' : 'Context Appended to Task!'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xs mx-auto">
                  "{savedResult.taskTitle}"
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 max-w-xs mx-auto">
                {savedResult.taskUrl && (
                  <a
                    href={savedResult.taskUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <span>Open in Notion</span>
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg text-xs font-semibold transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Main Form */
            <>
              {/* Source Badge */}
              {renderSourceBadge()}

              {/* Distillation Banner */}
              {isDistilling && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-navy-800/60 border border-indigo-200 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs">
                  <Loader2 size={15} className="animate-spin shrink-0" />
                  <span>AI is distilling task title, deadline & context...</span>
                </div>
              )}

              {/* Destination Mode Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Destination Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestinationMode('new')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border ${
                      destinationMode === 'new'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
                    }`}
                  >
                    <FileText size={14} />
                    <span>Create New Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinationMode('append')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition border ${
                      destinationMode === 'append'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
                    }`}
                  >
                    <Layers size={14} />
                    <span>Append to Existing</span>
                  </button>
                </div>
              </div>

              {destinationMode === 'append' ? (
                /* Select Existing Task */
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Select Existing Notion Task
                  </label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-2.5 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-navy-700 rounded-lg divide-y divide-slate-100 dark:divide-navy-800">
                    {filteredTasks.length === 0 ? (
                      <p className="p-3 text-xs text-slate-500 text-center">
                        No matching tasks found.
                      </p>
                    ) : (
                      filteredTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTaskId(t.id)}
                          className={`p-2 text-xs cursor-pointer transition flex items-center justify-between ${
                            selectedTaskId === t.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 font-semibold text-indigo-900 dark:text-indigo-200'
                              : 'hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="truncate pr-2">{t.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 shrink-0">
                            {t.status || 'Active'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Create New Task Fields */
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Task Title (AI Distilled)
                      </label>
                      <button
                        type="button"
                        onClick={() => runDistillation(payload)}
                        disabled={isDistilling}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Sparkles size={11} />
                        <span>Re-distill</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Align with Sameer on X4C payload schema"
                      className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Due Date Section with Quick Presets and Visual Calendar */}
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-950/60 border border-slate-200 dark:border-navy-700/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <CalendarIcon size={12} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Due Date</span>
                      </label>
                      {dueDate && (
                        <button
                          type="button"
                          onClick={() => setDueDate('')}
                          className="text-[10px] text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 flex items-center gap-0.5"
                        >
                          <X size={10} />
                          <span>Clear date</span>
                        </button>
                      )}
                    </div>

                    {/* Quick Preset Chips */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                      <button
                        type="button"
                        onClick={() => applyPreset('today')}
                        className={`px-2 py-0.5 text-[10px] rounded-md font-semibold transition shrink-0 ${
                          dueDate === getTodayISO()
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-700'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('tomorrow')}
                        className={`px-2 py-0.5 text-[10px] rounded-md font-semibold transition shrink-0 ${
                          dueDate === getTomorrowISO()
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-700'
                        }`}
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('friday')}
                        className={`px-2 py-0.5 text-[10px] rounded-md font-semibold transition shrink-0 ${
                          dueDate === getThisFridayISO()
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-700'
                        }`}
                      >
                        This Fri
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('nextMon')}
                        className={`px-2 py-0.5 text-[10px] rounded-md font-semibold transition shrink-0 ${
                          dueDate === getNextMondayISO()
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-700'
                        }`}
                      >
                        Next Mon
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('in1Week')}
                        className={`px-2 py-0.5 text-[10px] rounded-md font-semibold transition shrink-0 ${
                          dueDate === getInOneWeekISO()
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-700'
                        }`}
                      >
                        +1 Wk
                      </button>
                    </div>

                    {/* Interactive Calendar Popover Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCalendarPopover((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 text-slate-900 dark:text-slate-100 hover:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-left"
                      >
                        <span className={dueDate ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
                          📅 {formatDisplayDate(dueDate)}
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                          {showCalendarPopover ? '▲ Close' : '▼ Pick Day'}
                        </span>
                      </button>

                      {/* Visual Month Calendar Popover */}
                      {showCalendarPopover && (
                        <div className="absolute left-0 top-full mt-1.5 z-40 p-3 bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-xs animate-fadeIn">
                          {/* Month Navigation */}
                          <div className="flex items-center justify-between mb-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
                              }
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300"
                              title="Previous Month"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
                              }
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300"
                              title="Next Month"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>

                          {/* Day names */}
                          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">
                            <span>Su</span>
                            <span>Mo</span>
                            <span>Tu</span>
                            <span>We</span>
                            <span>Th</span>
                            <span>Fr</span>
                            <span>Sa</span>
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1 text-center text-xs">
                            {calendarDays.map((dayObj, idx) => {
                              if (!dayObj) {
                                return <div key={`empty-${idx}`} className="h-6" />;
                              }
                              const isSelected = dueDate === dayObj.isoString;
                              const isToday = dayObj.isoString === getTodayISO();

                              return (
                                <button
                                  key={dayObj.isoString}
                                  type="button"
                                  onClick={() => {
                                    setDueDate(dayObj.isoString);
                                    setShowCalendarPopover(false);
                                  }}
                                  className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center text-[11px] font-medium transition ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                      : isToday
                                      ? 'border border-indigo-400 font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-navy-800'
                                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800'
                                  }`}
                                >
                                  {dayObj.dayNumber}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Priority & Status Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Status
                        </label>
                        {isLoadingSchema && (
                          <span className="text-[10px] text-indigo-500 animate-pulse">Syncing...</span>
                        )}
                      </div>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        {availableStatuses.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                        Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        {availablePriorities.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}


              {/* Context Summary */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Executive Context Summary
                </label>
                <textarea
                  rows={3}
                  value={contextSummary}
                  onChange={(e) => setContextSummary(e.target.value)}
                  placeholder="2-3 sentence executive context summary..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Coach Strategy Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/70 dark:bg-navy-800/50 border border-indigo-200 dark:border-navy-700">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Generate Coach Strategy
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Angle of Attack + 5-min Micro-Step + Done Definition
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={generateStrategy}
                  onChange={(e) => setGenerateStrategy(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {/* Error Alert */}
              {saveError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!savedResult && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCaptureSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving to Notion...</span>
                </>
              ) : (
                <>
                  <span>🎯</span>
                  <span>{destinationMode === 'new' ? 'Capture & Create Task' : 'Append Context'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
