import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'assistant' | 'user';
}

/**
 * Parses inline formatting:
 * - Code: `code`
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Bold + Italic: ***text***
 */
function renderInline(
  text: string,
  variant: 'assistant' | 'user',
  keyPrefix = 'inline'
): React.ReactNode[] {
  if (!text) return [];

  const tokens: React.ReactNode[] = [];
  // Matches:
  // 1: `code`
  // 2: **bold** or __bold__
  // 3: *italic* or _italic_
  const regex =
    /(`[^`]+`|\*\*(?:[^*]|\*(?!\*))+\*\*|__(?:[^_]|_(?!_))+__|(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)|(?<!\w)_(?!_)([^_]+)(?<!\w)_(?!\w))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  const isUser = variant === 'user';
  const boldColor = isUser
    ? 'text-white font-extrabold'
    : 'text-slate-950 dark:text-white font-bold';
  const italicColor = isUser
    ? 'text-indigo-100 italic'
    : 'text-slate-900 dark:text-slate-200 italic';
  const codeStyle = isUser
    ? 'bg-indigo-700/80 text-white font-mono text-[11px] font-semibold border border-indigo-500/40'
    : 'bg-slate-200/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 font-mono text-[11px] font-semibold border border-slate-300 dark:border-navy-700';

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      tokens.push(
        <code key={key} className={`px-1.5 py-0.5 rounded ${codeStyle}`}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**') && token.length >= 4) ||
      (token.startsWith('__') && token.endsWith('__') && token.length >= 4)
    ) {
      tokens.push(
        <strong key={key} className={boldColor}>
          {renderInline(token.slice(2, -2), variant, `${key}-b`)}
        </strong>
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*') && token.length >= 2) ||
      (token.startsWith('_') && token.endsWith('_') && token.length >= 2)
    ) {
      tokens.push(
        <em key={key} className={italicColor}>
          {token.slice(1, -1)}
        </em>
      );
    } else {
      tokens.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.length > 0 ? tokens : [text];
}

type Block =
  | { type: 'code'; language: string; content: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'ordered_list'; items: { num: string; text: string }[] }
  | { type: 'unordered_list'; items: string[] }
  | { type: 'paragraph'; text: string };

function parseBlocks(rawText: string): Block[] {
  const lines = rawText.split(/\r?\n/);
  const blocks: Block[] = [];

  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];

  let currentList: Block | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: currentParagraphLines.join('\n'),
      });
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle (```)
    if (line.trim().startsWith('```')) {
      if (inCode) {
        blocks.push({
          type: 'code',
          language: codeLang,
          content: codeLines.join('\n'),
        });
        inCode = false;
        codeLang = '';
        codeLines = [];
      } else {
        flushAll();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      flushAll();
      continue;
    }

    // Headings (#, ##, ###)
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    // Blockquote (> text)
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      flushAll();
      blocks.push({
        type: 'blockquote',
        text: quoteMatch[1],
      });
      continue;
    }

    // Ordered list item (e.g., "1. **Format:** ...")
    const olMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (currentList && currentList.type !== 'ordered_list') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'ordered_list', items: [] };
      }
      (
        currentList as {
          type: 'ordered_list';
          items: { num: string; text: string }[];
        }
      ).items.push({
        num: olMatch[1],
        text: olMatch[2],
      });
      continue;
    }

    // Unordered list item (e.g., "- item", "* item", "• item")
    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (currentList && currentList.type !== 'unordered_list') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'unordered_list', items: [] };
      }
      (currentList as { type: 'unordered_list'; items: string[] }).items.push(
        ulMatch[1]
      );
      continue;
    }

    // Indented continuation of list item
    if (currentList && (line.startsWith('   ') || line.startsWith('\t'))) {
      if (currentList.type === 'ordered_list') {
        const last = currentList.items[currentList.items.length - 1];
        if (last) last.text += '\n' + line.trim();
      } else if (currentList.type === 'unordered_list') {
        const lastIdx = currentList.items.length - 1;
        if (lastIdx >= 0) currentList.items[lastIdx] += '\n' + line.trim();
      }
      continue;
    }

    // Regular paragraph line
    flushList();
    currentParagraphLines.push(line);
  }

  if (inCode) {
    blocks.push({
      type: 'code',
      language: codeLang,
      content: codeLines.join('\n'),
    });
  } else {
    flushAll();
  }

  return blocks;
}

export default function MarkdownRenderer({
  content,
  className = '',
  variant = 'assistant',
}: MarkdownRendererProps) {
  if (!content) return null;

  const blocks = parseBlocks(content);
  const isUser = variant === 'user';

  return (
    <div className={`space-y-2.5 ${className}`}>
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h3
                  key={bIdx}
                  className={`text-sm font-bold pt-1 pb-0.5 border-b ${
                    isUser
                      ? 'text-white border-indigo-400/40'
                      : 'text-slate-950 dark:text-white border-slate-200 dark:border-navy-700'
                  }`}
                >
                  {renderInline(block.text, variant, `h1-${bIdx}`)}
                </h3>
              );
            }
            if (block.level === 2) {
              return (
                <h4
                  key={bIdx}
                  className={`text-[13px] font-bold pt-1 ${
                    isUser ? 'text-white' : 'text-slate-950 dark:text-white'
                  }`}
                >
                  {renderInline(block.text, variant, `h2-${bIdx}`)}
                </h4>
              );
            }
            return (
              <h5
                key={bIdx}
                className={`text-[12px] font-bold ${
                  isUser ? 'text-white' : 'text-slate-950 dark:text-slate-100'
                }`}
              >
                {renderInline(block.text, variant, `h3-${bIdx}`)}
              </h5>
            );
          }

          case 'paragraph': {
            return (
              <p
                key={bIdx}
                className="leading-relaxed break-words whitespace-pre-wrap"
              >
                {renderInline(block.text, variant, `p-${bIdx}`)}
              </p>
            );
          }

          case 'ordered_list': {
            return (
              <ol key={bIdx} className="space-y-1.5 my-1 pl-0.5">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="flex items-start gap-2">
                    <span
                      className={`font-bold text-[12px] mt-0.5 shrink-0 min-w-[18px] ${
                        isUser
                          ? 'text-indigo-200'
                          : 'text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {item.num}.
                    </span>
                    <div className="flex-1 min-w-0 leading-relaxed break-words whitespace-pre-wrap">
                      {renderInline(item.text, variant, `ol-${bIdx}-${iIdx}`)}
                    </div>
                  </li>
                ))}
              </ol>
            );
          }

          case 'unordered_list': {
            return (
              <ul key={bIdx} className="space-y-1.5 my-1 pl-0.5">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="flex items-start gap-2">
                    <span
                      className={`font-bold shrink-0 text-base leading-none mt-1 ${
                        isUser
                          ? 'text-indigo-200'
                          : 'text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      •
                    </span>
                    <div className="flex-1 min-w-0 leading-relaxed break-words whitespace-pre-wrap">
                      {renderInline(item, variant, `ul-${bIdx}-${iIdx}`)}
                    </div>
                  </li>
                ))}
              </ul>
            );
          }

          case 'blockquote': {
            return (
              <blockquote
                key={bIdx}
                className={`border-l-2 pl-3 py-1 my-1.5 rounded-r-md italic ${
                  isUser
                    ? 'border-indigo-300 bg-indigo-700/50 text-indigo-100'
                    : 'border-indigo-600 dark:border-indigo-400 bg-slate-100/60 dark:bg-navy-950/40 text-slate-800 dark:text-slate-200'
                }`}
              >
                {renderInline(block.text, variant, `quote-${bIdx}`)}
              </blockquote>
            );
          }

          case 'code': {
            return (
              <pre
                key={bIdx}
                className="bg-slate-900 dark:bg-navy-950 text-slate-100 p-3 rounded-xl text-[12px] font-mono overflow-x-auto my-2 border border-slate-700/60 dark:border-navy-800"
              >
                <code>{block.content}</code>
              </pre>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
