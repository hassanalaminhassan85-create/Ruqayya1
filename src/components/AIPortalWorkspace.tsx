import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, Bot, User, Trash2, ArrowRight, Copy, Check, RotateCcw,
  TrendingUp, FileText, Search, ShieldAlert, BookOpen, Calculator, HelpCircle,
  Upload, FileUp, Paperclip, X, Download, AlertCircle, FileCheck
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIPortalWorkspaceProps {
  lang: 'en' | 'ha';
  currentRole: string;
  userName: string;
}

export const AIPortalWorkspace: React.FC<AIPortalWorkspaceProps> = ({
  lang,
  currentRole,
  userName
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  
  // Document AI State
  const [attachedFiles, setAttachedFiles] = useState<{name: string, type: string, size: string, base64?: string}[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Load welcome briefing on mount
  useEffect(() => {
    // Check if there are existing messages in state or load briefing
    if (messages.length === 0) {
      triggerDashboardBriefing();
    }
  }, [currentRole]);

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

  // Drag and drop handlers for Document AI
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const processFiles = (files: FileList) => {
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
  };

  const removeAttachment = (idx: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Universal streaming AI API caller
  const executeAICommand = async (endpoint: string, payload: any) => {
    setIsLoading(true);
    setStreamingContent('');
    
    try {
      const token = localStorage.getItem('ruqayya_token');
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
          setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'assistant', content: accumulated }]);
        }
      } else {
        const data = await response.json() as any;
        if (data.response) {
          setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'assistant', content: data.response }]);
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev, 
        { 
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant', 
          content: `### ${lang === 'en' ? 'System Error' : 'Kuskuren Tsari'}\n\n${err.message}` 
        }
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  // Main input form submission
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0 || isLoading) return;

    let userPrompt = input.trim();
    const hasAttachments = attachedFiles.length > 0;
    
    if (hasAttachments) {
      const filesInfo = attachedFiles.map(f => `[File Attached: ${f.name} (Type: ${f.type}, Size: ${f.size})]`).join('\n');
      userPrompt = `${userPrompt || 'Please analyze this uploaded document and extract key metrics/information.'}\n\n${filesInfo}`;
    }

    setInput('');
    setAttachedFiles([]);
    setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: userPrompt }]);

    // Determine if it's document query or general chat
    if (hasAttachments) {
      await executeAICommand('/api/ai/document', {
        documentId: attachedFiles[0].name,
        prompt: userPrompt
      });
    } else {
      await executeAICommand('/api/ai/chat', {
        prompt: userPrompt,
        history: messages,
        page: 'Fullscreen AI Intelligence Workspace',
        feature: 'Advanced Copilot Page'
      });
    }
  };

  // Regenerate last user message
  const handleRegenerate = async () => {
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0 || isLoading) return;
    
    const lastPrompt = userMsgs[userMsgs.length - 1].content;
    setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: `${lang === 'en' ? 'Retry query:' : 'Sake tambaya:'} "${lastPrompt}"` }]);
    
    await executeAICommand('/api/ai/chat', {
      prompt: lastPrompt,
      history: messages.slice(0, -1),
      page: 'Fullscreen AI Intelligence Workspace'
    });
  };

  // Shortcuts
  const triggerReportSummary = async (type: string) => {
    setMessages(prev => [...prev, { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: lang === 'en' ? `Summarize ${type} reports` : `Takaice rahoton ${type}` 
    }]);
    await executeAICommand('/api/ai/report', { reportType: type });
  };

  const triggerSmartSearch = async (query: string) => {
    setMessages(prev => [...prev, { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: lang === 'en' ? `Search database for: "${query}"` : `Nemi bayanai akan: "${query}"` 
    }]);
    await executeAICommand('/api/ai/search', { query });
  };

  const triggerAnalyticsForecast = async (metric: string) => {
    setMessages(prev => [...prev, { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: lang === 'en' ? `Generate analytical forecast for ${metric}` : `Bincika & hasashen ${metric}` 
    }]);
    await executeAICommand('/api/ai/analytics', { metric });
  };

  const triggerSystemHelp = async (topic: string) => {
    setMessages(prev => [...prev, { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: lang === 'en' ? `Explain system task: ${topic}` : `Bayyana yadda ake: ${topic}` 
    }]);
    await executeAICommand('/api/ai/system', { topic });
  };

  const triggerLedgerExplain = async (entityId: string) => {
    setMessages(prev => [...prev, { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: lang === 'en' ? `Explain & audit ledger transaction ${entityId}` : `Warware Matsalar Ciniki ${entityId}` 
    }]);
    await executeAICommand('/api/ai/explain', { entityId });
  };

  const triggerDashboardBriefing = async () => {
    setIsLoading(true);
    setStreamingContent('');
    try {
      const token = localStorage.getItem('ruqayya_token');
      const response = await fetch('/api/ai/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stream: true })
      });

      if (!response.ok) throw new Error('Could not pull secure system data context.');

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
          setMessages([{ id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'assistant', content: accumulated }]);
        }
      }
    } catch (err: any) {
      setMessages([
        { 
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant', 
          content: `### Welcome back, ${userName}! 

We loaded your secure role-based permissions context. Since you're operating inside the restricted ERP workspace, ask me any questions about the live assets, driver rosters, ledger ledger, or remittances. 

*(Workers AI local binding initialized)*` 
        }
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] md:h-[calc(100vh-20px)] bg-slate-950/20 rounded-[24px] border border-slate-800 overflow-hidden relative">
      
      {/* HEADER SECTION */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-brand-gold/10 rounded-xl border border-brand-gold/30 flex items-center justify-center text-brand-gold">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-brand-gold">
              {lang === 'en' ? 'Ruqayya AI Intelligence Hub' : 'Ruqayya AI Kwalejin Ilimi'}
            </h1>
            <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {lang === 'en' ? `Authorized ERP Access Context: ${currentRole}` : `Matsayin damar rukunin: ${currentRole}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <>
              <button
                onClick={handleRegenerate}
                disabled={isLoading || messages.filter(m => m.role === 'user').length === 0}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all disabled:opacity-50"
                title="Regenerate Last Response"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Regenerate</span>
              </button>

              <button
                onClick={clearChat}
                className="p-2 bg-slate-900 hover:bg-red-950/20 border border-slate-800 text-slate-400 hover:text-red-400 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CORE SPLIT SCREEN LAYOUT: QUICK SHORTS RAIL + CONVERSATION LOG */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* QUICK SHORTS RAIL (LEFT SIDE - DESKTOP ONLY) */}
        <div className="hidden lg:flex w-72 border-r border-slate-800/80 bg-slate-950/10 p-5 flex-col gap-4 overflow-y-auto">
          <div>
            <h4 className="text-[10px] font-mono font-black uppercase text-slate-500 tracking-wider">
              {lang === 'en' ? 'Smart AI Actions' : 'Hanyoyin AI Gaggawa'}
            </h4>
            <p className="text-[10px] text-slate-400 mt-1">
              {lang === 'en' ? 'Run secure direct actions on live context.' : 'Aiwatar da tambayoyi akan kudaden yau.'}
            </p>
          </div>

          <div className="space-y-2.5">
            {currentRole !== 'driver' && currentRole !== 'shareholder' && (
              <>
                <span className="text-[9px] font-bold text-brand-gold/60 block mt-2 uppercase tracking-wide">Financial Briefs</span>
                <button
                  onClick={() => triggerReportSummary('Executive Summary')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <FileText className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">Executive Report</p>
                    <p className="text-[8px] text-slate-400 truncate">Summarize entire ERP status</p>
                  </div>
                </button>

                <button
                  onClick={() => triggerReportSummary('Remittance')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <Calculator className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">Daily Remittance Summary</p>
                    <p className="text-[8px] text-slate-400 truncate">Calculate ledger earnings</p>
                  </div>
                </button>

                <span className="text-[9px] font-bold text-brand-gold/60 block mt-2 uppercase tracking-wide">Risk & Forecasting</span>
                <button
                  onClick={() => triggerAnalyticsForecast('Fuel Voucher Utilization Trends')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <TrendingUp className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">Fuel Analytics</p>
                    <p className="text-[8px] text-slate-400 truncate">Voucher inflation and forecast</p>
                  </div>
                </button>

                <button
                  onClick={() => triggerSmartSearch('Outstanding driver debts and warnings')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <Search className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">Audit Driver Debts</p>
                    <p className="text-[8px] text-slate-400 truncate">Who is behind on cycles</p>
                  </div>
                </button>

                <button
                  onClick={() => triggerSystemHelp('Adding Drivers and Assigning Vehicles')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <HelpCircle className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">Fleet Roster Help</p>
                    <p className="text-[8px] text-slate-400 truncate">How to expand driver roster</p>
                  </div>
                </button>
              </>
            )}

            {currentRole === 'driver' && (
              <>
                <span className="text-[9px] font-bold text-brand-gold/60 block mt-2 uppercase tracking-wide">My Financial Workspace</span>
                <button
                  onClick={() => triggerReportSummary('Personal Remittance')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <Calculator className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">My Outstanding Debt</p>
                    <p className="text-[8px] text-slate-400 truncate">Calculate my current cycle balance</p>
                  </div>
                </button>

                <button
                  onClick={() => triggerSystemHelp('Request Fuel Voucher')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <BookOpen className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">Requesting Fuel Vouchers</p>
                    <p className="text-[8px] text-slate-400 truncate">Guide for active fleet fuel</p>
                  </div>
                </button>
              </>
            )}

            {currentRole === 'shareholder' && (
              <>
                <span className="text-[9px] font-bold text-brand-gold/60 block mt-2 uppercase tracking-wide">Investment Ledger</span>
                <button
                  onClick={() => triggerReportSummary('Dividend Distribution')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <TrendingUp className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">My Returns Analysis</p>
                    <p className="text-[8px] text-slate-400 truncate">Track dividend distribution cycles</p>
                  </div>
                </button>

                <button
                  onClick={() => triggerSmartSearch('Financial Ledger')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800/80 hover:border-brand-gold/30 hover:bg-slate-850 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                >
                  <Search className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-200">Audit Ledger Books</p>
                    <p className="text-[8px] text-slate-400 truncate">Read ledger double-entry lines</p>
                  </div>
                </button>
              </>
            )}
          </div>
          
          {/* SECURE BLOCK WARNING */}
          <div className="mt-auto bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex gap-2">
            <ShieldAlert className="h-4 w-4 text-brand-gold shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[9px] font-black font-mono text-slate-400 block uppercase">Enterprise Shield</span>
              <span className="text-[8.5px] text-slate-500 leading-normal block mt-1">
                Security constraints actively prevent prompt injection or credential leakage. All secrets are scrubbed at the edge.
              </span>
            </div>
          </div>
        </div>

        {/* CHAT LOG SCREEN */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex-1 flex flex-col justify-between bg-slate-900/10 relative overflow-hidden"
        >
          
          {/* CHAT CONTAINER BODY */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth">
            
            {/* NO MESSAGES PLACEHOLDER */}
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto py-24">
                <div className="h-14 w-14 bg-brand-gold/5 rounded-2xl border border-brand-gold/20 flex items-center justify-center text-brand-gold mb-5 shadow-inner">
                  <Bot className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-black text-slate-200 tracking-tight">
                  {lang === 'en' ? `Salutations, ${userName}!` : `Sannu da zuwa, ${userName}!`}
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {lang === 'en' 
                    ? "Welcome to your personal AI intelligence terminal. I have secure clearance to assist you with active operations. Try asking me a question or drag-and-drop a voucher receipt to get started." 
                    : "Barka da zuwa babbar cibiyar AI. Ina da ikon taimaka maka da lissafin asusu da rukunin motoci. Rubuta tambaya a kasa."
                  }
                </p>
              </div>
            )}

            {/* MESSAGE ITERATIONS */}
            {messages.map((msg, idx) => (
              <div 
                key={msg.id}
                className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* ICON */}
                <div className={`h-8 w-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold border transition-colors ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 border-slate-700 text-brand-gold' 
                    : 'bg-brand-gold/10 border-brand-gold/30 text-brand-gold'
                }`}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* TEXT CONTAINER */}
                <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed border relative group ${
                    msg.role === 'user' 
                      ? 'bg-slate-800 border-slate-700 text-slate-100 rounded-tr-none' 
                      : 'bg-slate-950/80 border-slate-800/80 text-slate-200 rounded-tl-none whitespace-pre-wrap'
                  }`}>
                    
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}

                    {/* MICRO ACTIONS (COPY BUTTONS) */}
                    <button
                      type="button"
                      onClick={() => copyMessageText(msg.content, idx)}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md border border-slate-800 transition-all cursor-pointer"
                      title="Copy response text"
                    >
                      {copiedMsgIdx === idx ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* STREAMING CHUNK */}
            {streamingContent && (
              <div className="flex gap-4 max-w-[85%] mr-auto">
                <div className="h-8 w-8 rounded-xl shrink-0 flex items-center justify-center bg-brand-gold/10 border border-brand-gold/30 text-brand-gold">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="p-4 rounded-2xl text-xs leading-relaxed bg-slate-950/80 border border-slate-800/80 text-slate-200 rounded-tl-none whitespace-pre-wrap">
                  <MarkdownRenderer content={streamingContent} />
                  <span className="inline-block w-1.5 h-3 bg-brand-gold ml-1 animate-ping" />
                </div>
              </div>
            )}

            {/* TYPING DOTS FOR STANDBY */}
            {isLoading && !streamingContent && (
              <div className="flex gap-4 max-w-[85%] mr-auto">
                <div className="h-8 w-8 rounded-xl shrink-0 flex items-center justify-center bg-brand-gold/10 border border-brand-gold/30 text-brand-gold">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* DRAG-AND-DROP ACTIVE OVERLAY */}
          {isDragging && (
            <div className="absolute inset-0 bg-slate-950/80 border-2 border-dashed border-brand-gold/40 flex flex-col items-center justify-center gap-2 z-20">
              <FileUp className="h-10 w-10 text-brand-gold animate-bounce" />
              <p className="text-xs font-bold text-slate-200">Drop your document or receipt here to start Document AI audit</p>
              <p className="text-[10px] text-slate-500">Supports PDF, PNG, JPEG, Excel, and Word files</p>
            </div>
          )}

          {/* ACTIVE FILE ATTACHMENTS TRAY */}
          {attachedFiles.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex flex-wrap gap-2.5">
              {attachedFiles.map((file, fIdx) => (
                <div key={fIdx} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-[10.5px]">
                  <FileCheck className="h-4 w-4 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-200 truncate max-w-xs">{file.name}</p>
                    <p className="text-[8px] text-slate-500">{file.size} • Document AI</p>
                  </div>
                  <button
                    onClick={() => removeAttachment(fIdx)}
                    className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors ml-1 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* BOTTOM INTERACTIVE INPUT PANEL */}
          <div className="p-5 border-t border-slate-800 bg-slate-900/60 backdrop-blur-md">
            <form onSubmit={handleSend} className="flex gap-2.5 items-end">
              <div className="flex-1 relative bg-slate-950 border border-slate-800 focus-within:border-brand-gold/50 focus-within:ring-1 focus-within:ring-brand-gold/30 rounded-2xl p-1.5 transition-all flex items-center gap-2">
                
                {/* Paperclip button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-brand-gold rounded-xl hover:bg-slate-900 transition-all cursor-pointer shrink-0"
                  title="Attach corporate files or receipt vouchers"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple
                />

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={lang === 'en' ? "Ask anything about active vehicles, driver records, or ledger double-entry reconciliation..." : "Rubuta tambaya a nan..."}
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50"
                />

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                  className="p-2.5 bg-brand-gold hover:bg-yellow-500 text-slate-950 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 shrink-0 cursor-pointer"
                >
                  <Send className="h-4 w-4 font-black" />
                </button>
              </div>
            </form>
            
            <div className="flex justify-between items-center mt-3 text-[9.5px]">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
                {lang === 'en' ? 'HIPAA & GDPR Enterprise Level Isolation' : 'Tsaro na Babba Matakin Kamfani'}
              </span>
              <span className="font-mono text-brand-gold/70 font-black tracking-wider uppercase">
                Workers AI x Google GenAI Fallback
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
