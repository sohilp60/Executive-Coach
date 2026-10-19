import React, { useState } from 'react';
import {
  User,
  Users,
  BookOpen,
  CalendarCheck,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  CloudUpload,
  CloudDownload,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import type { POMemoryStore } from '../../types/schema';

interface MemoryVaultProps {
  memory: POMemoryStore;
  persistMemory: (m: POMemoryStore) => void;
}

type TabId = 'profile' | 'stakeholders' | 'rules' | 'daily';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'stakeholders', label: 'People', icon: Users },
  { id: 'rules', label: 'Rules', icon: BookOpen },
  { id: 'daily', label: 'Log', icon: CalendarCheck },
];

const INFLUENCE_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-950 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-700/60 font-bold',
  medium: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/60 font-bold',
  low: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700/60 font-bold',
};

const CATEGORY_COLORS: Record<string, string> = {
  architecture: 'bg-violet-100 text-violet-950 border border-violet-300 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-700/60 font-bold',
  process: 'bg-blue-100 text-blue-950 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-700/60 font-bold',
  terminology: 'bg-teal-100 text-teal-950 border border-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-700/60 font-bold',
  quarterly_goal: 'bg-orange-100 text-orange-950 border border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-700/60 font-bold',
};

export default function MemoryVault({ memory, persistMemory }: MemoryVaultProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [expandedStakeholder, setExpandedStakeholder] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // ─── Profile Tab ──────────────────────────────────────────────
  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setTempValue(value);
  };

  const saveProfileField = (field: keyof POMemoryStore['userProfile']) => {
    const updated = { ...memory };
    if (field === 'coreResponsibilities' || field === 'procrastinationTriggers') {
      (updated.userProfile as any)[field] = tempValue.split('\n').filter(Boolean);
    } else {
      (updated.userProfile as any)[field] = tempValue;
    }
    persistMemory(updated);
    setEditingField(null);
  };

  const renderProfileField = (
    label: string,
    field: keyof POMemoryStore['userProfile'],
    value: string | string[]
  ) => {
    const displayValue = Array.isArray(value) ? value.join('\n') : value;
    const isEditing = editingField === field;

    return (
      <div key={field} className="mb-3">
        <label className="text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold mb-1 block">
          {label}
        </label>
        {isEditing ? (
          <div className="flex gap-1.5">
            <textarea
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              rows={Array.isArray(value) ? 3 : 1}
              className="flex-1 bg-white dark:bg-navy-950 border border-indigo-600 dark:border-indigo-400 rounded-lg px-3 py-2 text-[13px] text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none resize-none font-normal"
              placeholder={Array.isArray(value) ? 'One per line' : `Enter ${label.toLowerCase()}`}
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => saveProfileField(field)}
                aria-label="Save field"
                className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setEditingField(null)}
                aria-label="Cancel edit"
                className="p-1.5 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => startEdit(field, displayValue)}
            className="w-full text-left bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-2 text-[13px] text-slate-950 dark:text-slate-100 hover:border-indigo-600 dark:hover:border-indigo-400 transition-colors group shadow-xs"
          >
            {displayValue || (
              <span className="text-slate-500 dark:text-slate-400 italic">Click to set</span>
            )}
            <Edit3
              size={12}
              className="float-right mt-0.5 text-slate-500 group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300 transition-colors"
            />
          </button>
        )}
      </div>
    );
  };

  // ─── Stakeholders Tab ────────────────────────────────────────
  const addStakeholder = () => {
    const updated = { ...memory };
    const newStakeholder = {
      id: crypto.randomUUID(),
      nameOrRole: 'New Stakeholder',
      communicationStyle: '',
      influenceLevel: 'medium' as const,
      knownFrictionPoints: '',
      updatedAt: new Date().toISOString(),
    };
    updated.teamAndStakeholders = [...updated.teamAndStakeholders, newStakeholder];
    persistMemory(updated);
    setExpandedStakeholder(newStakeholder.id);
  };

  const updateStakeholder = (id: string, field: string, value: any) => {
    const updated = { ...memory };
    updated.teamAndStakeholders = updated.teamAndStakeholders.map((s) =>
      s.id === id ? { ...s, [field]: value, updatedAt: new Date().toISOString() } : s
    );
    persistMemory(updated);
  };

  const removeStakeholder = (id: string) => {
    const updated = { ...memory };
    updated.teamAndStakeholders = updated.teamAndStakeholders.filter((s) => s.id !== id);
    persistMemory(updated);
  };

  // ─── Rules Tab ───────────────────────────────────────────────
  const addRule = () => {
    const updated = { ...memory };
    const newRule = {
      id: crypto.randomUUID(),
      category: 'process' as const,
      fact: '',
      updatedAt: new Date().toISOString(),
    };
    updated.productRulesAndContext = [...updated.productRulesAndContext, newRule];
    persistMemory(updated);
    startEdit(`rule-${newRule.id}`, '');
  };

  const updateRule = (id: string, field: string, value: any) => {
    const updated = { ...memory };
    updated.productRulesAndContext = updated.productRulesAndContext.map((r) =>
      r.id === id ? { ...r, [field]: value, updatedAt: new Date().toISOString() } : r
    );
    persistMemory(updated);
  };

  const removeRule = (id: string) => {
    const updated = { ...memory };
    updated.productRulesAndContext = updated.productRulesAndContext.filter((r) => r.id !== id);
    persistMemory(updated);
  };

  // ─── GDrive Sync ─────────────────────────────────────────────
  const handleGDriveBackup = async () => {
    setSyncing(true);
    try {
      const response = await new Promise<any>((resolve) =>
        chrome.runtime.sendMessage({ type: 'GDRIVE_AUTH', clientId: '' }, resolve)
      );
      if (response?.token) {
        await new Promise<void>((resolve) =>
          chrome.runtime.sendMessage(
            { type: 'GDRIVE_UPLOAD', token: response.token, data: memory },
            () => resolve()
          )
        );
      }
    } catch (err) {
      console.warn('GDrive backup failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleGDriveRestore = async () => {
    setSyncing(true);
    try {
      const response = await new Promise<any>((resolve) =>
        chrome.runtime.sendMessage({ type: 'GDRIVE_AUTH', clientId: '' }, resolve)
      );
      if (response?.token) {
        const data = await new Promise<any>((resolve) =>
          chrome.runtime.sendMessage({ type: 'GDRIVE_DOWNLOAD', token: response.token }, resolve)
        );
        if (data?.memory) {
          persistMemory(data.memory);
        }
      }
    } catch (err) {
      console.warn('GDrive restore failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-950 dark:text-indigo-200 tracking-wide flex items-center gap-1.5">
              <span>🧠</span> Memory Vault
            </h1>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
              Last updated: {new Date(memory.lastUpdatedISO).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleGDriveBackup}
              disabled={syncing}
              title="Backup to Google Drive"
              aria-label="Backup to Google Drive"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-navy-700 transition-colors disabled:opacity-50"
            >
              <CloudUpload size={14} />
            </button>
            <button
              onClick={handleGDriveRestore}
              disabled={syncing}
              title="Restore from Google Drive"
              aria-label="Restore from Google Drive"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-navy-700 transition-colors disabled:opacity-50"
            >
              <CloudDownload size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-slate-200 dark:border-navy-800 bg-slate-100/60 dark:bg-navy-900/60 shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-all ${
              activeTab === id
                ? 'text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-600 dark:border-indigo-500 bg-white dark:bg-navy-900'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-navy-800/60'
            }`}
          >
            <Icon size={13} strokeWidth={activeTab === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* ── Profile ─────────────────────────────── */}
        {activeTab === 'profile' && (
          <div>
            {renderProfileField('Role / Title', 'role', memory.userProfile.role)}
            {renderProfileField('Platform Domain', 'platformDomain', memory.userProfile.platformDomain)}
            {renderProfileField('Core Responsibilities', 'coreResponsibilities', memory.userProfile.coreResponsibilities)}
            {renderProfileField('Procrastination Triggers', 'procrastinationTriggers', memory.userProfile.procrastinationTriggers)}
          </div>
        )}

        {/* ── Stakeholders ────────────────────────── */}
        {activeTab === 'stakeholders' && (
          <div className="space-y-2">
            {memory.teamAndStakeholders.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl overflow-hidden shadow-xs"
              >
                <button
                  onClick={() =>
                    setExpandedStakeholder(expandedStakeholder === s.id ? null : s.id)
                  }
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
                >
                  {expandedStakeholder === s.id ? (
                    <ChevronDown size={14} className="text-slate-600 dark:text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-600 dark:text-slate-400 shrink-0" />
                  )}
                  <span className="text-[13px] font-bold text-slate-950 dark:text-slate-100 flex-1 truncate">
                    {s.nameOrRole}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                      INFLUENCE_COLORS[s.influenceLevel] || INFLUENCE_COLORS.medium
                    }`}
                  >
                    {s.influenceLevel}
                  </span>
                </button>

                {expandedStakeholder === s.id && (
                  <div className="px-3 pb-3 space-y-2 border-t border-slate-200 dark:border-navy-700">
                    <input
                      value={s.nameOrRole}
                      onChange={(e) => updateStakeholder(s.id, 'nameOrRole', e.target.value)}
                      placeholder="Name or Role"
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-1.5 text-[12px] text-slate-950 dark:text-white mt-2 focus:outline-none focus:border-indigo-600"
                    />
                    <textarea
                      value={s.communicationStyle}
                      onChange={(e) =>
                        updateStakeholder(s.id, 'communicationStyle', e.target.value)
                      }
                      placeholder="Communication style notes..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-1.5 text-[12px] text-slate-950 dark:text-white focus:outline-none resize-none focus:border-indigo-600"
                    />
                    <textarea
                      value={s.knownFrictionPoints}
                      onChange={(e) =>
                        updateStakeholder(s.id, 'knownFrictionPoints', e.target.value)
                      }
                      placeholder="Known friction points..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-1.5 text-[12px] text-slate-950 dark:text-white focus:outline-none resize-none focus:border-indigo-600"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                        Influence:
                      </label>
                      {(['high', 'medium', 'low'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => updateStakeholder(s.id, 'influenceLevel', level)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all font-bold ${
                            s.influenceLevel === level
                              ? INFLUENCE_COLORS[level]
                              : 'border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                      <button
                        onClick={() => removeStakeholder(s.id)}
                        aria-label="Remove stakeholder"
                        className="ml-auto p-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={addStakeholder}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900/40 text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-600 dark:hover:border-indigo-400 font-bold text-[12px] transition-colors shadow-xs"
            >
              <Plus size={14} />
              Add Stakeholder
            </button>
          </div>
        )}

        {/* ── Rules & Context ─────────────────────── */}
        {activeTab === 'rules' && (
          <div className="space-y-2">
            {memory.productRulesAndContext.map((rule) => (
              <div
                key={rule.id}
                className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl px-3 py-2.5 shadow-xs"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5 ${
                      CATEGORY_COLORS[rule.category] || 'bg-slate-100 text-slate-900 border border-slate-300 dark:bg-navy-800 dark:text-slate-200'
                    }`}
                  >
                    {rule.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    {editingField === `rule-${rule.id}` ? (
                      <div className="flex gap-1.5">
                        <textarea
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          rows={2}
                          className="flex-1 bg-slate-50 dark:bg-navy-950 border border-indigo-600 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-950 dark:text-white focus:outline-none resize-none"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            updateRule(rule.id, 'fact', tempValue);
                            setEditingField(null);
                          }}
                          aria-label="Save rule"
                          className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold"
                        >
                          <Check size={13} />
                        </button>
                      </div>
                    ) : (
                      <p
                        className="text-[12px] font-medium text-slate-950 dark:text-slate-100 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                        onClick={() => startEdit(`rule-${rule.id}`, rule.fact)}
                      >
                        {rule.fact || <span className="italic text-slate-500 dark:text-slate-400">Click to edit</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <select
                      value={rule.category}
                      onChange={(e) => updateRule(rule.id, 'category', e.target.value)}
                      aria-label="Rule category"
                      className="bg-slate-100 dark:bg-navy-800 text-[10px] font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-navy-700 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                    >
                      <option value="architecture">architecture</option>
                      <option value="process">process</option>
                      <option value="terminology">terminology</option>
                      <option value="quarterly_goal">quarterly_goal</option>
                    </select>
                    <button
                      onClick={() => removeRule(rule.id)}
                      aria-label="Remove rule"
                      className="p-0.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addRule}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900/40 text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-600 dark:hover:border-indigo-400 font-bold text-[12px] transition-colors shadow-xs"
            >
              <Plus size={14} />
              Add Rule or Context
            </button>
          </div>
        )}

        {/* ── Daily Log ───────────────────────────── */}
        {activeTab === 'daily' && (
          <div className="space-y-2">
            {Object.entries(memory.dailyCommitmentsLog)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 14)
              .map(([date, log]) => (
                <div
                  key={date}
                  className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl px-3 py-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-bold text-slate-950 dark:text-slate-100">{date}</span>
                    <div className="flex items-center gap-1.5">
                      {log.morningTriageCompleted ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700 font-bold">
                          ✓ Triaged
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 font-bold flex items-center gap-0.5">
                          <AlertTriangle size={10} />
                          No triage
                        </span>
                      )}
                      {log.midDayCheckStatus && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                            log.midDayCheckStatus === 'on_track'
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700'
                              : log.midDayCheckStatus === 'blocked'
                              ? 'bg-red-100 text-red-950 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-700'
                              : 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700'
                          }`}
                        >
                          {log.midDayCheckStatus.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  {log.mustWinTaskIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {log.mustWinTaskIds.map((taskId) => (
                        <span
                          key={taskId}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-950 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-700 font-bold"
                        >
                          🎯 {taskId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

            {Object.keys(memory.dailyCommitmentsLog).length === 0 && (
              <div className="text-center py-8 text-slate-700 dark:text-slate-300">
                <Shield size={24} className="mx-auto mb-2 text-slate-500 dark:text-slate-400" />
                <p className="text-[12px] font-bold">No daily logs yet.</p>
                <p className="text-[11px] font-medium mt-1">
                  Complete your first Morning Triage to get started.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
