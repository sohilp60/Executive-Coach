import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Clipboard, Loader2 } from 'lucide-react';
import type {
  POMemoryStore,
  LLMProviderConfig,
  RouterSettings,
  NotionTask,
} from '../../types/schema';
import { executeLLMRequest } from '../../core/llms/router';
import { buildSystemPrompt } from '../../core/llms/prompts';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface CoachChatProps {
  memory: POMemoryStore;
  providers: Record<string, LLMProviderConfig>;
  routerSettings: RouterSettings;
  tasks: NotionTask[];
  activeTabContext: string;
  setActiveTabContext: (ctx: string) => void;
  persistMemory: (m: POMemoryStore) => void;
}

/** Strip <coach_action>...</coach_action> XML blocks from displayed text */
function stripActionBlocks(text: string): string {
  return text.replace(/<coach_action>[\s\S]*?<\/coach_action>/g, '').trim();
}

/** Parse coach action blocks and execute memory upserts */
function parseAndExecuteActions(
  text: string,
  memory: POMemoryStore,
  persistMemory: (m: POMemoryStore) => void
) {
  const regex = /<coach_action>([\s\S]*?)<\/coach_action>/g;
  let match: RegExpExecArray | null;
  let updated = { ...memory };
  let didUpdate = false;

  while ((match = regex.exec(text)) !== null) {
    try {
      const action = JSON.parse(match[1]);
      if (action.tool === 'upsert_memory_fact' && action.args) {
        const { category, fact } = action.args;
        if (category && fact) {
          updated = {
            ...updated,
            productRulesAndContext: [
              ...updated.productRulesAndContext,
              {
                id: crypto.randomUUID(),
                category: category as any,
                fact,
                updatedAt: new Date().toISOString(),
              },
            ],
          };
          didUpdate = true;
        }
      }
    } catch {
      // Ignore malformed action blocks
    }
  }

  if (didUpdate) {
    persistMemory(updated);
  }
}

export default function CoachChat({
  memory,
  providers,
  routerSettings,
  tasks,
  activeTabContext,
  setActiveTabContext,
  persistMemory,
}: CoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from storage
  useEffect(() => {
    chrome.storage.local.get('po_chat_history', (result: Record<string, any>) => {
      if (result.po_chat_history) {
        setMessages(result.po_chat_history as ChatMessage[]);
      }
    });
  }, []);

  // Save chat history whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      chrome.storage.local.set({ po_chat_history: messages });
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const grabActiveTab = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/dom-extractor.ts'],
      });

      // After injecting, call the extractor function
      const extractResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return (window as any).__extractPageContext?.() || document.body.innerText.slice(0, 8000);
        },
      });

      const context = extractResults?.[0]?.result || '';
      setActiveTabContext(context);
    } catch (err) {
      console.warn('Failed to grab tab context:', err);
    }
  }, [setActiveTabContext]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: activeTabContext
        ? `${trimmed}\n\n[Grabbed Context from Active Tab]:\n${activeTabContext}`
        : trimmed,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setActiveTabContext('');
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      // Pitfall #7: Execute LLM fetch() directly from Side Panel, NOT from SW
      const systemPrompt = buildSystemPrompt(memory, tasks, activeTabContext || undefined);
      const llmMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const fullResponse = await executeLLMRequest(
        llmMessages,
        routerSettings,
        providers,
        systemPrompt,
        (streamText: string) => {
          // Update the assistant message in real-time during streaming
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: streamText } : m
            )
          );
        }
      );

      // Final update with complete response
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullResponse, timestamp: Date.now() }
            : m
        )
      );

      // Parse and execute coach actions (pitfall #6: dual-mode XML parsing)
      parseAndExecuteActions(fullResponse, memory, persistMemory);
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠️ Error: ${err.message}. Check Settings → Provider config.` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, memory, tasks, providers, routerSettings, activeTabContext, setActiveTabContext, persistMemory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm shrink-0 shadow-sm">
        <h1 className="text-sm font-bold text-slate-950 dark:text-indigo-200 tracking-wide flex items-center gap-1.5">
          <span>🎯</span> Executive Coach
        </h1>
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
          Ruthless triage · Anti-procrastination · Senior PO sparring
        </p>
      </div>

      {/* Messages Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center mb-3">
              <span className="text-2xl">🧠</span>
            </div>
            <h2 className="text-sm font-bold text-slate-950 dark:text-slate-100 mb-1">
              Ready to coach
            </h2>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[240px]">
              Paste a Jira ticket, grab your active tab, or ask about your must-win outcomes.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white font-medium rounded-br-md'
                  : 'bg-white dark:bg-navy-900 text-slate-950 dark:text-slate-100 font-medium rounded-bl-md border border-slate-300 dark:border-navy-700'
              }`}
            >
              <MarkdownRenderer
                content={msg.role === 'assistant' ? stripActionBlocks(msg.content) : msg.content}
                variant={msg.role}
              />
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-navy-900 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-300 dark:border-navy-700 shadow-sm">
              <div className="flex gap-1.5">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Tab Context Badge */}
      {activeTabContext && (
        <div className="mx-3 mb-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-400 dark:border-emerald-700 rounded-lg flex items-center gap-2">
          <Clipboard size={12} className="text-emerald-800 dark:text-emerald-300 shrink-0" />
          <span className="text-[11px] font-bold text-emerald-950 dark:text-emerald-200 truncate">
            Tab context grabbed ({activeTabContext.length} chars)
          </span>
          <button
            onClick={() => setActiveTabContext('')}
            className="text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white text-xs font-bold ml-auto shrink-0"
            aria-label="Clear active tab context"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-800 bg-white/95 dark:bg-navy-900/90 shrink-0">
        <div className="flex items-end gap-2">
          <button
            onClick={grabActiveTab}
            title="Grab Active Tab Context"
            aria-label="Grab Active Tab Context"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-navy-700 transition-colors shrink-0 mb-0.5"
          >
            <Clipboard size={16} />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your coach..."
              rows={1}
              className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-700 rounded-xl px-3.5 py-2.5 text-[13px] text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none max-h-24 font-normal"
              style={{ minHeight: '40px' }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
            className={`p-2.5 rounded-xl transition-all shrink-0 mb-0.5 font-bold ${
              isStreaming || !input.trim()
                ? 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30'
            }`}
          >
            {isStreaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
