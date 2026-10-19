import { useState, useCallback, useEffect, useRef } from 'react';
import { Flame, Play, Pause, RotateCcw, Loader2, Zap } from 'lucide-react';
import type {
  POMemoryStore,
  LLMProviderConfig,
  RouterSettings,
} from '../../types/schema';
import { executeLLMRequest } from '../../core/llms/router';
import MarkdownRenderer from './MarkdownRenderer';

interface FrictionBreakerProps {
  memory: POMemoryStore;
  providers: Record<string, LLMProviderConfig>;
  routerSettings: RouterSettings;
}

const FRICTION_SYSTEM_PROMPT = `You are a ruthless anti-procrastination coach. The user tells you a task they're avoiding.

Your ONLY job:
1. In 1 sentence, name the EXACT friction (ambiguity, perfectionism, fear of conflict, boring, overwhelming).
2. Give ONE concrete 5-minute micro-step they can start RIGHT NOW. Not "plan" or "think about" — an actual atomic action with a deliverable.
3. End with a punchy one-liner motivation.

Format:
**Friction:** [diagnosis]
**Your 5-min step:** [specific action]
**Now go:** [motivational nudge]

Max 60 words total.`;

export default function FrictionBreaker({
  memory,
  providers,
  routerSettings,
}: FrictionBreakerProps) {
  const [avoidedTask, setAvoidedTask] = useState('');
  const [microStep, setMicroStep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 minutes
  const [timerRunning, setTimerRunning] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer effect
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timerSeconds]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const breakFriction = useCallback(async () => {
    if (!avoidedTask.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    setMicroStep('');

    try {
      const messages = [
        {
          role: 'user',
          content: `I'm avoiding this task: "${avoidedTask.trim()}"\n\nMy known procrastination triggers: ${memory.userProfile.procrastinationTriggers.join(', ') || 'none recorded yet'}`,
        },
      ];

      const result = await executeLLMRequest(
        messages,
        routerSettings,
        providers,
        FRICTION_SYSTEM_PROMPT
      );

      setMicroStep(result);
      setShowTimer(true);
      setTimerSeconds(300);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to LLM.');
    } finally {
      setIsLoading(false);
    }
  }, [avoidedTask, isLoading, memory, providers, routerSettings]);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(300);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800/60">
            <Flame size={16} className="text-orange-700 dark:text-orange-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-950 dark:text-orange-200">
              Friction Breaker
            </h1>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Name it → shrink it → do it in 5 minutes
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Input Card */}
        <div className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl p-4 shadow-xs">
          <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
            What task are you avoiding right now?
          </label>
          <textarea
            value={avoidedTask}
            onChange={(e) => setAvoidedTask(e.target.value)}
            placeholder="e.g., Writing the API migration spec for the Q4 platform refactor..."
            rows={3}
            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-lg px-3 py-2.5 text-[13px] text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:border-orange-600 dark:focus:border-orange-400 resize-none font-normal"
          />

          <button
            onClick={breakFriction}
            disabled={isLoading || !avoidedTask.trim()}
            className={`w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isLoading || !avoidedTask.trim()
                ? 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/30'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Breaking friction...
              </>
            ) : (
              <>
                <Zap size={16} />
                Break the Friction
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-xs font-bold text-red-900 dark:text-red-200">⚠️ {error}</p>
          </div>
        )}

        {/* Micro-Step Result */}
        {microStep && (
          <div className="bg-white dark:bg-navy-900 border border-amber-400 dark:border-amber-700/60 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-950 dark:text-amber-300 uppercase tracking-wider">
                Your micro-step
              </span>
            </div>
            <div className="text-[13px] text-slate-950 dark:text-slate-100 font-medium leading-relaxed">
              <MarkdownRenderer content={microStep} />
            </div>
          </div>
        )}

        {/* Timer */}
        {showTimer && (
          <div className="bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl p-4 text-center shadow-xs">
            <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider mb-2">
              5-minute sprint
            </p>
            <div
              className={`text-4xl font-mono font-bold mb-3 ${
                timerSeconds === 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : timerRunning
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-slate-950 dark:text-slate-100'
              }`}
            >
              {timerSeconds === 0 ? '✓ Done!' : formatTime(timerSeconds)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                aria-label={timerRunning ? 'Pause timer' : 'Start timer'}
                className="p-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all shadow-sm"
              >
                {timerRunning ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={resetTimer}
                aria-label="Reset timer"
                className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-navy-700 transition-all font-bold"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
