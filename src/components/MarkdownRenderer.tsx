import React from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopyCode = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Pre-process double newlines and carriage returns
  const normalizedContent = content.replace(/\r\n/g, '\n');

  // Split into paragraphs, lists, or code blocks
  const parts = normalizedContent.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3.5 text-xs text-slate-200">
      {parts.map((part, index) => {
        // Render Code Block
        if (part.startsWith('```')) {
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : '';
          const codeText = match ? match[2].trim() : part.slice(3, -3).trim();

          return (
            <div key={index} className="relative my-3.5 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden font-mono text-[11px] leading-relaxed">
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400">
                <span className="uppercase tracking-wider">{lang || 'CODE'}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeText, index)}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-slate-300 whitespace-pre scrollbar-none">{codeText}</pre>
            </div>
          );
        }

        // Render normal markdown blocks (headers, lists, tables)
        const lines = part.split('\n');
        return (
          <div key={index} className="space-y-2">
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();

              // Empty lines
              if (!trimmed) return <div key={lineIdx} className="h-2" />;

              // Headers
              if (trimmed.startsWith('# ')) {
                return (
                  <h1 key={lineIdx} className="text-lg font-black text-brand-gold tracking-tight pt-2 border-b border-slate-800 pb-1 mt-3">
                    {renderInlineStyles(trimmed.slice(2))}
                  </h1>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={lineIdx} className="text-sm font-extrabold text-brand-gold tracking-tight pt-2 mt-2">
                    {renderInlineStyles(trimmed.slice(3))}
                  </h2>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={lineIdx} className="text-xs font-bold text-slate-100 tracking-tight pt-1">
                    {renderInlineStyles(trimmed.slice(4))}
                  </h3>
                );
              }

              // Bullet Points
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lineIdx} className="flex gap-2.5 items-start pl-2 text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-gold shrink-0 mt-2" />
                    <span className="flex-1">{renderInlineStyles(trimmed.slice(2))}</span>
                  </div>
                );
              }

              // Numbered Lists
              const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
              if (numMatch) {
                return (
                  <div key={lineIdx} className="flex gap-2 items-start pl-2 text-slate-200">
                    <span className="text-[10px] font-mono font-black text-brand-gold shrink-0 mt-0.5">{numMatch[1]}.</span>
                    <span className="flex-1">{renderInlineStyles(numMatch[2])}</span>
                  </div>
                );
              }

              // Tables (e.g. | Header 1 | Header 2 |)
              if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                // Skip separator lines e.g. |---|---|
                if (trimmed.includes('---')) return null;
                const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
                return (
                  <div key={lineIdx} className="grid grid-flow-col auto-cols-fr gap-2 bg-slate-950/40 p-2.5 border border-slate-800/80 rounded-lg text-[10.5px] my-1 items-center">
                    {cells.map((cell, cIdx) => (
                      <span key={cIdx} className="truncate font-semibold text-slate-300">
                        {renderInlineStyles(cell)}
                      </span>
                    ))}
                  </div>
                );
              }

              // Normal text line
              return (
                <p key={lineIdx} className="leading-relaxed whitespace-pre-wrap">
                  {renderInlineStyles(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// Simple inline styles helper (Bold **, Monospace `, Link [text](url))
function renderInlineStyles(text: string): React.ReactNode[] {
  // Regex to split on bold ** and monospace `
  const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-extrabold text-brand-gold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded-md bg-slate-950 text-brand-gold border border-slate-800 font-mono text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a
            key={i}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-gold hover:underline font-bold"
          >
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
}
