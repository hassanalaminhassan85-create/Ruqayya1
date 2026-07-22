import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, Bot, User, Trash2, RotateCcw, Plus, Menu, X, MessageSquare,
  TrendingUp, FileText, Search, ShieldAlert, BookOpen, Calculator, HelpCircle,
  Paperclip, Copy, Check, FileCheck, Mic, ArrowRight, Brain
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  attachedFiles: { name: string; type: string; size: string; base64?: string }[];
  createdAt: string;
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
  // State for Chat Sessions (ChatGPT history)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  
  // Mobile Sidebar Toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Document AI State
  const [attachedFiles, setAttachedFiles] = useState<{name: string, type: string, size: string, base64?: string}[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    const storageKey = `ruqayya_ai_chats_${userName}_${currentRole}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        } else {
          initNewSession();
        }
      } catch (e) {
        initNewSession();
      }
    } else {
      initNewSession();
    }
  }, [userName, currentRole]);

  // Persist sessions to localStorage when they change
  const saveSessions = (updatedSessions: ChatSession[]) => {
    const storageKey = `ruqayya_ai_chats_${userName}_${currentRole}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedSessions));
    setSessions(updatedSessions);
  };

  const initNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: lang === 'en' ? 'New Conversation' : 'Sabon Labari',
      messages: [],
      attachedFiles: [],
      createdAt: new Date().toISOString()
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setActiveSessionId(newSession.id);
    setInput('');
    setAttachedFiles([]);
    setStreamingContent('');
  };

  const getActiveSession = (): ChatSession | undefined => {
    return sessions.find(s => s.id === activeSessionId);
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    if (updated.length === 0) {
      const fallback: ChatSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: lang === 'en' ? 'New Conversation' : 'Sabon Labari',
        messages: [],
        attachedFiles: [],
        createdAt: new Date().toISOString()
      };
      saveSessions([fallback]);
      setActiveSessionId(fallback.id);
    } else {
      saveSessions(updated);
      if (activeSessionId === sessionId) {
        setActiveSessionId(updated[0].id);
      }
    }
  };

  // Auto scroll on new messages
  const activeSession = getActiveSession();
  const messages = activeSession ? activeSession.messages : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const copyMessageText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  // Drag and drop handlers
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

  // Unified AI API Caller
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
        
        if (accumulated && activeSessionId) {
          const updatedMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'assistant', content: accumulated };
          const updatedSessions = sessions.map(s => {
            if (s.id === activeSessionId) {
              return { ...s, messages: [...s.messages, updatedMsg] };
            }
            return s;
          });
          saveSessions(updatedSessions);
        }
      }
    } catch (err: any) {
      if (activeSessionId) {
        const errorMsg: Message = { 
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant', 
          content: `### ${lang === 'en' ? 'System Error' : 'Kuskuren Tsari'}\n\n${err.message}` 
        };
        const updatedSessions = sessions.map(s => {
          if (s.id === activeSessionId) {
            return { ...s, messages: [...s.messages, errorMsg] };
          }
          return s;
        });
        saveSessions(updatedSessions);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  // Main send handler
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || isLoading || !activeSessionId) return;

    let userPrompt = input.trim();
    const hasAttachments = attachedFiles.length > 0;
    
    if (hasAttachments) {
      const filesInfo = attachedFiles.map(f => `[File Attached: ${f.name} (Type: ${f.type}, Size: ${f.size})]`).join('\n');
      userPrompt = `${userPrompt || 'Please analyze this uploaded document.'}\n\n${filesInfo}`;
    }

    const originalInput = input.trim();
    setInput('');
    setAttachedFiles([]);

    const newUserMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: userPrompt };
    
    // Update active session with the user's message
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        // If it's the first message, rename the session title
        const isFirst = s.messages.length === 0;
        const newTitle = isFirst ? (originalInput.substring(0, 24) || 'Audit Request') + (originalInput.length > 24 ? '...' : '') : s.title;
        return { 
          ...s, 
          title: newTitle,
          messages: [...s.messages, newUserMsg] 
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    // Call API
    if (hasAttachments) {
      await executeAICommand('/api/ai/document', {
        documentId: attachedFiles[0].name,
        prompt: userPrompt
      });
    } else {
      await executeAICommand('/api/ai/chat', {
        prompt: userPrompt,
        history: messages,
        page: 'ChatGPT AI Dashboard',
        feature: 'Advanced Roster AI Copilot'
      });
    }
  };

  const handleRegenerate = async () => {
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0 || isLoading || !activeSessionId) return;
    
    const lastPrompt = userMsgs[userMsgs.length - 1].content;
    const retryMsg: Message = { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
      role: 'user', 
      content: lang === 'en' ? `Retry last query: "${lastPrompt}"` : `Sake tambaya: "${lastPrompt}"` 
    };

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [...s.messages, retryMsg] };
      }
      return s;
    });
    saveSessions(updatedSessions);
    
    await executeAICommand('/api/ai/chat', {
      prompt: lastPrompt,
      history: messages.slice(0, -1),
      page: 'ChatGPT AI Dashboard'
    });
  };

  // Direct action shortcuts (triggering live ERP state updates/summaries)
  const triggerReportSummary = async (type: string) => {
    if (!activeSessionId) return;
    const promptText = lang === 'en' ? `Summarize ${type} reports` : `Takaice rahoton ${type}`;
    const userMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: promptText };
    
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? `${type} Summary` : s.title,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    await executeAICommand('/api/ai/report', { reportType: type });
  };

  const triggerSmartSearch = async (query: string) => {
    if (!activeSessionId) return;
    const promptText = lang === 'en' ? `Search database for: "${query}"` : `Nemi bayanai akan: "${query}"`;
    const userMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: promptText };

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? `Search: ${query.substring(0, 15)}` : s.title,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    await executeAICommand('/api/ai/search', { query });
  };

  const triggerAnalyticsForecast = async (metric: string) => {
    if (!activeSessionId) return;
    const promptText = lang === 'en' ? `Generate analytical forecast for ${metric}` : `Bincika & hasashen ${metric}`;
    const userMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: promptText };

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? `Forecast: ${metric.substring(0, 15)}` : s.title,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    await executeAICommand('/api/ai/analytics', { metric });
  };

  const triggerSystemHelp = async (topic: string) => {
    if (!activeSessionId) return;
    const promptText = lang === 'en' ? `Explain system task: ${topic}` : `Bayyana yadda ake: ${topic}`;
    const userMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: promptText };

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? `Help: ${topic.substring(0, 15)}` : s.title,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    await executeAICommand('/api/ai/system', { topic });
  };

  const triggerDashboardBriefing = async () => {
    if (!activeSessionId) return;
    setIsLoading(true);
    setStreamingContent('');

    // Pre-emptively append the user briefing request
    const promptText = lang === 'en' ? 'Generate personalized operational morning briefing' : 'Fara jawabin taro na yau da safe';
    const userMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'user', content: promptText };

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          title: lang === 'en' ? 'Morning Briefing' : 'Jawabin Safe',
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

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
          const briefingMsg: Message = { id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, role: 'assistant', content: accumulated };
          const finalSessions = sessions.map(s => {
            if (s.id === activeSessionId) {
              return { ...s, messages: [...s.messages, briefingMsg] };
            }
            return s;
          });
          saveSessions(finalSessions);
        }
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        role: 'assistant',
        content: `### Briefing Load Error\n\n${err.message}`
      };
      const finalSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, errorMsg] };
        }
        return s;
      });
      saveSessions(finalSessions);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-80px)] md:h-[calc(100vh-20px)] bg-[#0d0e12] text-slate-100 font-sans rounded-2xl border border-slate-800/80 overflow-hidden relative">
      
      {/* 1. CHAT HISTORY SIDEBAR (CHATGPT STYLE) */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#12141c] border-r border-slate-800/60 p-4 flex flex-col gap-4 transform transition-transform duration-300 md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header: Brand & New Chat */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>
            <span className="text-xs font-black tracking-wider uppercase text-brand-gold">Ruqayya Transport</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white md:hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* "+ New Chat" Button */}
        <button
          onClick={() => {
            initNewSession();
            setSidebarOpen(false);
          }}
          className="w-full py-2.5 px-3.5 bg-slate-900 border border-slate-800/80 hover:bg-[#1a1d29] hover:border-brand-gold/30 rounded-xl flex items-center gap-2.5 text-left text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-sm group"
        >
          <Plus className="h-4 w-4 text-brand-gold group-hover:scale-110 transition-transform" />
          <span>{lang === 'en' ? 'New Chat' : 'Sabuwar Tattaunawa'}</span>
        </button>

        {/* Scrollable Conversation History */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          <div className="text-[10px] font-mono font-black uppercase text-slate-500 tracking-wider mb-2 mt-2">
            {lang === 'en' ? 'Chat History' : 'Tarihin Tattaunawa'}
          </div>
          {sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            return (
              <div
                key={sess.id}
                onClick={() => {
                  setActiveSessionId(sess.id);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full p-2.5 rounded-xl flex items-center justify-between gap-2.5 text-left text-xs transition-all cursor-pointer group relative
                  ${isActive ? 'bg-[#1e2233] text-brand-gold border-l-2 border-brand-gold' : 'hover:bg-slate-900/60 text-slate-300'}
                `}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-brand-gold' : 'text-slate-500'}`} />
                  <span className="truncate font-medium">{sess.title}</span>
                </div>
                {/* Trash delete icon */}
                <button
                  onClick={(e) => deleteSession(sess.id, e)}
                  className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: User Role and Profile card */}
        <div className="mt-auto pt-3 border-t border-slate-800/60 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-brand-gold text-xs font-black border border-slate-700">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-200 truncate">{userName}</p>
            <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 uppercase block w-max mt-0.5">
              {currentRole}
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE SIDEBAR BACKGROUND OVERLAY */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/70 z-30 md:hidden"
        />
      )}

      {/* 2. CHAT LOG SCREEN AREA */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 flex flex-col justify-between bg-[#0e1017] relative overflow-hidden"
      >
        
        {/* HEADER SECTION */}
        <div className="p-4 border-b border-slate-800/60 bg-[#0e1017]/80 backdrop-blur-md flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {/* Hamburger to open sidebar on mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl md:hidden cursor-pointer text-slate-300"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Desktop Brand / Context indicator */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {lang === 'en' ? `Live Context: ${currentRole}` : `Matsayi: ${currentRole}`}
              </span>
            </div>
            
            {/* Mobile Header title fallback */}
            <span className="md:hidden text-xs font-black text-slate-200 tracking-tight truncate max-w-[150px]">
              {activeSession ? activeSession.title : 'Ruqayya AI'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading || messages.filter(m => m.role === 'user').length === 0}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 cursor-pointer flex items-center gap-1 text-xs font-bold transition-all disabled:opacity-50"
                  title="Regenerate Response"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              </>
            )}
            <button
              onClick={initNewSession}
              className="p-2 bg-slate-900 hover:bg-[#1a1d29] border border-slate-800 text-slate-300 rounded-xl cursor-pointer flex items-center gap-1 text-xs font-bold transition-all"
            >
              <Plus className="h-3 w-3 text-brand-gold" />
              <span className="hidden sm:inline">{lang === 'en' ? 'New Chat' : 'Sabuwa'}</span>
            </button>
          </div>
        </div>

        {/* CHAT CONTAINER BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-[#0d0e12]/30">
          
          {/* CHATGPT STYLE WELCOME CENTER (EMPTY STATE) */}
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-12 md:py-20 px-4">
              {/* Giant gold animated brain icon mark */}
              <div className="h-16 w-16 bg-brand-gold/5 rounded-3xl border border-brand-gold/20 flex items-center justify-center text-brand-gold mb-6 shadow-inner animate-pulse">
                <Brain className="h-8 w-8" />
              </div>
              
              <h2 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                {lang === 'en' ? `How can I assist you, ${userName}?` : `Yaya zan iya taimaka maka, ${userName}?`}
              </h2>
              <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
                {lang === 'en' 
                  ? `Your specialized role profile (${currentRole}) has been mounted to the Ruqayya Enterprise Copilot. Query real-time vehicle fleets, driver debt ledger balances, or transaction receipts.` 
                  : `Matsayin asusunka na (${currentRole}) yana aiki da Ruqayya AI. Zaka iya bincikar bayanan motoci, lissafin kudade, da kudaden direbobi.`
                }
              </p>

              {/* ROLE-SPECIFIC 2X2 DASHBOARD ACTION CARDS (CHATGPT STYLE STARTERS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-8 md:mt-12 text-left">
                {/* 1. Universal / Director Briefing */}
                <button
                  onClick={triggerDashboardBriefing}
                  className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                >
                  <Sparkles className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{lang === 'en' ? 'Personal Morning Briefing' : 'Rahoton safe na yau'}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{lang === 'en' ? 'Synthesize full operational state briefing' : 'Fassara bayanan aiki da kudaden yau'}</p>
                  </div>
                </button>

                {/* 2. Role Specific action cards */}
                {currentRole !== 'driver' && currentRole !== 'shareholder' && (
                  <>
                    <button
                      onClick={() => triggerReportSummary('Executive Summary')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <FileText className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Executive Report</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Audit complete double-entry general ledger</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerAnalyticsForecast('Fuel Voucher Utilization Trends')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <TrendingUp className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Fuel Analytics & Forecast</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Predict fuel pricing inflation and voucher trends</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSmartSearch('Outstanding driver debts and warnings')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <Search className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Audit Driver Debts</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">List all driver records behind on installment cycles</p>
                      </div>
                    </button>
                  </>
                )}

                {currentRole === 'driver' && (
                  <>
                    <button
                      onClick={() => triggerReportSummary('Personal Remittance')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <Calculator className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">My Outstanding Debt</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Audit vehicle balance installments remaining</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSystemHelp('Request Fuel Voucher')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <BookOpen className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Fuel Voucher Guidelines</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Step-by-step active fuel request documentation</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSmartSearch('Active road warnings and restrictions')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <ShieldAlert className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Road Safety Rules</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Retrieve safety directives and active warnings</p>
                      </div>
                    </button>
                  </>
                )}

                {currentRole === 'shareholder' && (
                  <>
                    <button
                      onClick={() => triggerReportSummary('Dividend Distribution')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <TrendingUp className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Dividend Performance</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Analyze my investment capital returns statement</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSmartSearch('Financial Ledger')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <Search className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Inspect Double-Entry Books</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Audit complete ledger flow and deposits history</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSystemHelp('Corporate Policy')}
                      className="p-3.5 bg-slate-900 hover:bg-[#161924] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 group"
                    >
                      <BookOpen className="h-5 w-5 text-brand-gold group-hover:scale-110 transition-all" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Corporate Statutes</h4>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">Read governing corporate charter and withdrawal rules</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* MESSAGE CHAT THREAD VIEW */}
          {messages.map((msg, idx) => (
            <div 
              key={msg.id || `msg-${idx}`}
              className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* User / Bot avatars inside ChatGPT style layout */}
              <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-black border transition-colors ${
                msg.role === 'user' 
                  ? 'bg-slate-800 border-slate-700 text-slate-200' 
                  : 'bg-brand-gold/10 border-brand-gold/20 text-brand-gold'
              }`}>
                {msg.role === 'user' ? <User className="h-4 w-4 text-slate-300" /> : <Bot className="h-4 w-4" />}
              </div>

              {/* Message text bubble wrapper */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  {msg.role === 'user' ? (lang === 'en' ? 'You' : 'Kai') : 'Ruqayya AI'}
                </span>
                
                <div className={`p-4 rounded-2xl text-xs leading-relaxed border relative group ${
                  msg.role === 'user' 
                    ? 'bg-[#1b1c24] border-slate-800 text-slate-100 rounded-tr-none' 
                    : 'bg-transparent border-transparent text-slate-200 rounded-tl-none whitespace-pre-wrap'
                }`}>
                  
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}

                  {/* Copy button on hover */}
                  <button
                    type="button"
                    onClick={() => copyMessageText(msg.content, idx)}
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-md border border-slate-800 transition-all cursor-pointer"
                    title="Copy message content"
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

          {/* STREAMING CHUNK PREVIEW */}
          {streamingContent && (
            <div className="flex gap-4 max-w-3xl mx-auto justify-start">
              <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center bg-brand-gold/10 border border-brand-gold/20 text-brand-gold">
                <Bot className="h-4 w-4 animate-spin" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-slate-500">Ruqayya AI</span>
                <div className="p-4 rounded-2xl text-xs leading-relaxed bg-transparent text-slate-200 rounded-tl-none whitespace-pre-wrap">
                  <MarkdownRenderer content={streamingContent} />
                  <span className="inline-block w-1.5 h-3 bg-brand-gold ml-1 animate-ping" />
                </div>
              </div>
            </div>
          )}

          {/* TYPING SPINNER */}
          {isLoading && !streamingContent && (
            <div className="flex gap-4 max-w-3xl mx-auto justify-start">
              <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center bg-brand-gold/10 border border-brand-gold/20 text-brand-gold">
                <Bot className="h-4 w-4 animate-spin" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-slate-500">Ruqayya AI</span>
                <div className="p-3 bg-[#131520] border border-slate-850 rounded-2xl rounded-tl-none flex items-center gap-1.5 w-max">
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* DRAG-AND-DROP ACTIVE OVERLAY */}
        {isDragging && (
          <div className="absolute inset-0 bg-slate-950/80 border-2 border-dashed border-brand-gold/40 flex flex-col items-center justify-center gap-2 z-20">
            <Sparkles className="h-10 w-10 text-brand-gold animate-bounce" />
            <p className="text-xs font-bold text-slate-200">Drop your receipts or PDF roster reports to audit with Document AI</p>
            <p className="text-[10px] text-slate-500">Supported formats: PDF, Word, JPEG, PNG, Excel</p>
          </div>
        )}

        {/* ACTIVE FILE ATTACHMENTS TRAY */}
        {attachedFiles.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-800/60 bg-[#12141c]/80 flex flex-wrap gap-2 z-10">
            {attachedFiles.map((file, fIdx) => (
              <div key={fIdx} className="bg-[#1b1c24] border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-[10.5px]">
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

        {/* 3. INTERACTIVE CHATGPT-STYLE INPUT BAR */}
        <div className="p-4 border-t border-slate-800/60 bg-[#0e1017]/80 backdrop-blur-md z-10">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            <form onSubmit={handleSend} className="flex gap-2.5 items-end">
              <div className="flex-1 relative bg-[#171921] border border-slate-800 focus-within:border-brand-gold/40 focus-within:ring-1 focus-within:ring-brand-gold/20 rounded-[24px] p-2 transition-all flex items-center gap-2 shadow-inner">
                
                {/* Paperclip attachment button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-brand-gold rounded-full hover:bg-slate-800 transition-all cursor-pointer shrink-0"
                  title="Attach financial files or documents"
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

                {/* Text prompt input */}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={lang === 'en' ? "Ask Ruqayya AI anything..." : "Yi tambayar Ruqayya AI a nan..."}
                  disabled={isLoading || !activeSessionId}
                  className="flex-1 bg-transparent border-none py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50"
                />

                {/* Microphone visual voice icon resembling ChatGPT client input */}
                <button
                  type="button"
                  className="p-2 text-slate-500 hover:text-brand-gold rounded-full hover:bg-slate-800 transition-all cursor-pointer shrink-0 hidden sm:block"
                  title="Voice command (Visual mode)"
                >
                  <Mic className="h-4 w-4" />
                </button>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && attachedFiles.length === 0) || !activeSessionId}
                  className="p-2.5 bg-brand-gold hover:bg-yellow-500 text-slate-950 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:hover:scale-100 shrink-0 cursor-pointer shadow-md"
                >
                  <Send className="h-3.5 w-3.5 font-bold" />
                </button>
              </div>
            </form>
            
            {/* Footnote Disclaimer */}
            <div className="flex justify-between items-center px-1 text-[9px] text-slate-500">
              <span className="font-medium flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-brand-gold/60 shrink-0" />
                {lang === 'en' ? 'Ruqayya AI can make mistakes. Verify important operations.' : 'AI na iya yin kuskure. Tabbatar da rahotanni na kudi.'}
              </span>
              <span className="font-mono text-[8px] text-brand-gold/50 tracking-wider font-bold uppercase">
                Workers AI x Google Flash
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
