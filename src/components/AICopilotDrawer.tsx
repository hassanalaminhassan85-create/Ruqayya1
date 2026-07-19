import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, Send, Bot, User, Trash2, ArrowRight, RotateCcw, Copy, Check,
  TrendingUp, FileText, Search, ShieldAlert, BookOpen, Calculator, HelpCircle,
  Maximize2, Minimize2, Paperclip, FileCheck
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'ha';
  currentRole: string;
  userName: string;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  lang,
  currentRole,
  userName
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Document AI Attachments State
  const [attachedFiles, setAttachedFiles] = useState<{name: string, type: string, size: string, base64?: string}[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Load welcome greeting on mount or open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      triggerDashboardBriefing();
    }
  }, [isOpen]);

  const clearChat = () => {
    setMessages([]);
    setStreamingContent('');
    setAttachedFiles([]);
  };

  const copyMessageText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = e.target.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = () => {
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: `${(file.size / 1024).toFixed(1)} KB`,
            base64: reader.result as string
          }]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Helper to handle standard non-streaming or streaming endpoints
  const executeAICommand = async (endpoint: string, payload: any) => {
    setIsLoading(true);
    setStreamingContent('');
    
    try {
      const token = localStorage.getItem('ruqayya_erp_token');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...payload, stream: true })
      });

      if (!response.ok) {
        throw new Error(lang === 'en' ? 'Server rejected AI request.' : 'Saba ta ki karbar bukatar AI.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      if (reader) {
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.trim().startsWith('data:')) {
                const dataStr = line.replace('data:', '').trim();
                if (dataStr === '[DONE]') break;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.text) {
                    accumulated += parsed.text;
                    setStreamingContent(accumulated);
                  }
                } catch {
                  // Fallback
                }
              }
            }
          }
        }
        
        if (accumulated) {
          setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
        }
      } else {
        // Fallback if reader not supported
        const data = await response.json() as any;
        if (data.response) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: `${lang === 'en' ? 'System Error:' : 'Kuskure:'} ${err.message}` 
        }
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  // Sub-handler: Standard Chat Input Submit
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0 || isLoading) return;

    let userPrompt = input.trim();
    const hasAttachments = attachedFiles.length > 0;

    if (hasAttachments) {
      const filesInfo = attachedFiles.map(f => `[File Attached: ${f.name} (Type: ${f.type}, Size: ${f.size})]`).join('\n');
      userPrompt = `${userPrompt || 'Extract information from attached receipt/document.'}\n\n${filesInfo}`;
    }

    setInput('');
    setAttachedFiles([]);
    setMessages(prev => [...prev, { role: 'user', content: userPrompt }]);

    if (hasAttachments) {
      await executeAICommand('/api/ai/document', {
        documentId: attachedFiles[0].name,
        prompt: userPrompt
      });
    } else {
      await executeAICommand('/api/ai/chat', {
        prompt: userPrompt,
        history: messages,
        page: window.location.pathname,
        feature: 'Global Interactive Sidebar'
      });
    }
  };

  // Regenerate last user query
  const handleRegenerate = async () => {
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0 || isLoading) return;
    const lastPrompt = userMsgs[userMsgs.length - 1].content;
    setMessages(prev => [...prev, { role: 'user', content: `${lang === 'en' ? 'Retry query:' : 'Sake tambaya:'} "${lastPrompt}"` }]);
    await executeAICommand('/api/ai/chat', {
      prompt: lastPrompt,
      history: messages.slice(0, -1),
      page: window.location.pathname
    });
  };

  // Endpoint 2: Summarize Report
  const triggerReportSummary = async (type: string) => {
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: lang === 'en' ? `Summarize ${type} report` : `Takaice rahoton ${type}` 
    }]);
    await executeAICommand('/api/ai/report', { reportType: type });
  };

  // Endpoint 3: Smart Search
  const triggerSmartSearch = async (query: string) => {
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: lang === 'en' ? `Search database for: ${query}` : `Nemi bayanai akan: ${query}` 
    }]);
    await executeAICommand('/api/ai/search', { query });
  };

  // Endpoint 4: Document Audit
  const triggerDocumentAudit = async (docId: string) => {
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: lang === 'en' ? `Audit Document ID: ${docId}` : `Bincika Takarda Mai ID: ${docId}` 
    }]);
    await executeAICommand('/api/ai/document', { documentId: docId });
  };

  // Endpoint 5: Advanced Business Analytics
  const triggerAnalyticsForecast = async (metric: string) => {
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: lang === 'en' ? `Analyze & forecast: ${metric}` : `Bincika & hasashen: ${metric}` 
    }]);
    await executeAICommand('/api/ai/analytics', { metric });
  };

  // Endpoint 6: Interactive System Help
  const triggerSystemHelp = async (topic: string) => {
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: lang === 'en' ? `Explain system task: ${topic}` : `Bayyana yadda ake: ${topic}` 
    }]);
    await executeAICommand('/api/ai/system', { topic });
  };

  // Endpoint 7: Double-Entry Ledger Reconciliation
  const triggerLedgerExplain = async (entityId: string) => {
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: lang === 'en' ? `Reconcile Transaction: ${entityId}` : `Warware Matsalar Ciniki: ${entityId}` 
    }]);
    await executeAICommand('/api/ai/explain', { entityId });
  };

  // Endpoint 8: Dashboard Personalized Briefing
  const triggerDashboardBriefing = async () => {
    setIsLoading(true);
    setStreamingContent('');
    try {
      const token = localStorage.getItem('ruqayya_erp_token');
      const response = await fetch('/api/ai/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stream: true })
      });

      if (!response.ok) throw new Error('Failed to load personalized AI welcome briefing.');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      if (reader) {
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.trim().startsWith('data:')) {
                const dataStr = line.replace('data:', '').trim();
                if (dataStr === '[DONE]') break;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.text) {
                    accumulated += parsed.text;
                    setStreamingContent(accumulated);
                  }
                } catch {
                  // Fallback
                }
              }
            }
          }
        }
        if (accumulated) {
          setMessages([{ role: 'assistant', content: accumulated }]);
        }
      }
    } catch (err: any) {
      setMessages([
        { 
          role: 'assistant', 
          content: `${lang === 'en' ? 'Welcome to Ruqayya ERP AI Portal.' : 'Barka da zuwa Ruqayya ERP AI Portal.'}\n\nAsk me any question about the live database context.` 
        }
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  // Generate localized titles & placeholders
  const getUIString = (key: string) => {
    const dict: any = {
      title: {
        en: "Ruqayya AI Copilot",
        ha: "Mataimakin Ruqayya AI"
      },
      subtitle: {
        en: `Active Session Role: ${currentRole.toUpperCase()}`,
        ha: `Matsayin rukunin aiki: ${currentRole.toUpperCase()}`
      },
      placeholder: {
        en: "Ask AI or drop files (remittances, drivers, ledger)...",
        ha: "Tambayi AI ko sanya takarda (motoci, kudin shiga)..."
      },
      clear: {
        en: "Clear",
        ha: "Goge"
      },
      welcome: {
        en: "Secure Corporate Context Loaded. How can I assist you today?",
        ha: "An loda bayanan kamfanoni cikin aminci. Ta yaya zan taimake ka yau?"
      },
      shortcuts: {
        en: "Quick AI Operational Tools",
        ha: "Hanyoyi na Gaggawa na AI"
      }
    };
    return dict[key]?.[lang] || dict[key]?.['en'];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* BACKDROP */}
          <div 
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 cursor-pointer"
          />

          {/* DRAWER PANEL */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
            className={`fixed inset-y-0 right-0 ${isMaximized ? 'w-full sm:max-w-none' : 'w-full sm:max-w-md'} bg-slate-900 border-l border-slate-800 text-white shadow-2xl z-55 flex flex-col transition-all duration-300`}
          >
            {/* HEADER */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 bg-brand-gold/10 rounded-xl border border-brand-gold/30 flex items-center justify-center text-brand-gold">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-brand-gold">
                    {getUIString('title')}
                  </h3>
                  <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                    {getUIString('subtitle')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Maximize Toggle */}
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? "Minimize Sidebar" : "Maximize Fullscreen"}
                  className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>

                {messages.length > 0 && (
                  <>
                    <button
                      onClick={handleRegenerate}
                      disabled={isLoading}
                      title="Regenerate last response"
                      className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>

                    <button
                      onClick={clearChat}
                      title={getUIString('clear')}
                      className="p-1.5 bg-slate-800 hover:bg-red-950/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}

                <button
                  onClick={onClose}
                  className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* CHAT LOG */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/40">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-10 px-4">
                  <Bot className="h-10 w-10 text-brand-gold/40 mx-auto mb-3" />
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    {getUIString('welcome')}
                  </p>
                </div>
              )}

              {/* MESSAGES RENDERING */}
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                    msg.role === 'user' 
                      ? 'bg-brand-navy border border-slate-700 text-brand-gold' 
                      : 'bg-brand-gold/10 border border-brand-gold/30 text-brand-gold'
                  }`}>
                    {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed border relative group ${
                    msg.role === 'user' 
                      ? 'bg-slate-800 border-slate-700 text-slate-100 rounded-tr-none' 
                      : 'bg-slate-950 border-slate-800/80 text-slate-200 rounded-tl-none whitespace-pre-wrap'
                  }`}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}

                    <button
                      onClick={() => copyMessageText(msg.content, idx)}
                      className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md border border-slate-800 transition-all cursor-pointer"
                      title="Copy response"
                    >
                      {copiedMsgIdx === idx ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {/* STREAMING CHUNK */}
              {streamingContent && (
                <div className="flex gap-3 max-w-[85%] mr-auto">
                  <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold bg-brand-gold/10 border border-brand-gold/30 text-brand-gold">
                    <Bot className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="p-3 rounded-2xl text-xs leading-relaxed bg-slate-950 text-slate-200 border border-slate-800/80 rounded-tl-none whitespace-pre-wrap">
                    <MarkdownRenderer content={streamingContent} />
                    <span className="inline-block w-1.5 h-3 bg-brand-gold ml-1 animate-ping" />
                  </div>
                </div>
              )}

              {/* LOADING SKELETON */}
              {isLoading && !streamingContent && (
                <div className="flex gap-3 max-w-[85%] mr-auto">
                  <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold bg-brand-gold/10 border border-brand-gold/30 text-brand-gold">
                    <Bot className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 rounded-tl-none flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* QUICK OPERATIONS SHORTS */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
              <span className="text-[10px] font-mono uppercase font-black tracking-wider text-slate-500 block mb-2">
                {getUIString('shortcuts')}
              </span>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                {currentRole !== 'driver' && currentRole !== 'shareholder' && (
                  <>
                    <button
                      onClick={() => triggerReportSummary('Remittance')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <FileText className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Remittances</p>
                        <p className="text-[8px] text-slate-500 truncate">Summarize revenue</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerAnalyticsForecast('Fuel Vouchers')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Fuel Analytics</p>
                        <p className="text-[8px] text-slate-500 truncate">Voucher analysis</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSmartSearch('Pending Approvals')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <Search className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Approvals Search</p>
                        <p className="text-[8px] text-slate-500 truncate">Find active queues</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSystemHelp('Adding Drivers')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Roster Setup</p>
                        <p className="text-[8px] text-slate-500 truncate">Operational guide</p>
                      </div>
                    </button>
                  </>
                )}

                {currentRole === 'driver' && (
                  <>
                    <button
                      onClick={() => triggerReportSummary('Personal Remittance')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <Calculator className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">My Balance</p>
                        <p className="text-[8px] text-slate-500 truncate">Calculate valuation</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSystemHelp('Request Voucher')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Voucher Help</p>
                        <p className="text-[8px] text-slate-500 truncate">Guide for fuel requests</p>
                      </div>
                    </button>
                  </>
                )}

                {currentRole === 'shareholder' && (
                  <>
                    <button
                      onClick={() => triggerReportSummary('Dividend Distribution')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">My Dividends</p>
                        <p className="text-[8px] text-slate-500 truncate">Revenue share</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSmartSearch('Financial Ledger')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <Search className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Ledger Books</p>
                        <p className="text-[8px] text-slate-500 truncate">Audit corporate books</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ACTIVE ATTACHMENTS FOR SIDEBAR */}
            {attachedFiles.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/60 flex flex-wrap gap-2">
                {attachedFiles.map((file, fIdx) => (
                  <div key={fIdx} className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[9.5px]">
                    <FileCheck className="h-3 w-3 text-brand-gold shrink-0" />
                    <span className="font-bold text-slate-300 truncate max-w-[120px]">{file.name}</span>
                    <button
                      onClick={() => removeAttachment(fIdx)}
                      className="text-slate-400 hover:text-white rounded cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* INPUT FOOTER */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 backdrop-blur-sm">
              <form onSubmit={handleSend} className="flex gap-2 relative items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-slate-400 hover:text-brand-gold bg-slate-850 rounded-lg border border-slate-800 hover:border-brand-gold/30 transition-all cursor-pointer shrink-0"
                  title="Attach file for Document AI analysis"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={getUIString('placeholder')}
                    disabled={isLoading}
                    className="w-full bg-slate-850 border border-slate-800 rounded-xl py-2 pl-3 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-gold/60 focus:ring-1 focus:ring-brand-gold/30 disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-gold hover:text-yellow-500 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
              <div className="flex justify-between items-center mt-2.5">
                <span className="text-[9px] text-slate-500 font-medium">
                  {lang === 'en' ? "🔒 HIPAA/Enterprise encryption active" : "🔒 Kayan tsaro na musamman yana aiki"}
                </span>
                <span className="text-[9px] font-mono text-brand-gold/60 font-bold uppercase">
                  Ruqayya Workers AI
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
