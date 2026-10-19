import { useState } from 'react';
import { Target, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { POMemoryStore, NotionTask } from '../../types/schema';

interface MorningTriageModalProps {
  memory: POMemoryStore;
  tasks: NotionTask[];
  persistMemory: (m: POMemoryStore) => void;
  onClose: () => void;
}

export default function MorningTriageModal({
  memory,
  tasks,
  persistMemory,
  onClose,
}: MorningTriageModalProps) {
  const [step, setStep] = useState(0);
  const [mustWin1, setMustWin1] = useState('');
  const [mustWin2, setMustWin2] = useState('');
  const [procrastinationRisk, setProcrastinationRisk] = useState('');
  const [taskDeadlines, setTaskDeadlines] = useState<Record<string, string>>({});

  const tasksWithoutDeadlines = tasks.filter((t) => !t.dueDate);
  const totalSteps = 3;

  const handleComplete = () => {
    const today = new Date().toISOString().split('T')[0];
    const mustWins = [mustWin1, mustWin2].filter(Boolean);

    const updated: POMemoryStore = {
      ...memory,
      dailyCommitmentsLog: {
        ...memory.dailyCommitmentsLog,
        [today]: {
          mustWinTaskIds: mustWins,
          morningTriageCompleted: true,
        },
      },
    };

    // Add procrastination risk to triggers if new
    if (
      procrastinationRisk &&
      !memory.userProfile.procrastinationTriggers.includes(procrastinationRisk)
    ) {
      updated.userProfile = {
        ...updated.userProfile,
        procrastinationTriggers: [
          ...updated.userProfile.procrastinationTriggers,
          procrastinationRisk,
        ],
      };
    }

    persistMemory(updated);
    onClose();
  };

  const canProceed = () => {
    if (step === 0) return mustWin1.trim().length > 0;
    if (step === 1) return true; // Optional step
    if (step === 2) return true; // Optional step
    return false;
  };

  const nextStep = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else handleComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-[90%] max-w-sm bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-2xl shadow-2xl shadow-slate-950/20 dark:shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/60">
              <Target size={16} className="text-amber-700 dark:text-amber-300" />
            </div>
            <h2 className="text-sm font-bold text-slate-950 dark:text-slate-100">
              Morning Triage
            </h2>
          </div>
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Lock in your must-wins before the inbox owns your day.
          </p>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-navy-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="px-5 py-4 min-h-[180px]">
          {step === 0 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                What are your 1–2 Must-Win outcomes today?
              </label>
              <input
                type="text"
                value={mustWin1}
                onChange={(e) => setMustWin1(e.target.value)}
                placeholder="Must-win #1 (required)"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-2.5 text-[13px] text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 font-normal"
                autoFocus
              />
              <input
                type="text"
                value={mustWin2}
                onChange={(e) => setMustWin2(e.target.value)}
                placeholder="Must-win #2 (optional)"
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-2.5 text-[13px] text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 font-normal"
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                Tasks without deadlines ({tasksWithoutDeadlines.length})
              </label>
              {tasksWithoutDeadlines.length === 0 ? (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <CheckCircle2 size={16} className="text-emerald-700 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300">
                    All tasks have deadlines — nice!
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                  {tasksWithoutDeadlines.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-lg px-3 py-2"
                    >
                      <span className="text-[12px] font-semibold text-slate-950 dark:text-slate-100 flex-1 truncate">
                        {task.title}
                      </span>
                      <input
                        type="date"
                        value={taskDeadlines[task.id] || ''}
                        onChange={(e) =>
                          setTaskDeadlines((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded px-2 py-1 text-[11px] font-medium text-slate-950 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                What's your biggest procrastination risk today?
              </label>
              <textarea
                value={procrastinationRisk}
                onChange={(e) => setProcrastinationRisk(e.target.value)}
                placeholder="e.g., Avoiding the spec review for Data Migration epic..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-2.5 text-[13px] text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 resize-none font-normal"
                autoFocus
              />
              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Your coach will use this to keep you accountable.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              canProceed()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {step < totalSteps - 1 ? 'Next' : 'Lock it in'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
