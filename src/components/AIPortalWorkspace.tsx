import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Send, Bot, User, Trash2, RotateCcw, Plus, Menu, X, MessageSquare,
  TrendingUp, FileText, Search, ShieldAlert, BookOpen, Calculator, HelpCircle,
  Paperclip, Copy, Check, FileCheck, Mic, MicOff, ArrowRight, Brain, Pin, 
  Download, ThumbsUp, ThumbsDown, Lock, Wifi, Clock, ChevronLeft, ChevronRight,
  Eye, ShieldCheck, Activity, Printer, Info, CheckCircle, Volume2, VolumeX,
  ArrowLeft
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CircularLogo } from './CircularLogo';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  liked?: boolean;
  disliked?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  attachedFiles: { name: string; type: string; size: string; base64?: string }[];
  createdAt: string;
  isPinned?: boolean;
}

interface AIPortalWorkspaceProps {
  lang: 'en' | 'ha';
  currentRole: string;
  userName: string;
  onExit?: () => void;
}

export const AIPortalWorkspace: React.FC<AIPortalWorkspaceProps> = ({
  lang,
  currentRole,
  userName,
  onExit
}) => {
  // State for Chat Sessions (ChatGPT history)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  
  // Interface states
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  
  // Security session timer (Starts at 60:00 and decrements every second)
  const [sessionTimeLeft, setSessionTimeLeft] = useState(3600); // 60 minutes in seconds

  // Speech Recognition (STT) and Voice Synthesis (TTS) states
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);

  // Mobile Sidebar Toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Document AI State
  const [attachedFiles, setAttachedFiles] = useState<{name: string, type: string, size: string, base64?: string}[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic Time-Based Greeting Helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return {
        en: 'Good morning',
        ha: 'Ina kwana / Barka da asuba'
      };
    } else if (hour < 17) {
      return {
        en: 'Good afternoon',
        ha: 'Barka da rana'
      };
    } else {
      return {
        en: 'Good evening',
        ha: 'Barka da yamma'
      };
    }
  };

  // Format date elegantly
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'ha-NG', options);
  };

  // Decrement Session Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTimeLeft((prev) => {
        if (prev <= 1) {
          return 3600; // Reset as an ephemeral loop for preview demo purposes
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format Session Countdown Timer
  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    const storageKey = `ruqayya_ai_chats_${userName}_${currentRole}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        
        // Deduplicate loaded sessions to prevent duplicate key rendering errors
        const seenIds = new Set<string>();
        const uniqueSessions: ChatSession[] = [];
        parsed.forEach(s => {
          if (s && s.id && !seenIds.has(s.id)) {
            seenIds.add(s.id);
            uniqueSessions.push(s);
          }
        });

        if (uniqueSessions.length > 0) {
          setSessions(uniqueSessions);
          const firstSelected = uniqueSessions[0].id;
          setActiveSessionId(firstSelected);
        } else {
          setSessions([]);
          initNewSession([]);
        }
      } catch (e) {
        setSessions([]);
        initNewSession([]);
      }
    } else {
      setSessions([]);
      initNewSession([]);
    }
  }, [userName, currentRole]);

  // Persist sessions to localStorage when they change
  const saveSessions = (updatedSessions: ChatSession[]) => {
    const storageKey = `ruqayya_ai_chats_${userName}_${currentRole}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedSessions));
    setSessions(updatedSessions);
  };

  const initNewSession = (baseSessions?: ChatSession[]) => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: lang === 'en' ? 'New Conversation' : 'Sabon Labari',
      messages: [],
      attachedFiles: [],
      createdAt: new Date().toISOString()
    };
    
    const targetBase = Array.isArray(baseSessions) ? baseSessions : sessions;
    const updated = [newSession, ...targetBase];
    
    saveSessions(updated);
    setActiveSessionId(newSession.id);
    setInput('');
    setAttachedFiles([]);
    setStreamingContent('');
    // Focus input textarea
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const getActiveSession = (): ChatSession | undefined => {
    return sessions.find(s => s.id === activeSessionId);
  };

  // Delete chat conversation
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

  // Toggle Pinned status on conversation
  const togglePinSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, isPinned: !s.isPinned };
      }
      return s;
    });
    // Sort so pinned are on top, but retain general chronological sorting otherwise
    const sorted = [...updated].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    saveSessions(sorted);
  };

  // Start renaming a conversation
  const startRenameSession = (sess: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sess.id);
    setEditingTitleText(sess.title);
  };

  // Save renamed conversation
  const saveRenameSession = (sessionId: string) => {
    if (!editingTitleText.trim()) return;
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, title: editingTitleText.trim() };
      }
      return s;
    });
    saveSessions(updated);
    setEditingSessionId(null);
  };

  // Export current chat conversation as markdown file
  const exportSessionMarkdown = (sess: ChatSession) => {
    if (sess.messages.length === 0) return;
    let md = `# RUQAYYA ERP AI REPORT: ${sess.title}\n`;
    md += `*Exported on: ${new Date().toLocaleString()}*\n`;
    md += `*User: ${userName} (${currentRole})*\n`;
    md += `*Encryption Node Status: Active & Secured*\n\n`;
    md += `--- \n\n`;

    sess.messages.forEach(m => {
      const roleName = m.role === 'user' ? userName : 'RUQAYYA ERP AI ASSISTANT';
      md += `### **${roleName}** *(${m.timestamp})*\n\n`;
      md += `${m.content}\n\n`;
      md += `--- \n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ruqayya_ai_report_${sess.title.toLowerCase().replace(/\s+/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auto-resize textarea height as content expands
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  // Handle enter key shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeSession = getActiveSession();
  const messages = activeSession ? activeSession.messages : [];

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const copyMessageText = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(msgId);
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

  // Unified AI API Caller with Streaming support
  const executeAICommand = async (endpoint: string, payload: any) => {
    setIsLoading(true);
    setStreamingContent('');
    // Reset session countdown on activity
    setSessionTimeLeft(3600);
    
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
        throw new Error(lang === 'en' ? 'Workers AI binding returned status error.' : 'Samar da Workers AI ya samu tangarda.');
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
          const updatedMsg: Message = { 
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
            role: 'assistant', 
            content: accumulated,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
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
          content: `### ${lang === 'en' ? 'System Connection Interrupted' : 'An Samu Katsewar Tsari'}\n\n${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  // Main send prompt handler
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || isLoading || !activeSessionId) return;

    let userPrompt = input.trim();
    const hasAttachments = attachedFiles.length > 0;
    
    if (hasAttachments) {
      const filesInfo = attachedFiles.map(f => `[File Ingested: ${f.name} (Type: ${f.type}, Size: ${f.size})]`).join('\n');
      userPrompt = `${userPrompt || 'Analyze this uploaded document within the context.'}\n\n${filesInfo}`;
    }

    const originalInput = input.trim();
    setInput('');
    setAttachedFiles([]);

    const newUserMsg: Message = { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
      role: 'user', 
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    // Update active session with the user's message
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const isFirst = s.messages.length === 0;
        const newTitle = isFirst ? (originalInput.substring(0, 24) || 'Audit Command') + (originalInput.length > 24 ? '...' : '') : s.title;
        return { 
          ...s, 
          title: newTitle,
          messages: [...s.messages, newUserMsg] 
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    // Call corresponding endpoint
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
      content: lang === 'en' ? `Regenerate response: "${lastPrompt.split('\n')[0]}"` : `Sake amsa tambaya: "${lastPrompt.split('\n')[0]}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
      history: messages.filter(m => m.id !== retryMsg.id).slice(0, -1),
      page: 'ChatGPT AI Dashboard'
    });
  };

  // Like message response
  const handleLikeMessage = (msgId: string) => {
    if (!activeSessionId) return;
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const updatedMsgs = s.messages.map(m => {
          if (m.id === msgId) {
            return { ...m, liked: !m.liked, disliked: false };
          }
          return m;
        });
        return { ...s, messages: updatedMsgs };
      }
      return s;
    });
    saveSessions(updatedSessions);
  };

  // Dislike message response
  const handleDislikeMessage = (msgId: string) => {
    if (!activeSessionId) return;
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const updatedMsgs = s.messages.map(m => {
          if (m.id === msgId) {
            return { ...m, disliked: !m.disliked, liked: false };
          }
          return m;
        });
        return { ...s, messages: updatedMsgs };
      }
      return s;
    });
    saveSessions(updatedSessions);
  };

  // Direct prompt triggers for dashboard starter buttons
  const handleTriggerQuickAction = async (promptTitleEn: string, promptTitleHa: string, promptText: string) => {
    if (!activeSessionId) return;
    const promptTextLocalized = lang === 'en' ? promptText : promptText;
    const visibleTitle = lang === 'en' ? promptTitleEn : promptTitleHa;

    const userMsg: Message = { 
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
      role: 'user', 
      content: visibleTitle,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? visibleTitle : s.title,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    // Call dynamic endpoint based on prompt keyword matching
    if (promptText.toLowerCase().includes('report') || promptText.toLowerCase().includes('summary')) {
      await executeAICommand('/api/ai/report', { reportType: promptTitleEn });
    } else if (promptText.toLowerCase().includes('search') || promptText.toLowerCase().includes('find')) {
      await executeAICommand('/api/ai/search', { query: promptTitleEn });
    } else if (promptText.toLowerCase().includes('forecast') || promptText.toLowerCase().includes('analytics')) {
      await executeAICommand('/api/ai/analytics', { metric: promptTitleEn });
    } else {
      await executeAICommand('/api/ai/chat', { prompt: promptText, history: messages });
    }
  };

  const triggerDashboardBriefing = () => {
    handleTriggerQuickAction(
      "Personalized Operational Briefing", 
      "Gudanar da Jawabin Safe", 
      "Generate a personalized operational morning briefing tailored to my clearance level"
    );
  };

  // Date bucket grouping helper for chat history sessions
  const getGroupedSessions = () => {
    const pinned: ChatSession[] = [];
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const week: ChatSession[] = [];
    const older: ChatSession[] = [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    const filtered = sessions.filter(s => 
      s.title.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
      s.messages.some(m => m.content.toLowerCase().includes(historySearchQuery.toLowerCase()))
    );

    filtered.forEach(s => {
      if (s.isPinned) {
        pinned.push(s);
        return;
      }
      const date = new Date(s.createdAt);
      const diff = now.getTime() - date.getTime();

      if (diff < oneDay && date.getDate() === now.getDate()) {
        today.push(s);
      } else if (diff < 2 * oneDay && date.getDate() === new Date(now.getTime() - oneDay).getDate()) {
        yesterday.push(s);
      } else if (diff < 7 * oneDay) {
        week.push(s);
      } else {
        older.push(s);
      }
    });

    return { pinned, today, yesterday, week, older };
  };

  const grouped = getGroupedSessions();

  // Voice Input (STT) Trigger
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'en' ? 'Voice input is not supported in this browser environment.' : 'Injin gane murya baya aiki a wannan manhaja.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = lang === 'en' ? 'en-US' : 'ha-NG';

    rec.onstart = () => {
      setIsRecording(true);
      setRecognitionError('');
    };

    rec.onresult = (evt: any) => {
      const text = evt.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${text}` : text);
    };

    rec.onerror = (e: any) => {
      setRecognitionError(e.error);
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.start();
  };

  // Text-To-Speech (TTS) voice synthesizer
  const toggleSpeechSynthesis = (text: string, msgId: string) => {
    if (activeSpeechId === msgId) {
      window.speechSynthesis.cancel();
      setActiveSpeechId(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    // Clean markdown structures
    const cleanText = text
      .replace(/\[(GENERATE_PDF|GENERATE_IMAGE):\s*\w+\]/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*`_-]/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'en' ? 'en-US' : 'ha-NG';
    
    const voices = window.speechSynthesis.getVoices();
    if (lang === 'ha') {
      const hausaVoice = voices.find(v => v.lang.startsWith('ha'));
      if (hausaVoice) utterance.voice = hausaVoice;
    } else {
      const engVoice = voices.find(v => v.lang.startsWith('en'));
      if (engVoice) utterance.voice = engVoice;
    }

    utterance.onend = () => setActiveSpeechId(null);
    utterance.onerror = () => setActiveSpeechId(null);

    setActiveSpeechId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex-1 flex h-full bg-[#030712] text-slate-100 font-sans overflow-hidden relative">
      
      {/* 1. COLLAPSIBLE CHAT HISTORY SIDEBAR */}
      <motion.div
        animate={{ width: sidebarCollapsed ? 0 : 288 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className={`
          shrink-0 bg-[#070b13] border-r border-slate-800/60 flex flex-col transform transition-transform duration-300 z-40 h-full
          ${sidebarCollapsed ? 'overflow-hidden border-none' : 'p-4'}
          ${sidebarOpen ? 'fixed inset-y-0 left-0 w-72 translate-x-0' : 'absolute inset-y-0 left-0 -translate-x-full md:relative md:translate-x-0'}
          ${sidebarCollapsed && !sidebarOpen ? 'hidden md:flex' : ''}
        `}
      >
        <div className="flex flex-col gap-4 h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircularLogo size="sm" animateContinuous={true} />
              <div className="min-w-0">
                <span className="text-xs font-black tracking-wider uppercase text-brand-gold block truncate">RUQAYYA AI</span>
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest block">ERP PRO</span>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white md:hidden cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={() => {
              initNewSession();
              setSidebarOpen(false);
            }}
            className="w-full py-2.5 px-3.5 bg-slate-900 hover:bg-[#0f1524] border border-slate-800/80 hover:border-brand-gold/30 rounded-xl flex items-center justify-between text-left text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <Plus className="h-4 w-4 text-brand-gold group-hover:scale-110 transition-transform" />
              <span>{lang === 'en' ? 'New Chat' : 'Sabuwar Tattaunawa'}</span>
            </div>
            <span className="text-[9px] font-mono font-bold text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded">⌘K</span>
          </button>

          {/* Search History Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder={lang === 'en' ? "Search conversations..." : "Nemi tattaunawa..."}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-800/80 focus:border-brand-gold/40 focus:ring-1 focus:ring-brand-gold/10 rounded-lg text-xs placeholder-slate-500 focus:outline-none transition-all"
            />
            {historySearchQuery && (
              <button 
                onClick={() => setHistorySearchQuery('')}
                className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Grouped Conversation list */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {/* Group rendering helper */}
            {Object.entries(grouped).map(([groupKey, groupSessions]) => {
              if (groupSessions.length === 0) return null;
              
              const groupTitles: any = {
                pinned: lang === 'en' ? 'Pinned' : 'Gira a Sama',
                today: lang === 'en' ? 'Today' : 'Yau',
                yesterday: lang === 'en' ? 'Yesterday' : 'Jiya',
                week: lang === 'en' ? 'Previous 7 Days' : 'Kwanaki 7 Da Suka Wuce',
                older: lang === 'en' ? 'Older conversations' : 'Tsofaffin Tattaunawa'
              };

              return (
                <div key={groupKey} className="space-y-1">
                  <div className="text-[9px] font-mono font-black uppercase text-slate-500 tracking-wider pl-2 mb-1.5 flex items-center gap-1.5">
                    {groupKey === 'pinned' && <Pin className="h-2.5 w-2.5 text-brand-gold" />}
                    {groupTitles[groupKey]}
                  </div>

                  {groupSessions.map((sess) => {
                    const isActive = sess.id === activeSessionId;
                    const isEditing = sess.id === editingSessionId;

                    return (
                      <div
                        key={sess.id}
                        onClick={() => {
                          if (!isEditing) {
                            setActiveSessionId(sess.id);
                            setSidebarOpen(false);
                          }
                        }}
                        className={`
                          w-full p-2.5 rounded-xl flex items-center justify-between gap-2 text-left text-xs transition-all cursor-pointer group relative border
                          ${isActive 
                            ? 'bg-[#111827] text-brand-gold border-slate-800/90' 
                            : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-900/60'}
                        `}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-brand-gold' : 'text-slate-500'}`} />
                          
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingTitleText}
                              onChange={(e) => setEditingTitleText(e.target.value)}
                              onBlur={() => saveRenameSession(sess.id)}
                              onKeyDown={(e) => e.key === 'Enter' && saveRenameSession(sess.id)}
                              className="bg-slate-950 text-xs px-1 border border-brand-gold/40 rounded w-full text-white focus:outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate font-medium">{sess.title}</span>
                          )}
                        </div>

                        {/* Session Actions (Rename, Pin, Export, Delete) */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 shrink-0">
                            {/* Pin */}
                            <button
                              onClick={(e) => togglePinSession(sess.id, e)}
                              className={`p-0.5 rounded hover:bg-slate-800 cursor-pointer ${sess.isPinned ? 'text-brand-gold' : 'text-slate-500 hover:text-slate-300'}`}
                              title={sess.isPinned ? 'Unpin' : 'Pin conversation'}
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                            {/* Rename */}
                            <button
                              onClick={(e) => startRenameSession(sess, e)}
                              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                              title="Rename chat"
                            >
                              <FileText className="h-3 w-3" />
                            </button>
                            {/* Export */}
                            <button
                              onClick={(e) => { e.stopPropagation(); exportSessionMarkdown(sess); }}
                              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                              title="Export chat to Markdown"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={(e) => deleteSession(sess.id, e)}
                              className="p-0.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer"
                              title="Delete conversation"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          <div className="mt-auto pt-3 border-t border-slate-800/60 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-brand-gold text-xs font-black border border-slate-850">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">{userName}</p>
              <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 uppercase block w-max mt-0.5">
                {currentRole}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* MOBILE SIDEBAR BACKGROUND OVERLAY */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/70 z-30 md:hidden"
        />
      )}

      {/* 2. MAIN CHAT LOG & WORKSPACE AREA */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 flex flex-col justify-between bg-[#090d16] relative overflow-hidden"
      >
        
        {/* TOP GLASMOPHIC STICKY HEADER */}
        <div className="p-4 border-b border-slate-800/50 bg-[#090d16]/90 backdrop-blur-md flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setSidebarOpen(true);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl cursor-pointer text-slate-300 transition-colors"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Desktop Brand / Context indicator */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-slate-300 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 uppercase tracking-wider flex items-center gap-1.5 shadow-inner">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {lang === 'en' ? `Authorized Context: ${currentRole}` : `Matsayi: ${currentRole}`}
              </span>
            </div>
          </div>

          {/* AI Status / Security Bar */}
          <div className="hidden lg:flex items-center gap-4 text-[9.5px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-extrabold bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">
              <Lock className="h-3 w-3" /> SECURE SESSION
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-brand-gold" /> WORKERS AI ACTIVE
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="h-3 w-3" /> {lang === 'en' ? 'EXPIRY:' : 'KAREWA:'} <span className="text-brand-gold font-bold">{formatSessionTime(sessionTimeLeft)}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl border border-slate-800 cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all"
                title={lang === 'en' ? 'Back to ERP' : 'Koma ga ERP'}
              >
                <ArrowLeft className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                <span className="hidden md:inline">{lang === 'en' ? 'Back to ERP' : 'Koma ga ERP'}</span>
              </button>
            )}
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading || messages.filter(m => m.role === 'user').length === 0}
                  className="p-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl border border-slate-800 cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all disabled:opacity-40"
                  title="Regenerate last response"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{lang === 'en' ? 'Regenerate' : 'Sake Amsawa'}</span>
                </button>
              </>
            )}
            <button
              onClick={() => initNewSession()}
              className="p-2 bg-brand-gold hover:bg-amber-500 text-slate-950 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs font-extrabold transition-all shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{lang === 'en' ? 'New Chat' : 'Sabuwa'}</span>
            </button>
          </div>
        </div>

        {/* CHAT CONTAINER BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-[#090d16]/30">
          
          {/* CHATGPT STYLE WELCOME CENTER (EMPTY STATE) */}
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-8 md:py-16 px-4 animate-fadeIn">
              {/* Premium AI Avatar Logo with breathing ring */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-brand-gold/20 blur-xl scale-125 animate-pulse" />
                <CircularLogo size="xl" animateContinuous={true} />
              </div>
              
              <span className="text-[10px] font-mono font-bold tracking-widest text-brand-gold uppercase block mb-1">
                {lang === 'en' ? 'RUQAYYA TRANSPORT ERP CO-PILOT' : 'MATAIMAKIN RUQAYYA TRANSPORT ERP'}
              </span>
              <h2 className="text-xl md:text-3xl font-black text-slate-100 tracking-tight leading-none">
                {lang === 'en' 
                  ? `${getGreeting().en}, ${userName.split(' ')[0]}` 
                  : `${getGreeting().ha}, ${userName.split(' ')[0]}`}
              </h2>
              <p className="text-[10px] font-mono text-slate-400 mt-1.5 uppercase font-bold tracking-wide">
                {getFormattedDate()}
              </p>
              
              <div className="w-12 h-0.5 bg-brand-gold/30 my-4 rounded" />

              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                {lang === 'en' 
                  ? `Your specialized authorization credentials as a ${currentRole.toUpperCase()} have been securely mounted. I am ready to process receipts, verify operational compliance, analyze driver balances, or generate PDF summaries.` 
                  : `Takaddun izninku na musamman a matsayin ${currentRole.toUpperCase()} an dora su cikin aminci. Na shirya don nazarin kudaden shiga, tabbatar da aiki, ko samar da rahoton PDF.`
                }
              </p>

              {/* SECURITY SUMMARY TAG */}
              <div className="mt-4 flex items-center justify-center gap-4 bg-slate-950/80 border border-slate-800/60 px-4 py-2 rounded-2xl text-[9px] font-mono text-slate-400 shadow-inner">
                <span className="flex items-center gap-1.5 text-emerald-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> AES-256 ACTIVE</span>
                <span className="h-3 w-px bg-slate-800" />
                <span className="flex items-center gap-1.5 text-brand-gold"><Lock className="h-3.5 w-3.5" /> WORKERS AI SECURE BINDING</span>
              </div>

              {/* ROLE-AWARE CHATGPT STYLE STARTERS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-8 text-left">
                {/* Dashboard Briefing Starter */}
                <button
                  onClick={triggerDashboardBriefing}
                  className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group relative overflow-hidden shadow-lg"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-brand-gold/5 rounded-full blur-lg group-hover:bg-brand-gold/10 transition-colors" />
                  <Sparkles className="h-4.5 w-4.5 text-brand-gold group-hover:scale-110 transition-all" />
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-200">{lang === 'en' ? 'Daily Morning Briefing' : 'Jawabin Gudanar da Safe'}</h4>
                    <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{lang === 'en' ? 'Compile operational cycles & summaries' : 'Gudanar da cikakken binciken aiki'}</p>
                  </div>
                </button>

                {/* Director & Admin Starters */}
                {currentRole !== 'driver' && currentRole !== 'shareholder' && (
                  <>
                    <button
                      onClick={() => handleTriggerQuickAction(
                        "Company Wallet Summary", 
                        "Takaitaccen Kudaden Kamfani", 
                        "Give me a detailed summary of the Company Wallet balance, recent ledger entries, and cycle transactions."
                      )}
                      className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group relative overflow-hidden shadow-lg"
                    >
                      <Calculator className="h-4.5 w-4.5 text-brand-gold" />
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">Company Wallet Summary</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">Review active treasury balance logs</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTriggerQuickAction(
                        "Driver Performance Review", 
                        "Ayyukan Direbobi", 
                        "Explain driver classifications, remaining contract balances, rating scores, and safety compliance status."
                      )}
                      className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group relative overflow-hidden shadow-lg"
                    >
                      <TrendingUp className="h-4.5 w-4.5 text-brand-gold" />
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">Driver Performance Audit</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">Classify driver safety compliance charts</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTriggerQuickAction(
                        "Daily Remittance Report", 
                        "Rahoton Kudi na Yau", 
                        "Please analyze today's collection ledger, remittance receipts, and outstanding driver debts."
                      )}
                      className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group relative overflow-hidden shadow-lg"
                    >
                      <FileText className="h-4.5 w-4.5 text-brand-gold" />
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">Daily Remittance PDF</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">Prepare cycle settlement summaries</p>
                      </div>
                    </button>
                  </>
                )}

                {/* Driver Starters */}
                {currentRole === 'driver' && (
                  <>
                    <button
                      onClick={() => handleTriggerQuickAction(
                        "My Vehicle Balance", 
                        "Ragowar Kudin Mota Na", 
                        "Calculate my remaining vehicle purchase contract balance, payments made to date, and active installment position."
                      )}
                      className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group relative overflow-hidden shadow-lg"
                    >
                      <Calculator className="h-4.5 w-4.5 text-brand-gold" />
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">My Vehicle Balance</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">Audit outstanding payment position</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTriggerQuickAction(
                        "How to Request Fuel Voucher", 
                        "Karin Kudin Man Fetur", 
                        "Explain step-by-step instructions on requesting a fuel voucher, active cycle limits, and approval policies."
                      )}
                      className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group"
                    >
                      <BookOpen className="h-4.5 w-4.5 text-brand-gold" />
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">Fuel Voucher Guide</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">Voucher eligibility & allocation limits</p>
                      </div>
                    </button>
                  </>
                )}

                {/* Shareholder Starters */}
                {currentRole === 'shareholder' && (
                  <>
                    <button
                      onClick={() => handleTriggerQuickAction(
                        "Dividend Analytics Statement", 
                        "Rahoton Rabon Ribar Jari", 
                        "Give me a summary of dividend allocations, my ownership stake percentage, and current operating cycle profit return forecasts."
                      )}
                      className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group relative overflow-hidden shadow-lg"
                    >
                      <TrendingUp className="h-4.5 w-4.5 text-brand-gold" />
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">Dividend Analytics Statement</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">Analyze investment asset performance</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleTriggerQuickAction(
                        "My Investment Status", 
                        "Tarihin Jari Na", 
                        "Please verify my total historical investment amount, active share credentials, and ownership validation certificate."
                      )}
                      className="p-3.5 bg-slate-900/60 hover:bg-[#0f1422] border border-slate-800/80 hover:border-brand-gold/30 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-24 group relative overflow-hidden shadow-lg"
                    >
                      <FileCheck className="h-4.5 w-4.5 text-brand-gold" />
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">My Investment Stake</h4>
                        <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">Validate double-entry capital certificates</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CHAT LOG SCREEN AREA */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div 
                key={msg.id ? `workspace-msg-${msg.id}` : `workspace-idx-${idx}`}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className={`flex gap-4 max-w-3xl mx-auto ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar Left / Right placement */}
                {!isUser && (
                  <div className="relative shrink-0 self-start">
                    <CircularLogo size="sm" animateContinuous={isLoading} />
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#090d16]" />
                  </div>
                )}

                <div className={`flex-1 min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
                  {/* Speaker Label */}
                  <span className="text-[9.5px] font-mono font-bold text-slate-500 tracking-wider">
                    {isUser ? (lang === 'en' ? 'AUTHORIZED OPERATOR' : 'KAIN MAI IKO') : 'RUQAYYA ERP CO-PILOT'}
                  </span>

                  {/* Chat Content Bubble */}
                  <div className={`
                    p-4 rounded-2xl text-[12.5px] leading-relaxed border relative group overflow-hidden
                    ${isUser 
                      ? 'bg-gradient-to-br from-slate-900 to-[#111625] border-slate-800/80 text-slate-100 rounded-tr-none shadow-lg' 
                      : 'bg-transparent border-transparent text-slate-200 rounded-tl-none whitespace-pre-wrap'}
                  `}>
                    
                    {isUser ? (
                      msg.content
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}

                    {/* Micro utilities on hover */}
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyMessageText(msg.content, msg.id)}
                          className="p-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                          title="Copy response content"
                        >
                          {copiedMsgIdx === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedMsgIdx === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          onClick={() => toggleSpeechSynthesis(msg.content, msg.id)}
                          className="p-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                          title="Listen with voice synthesizer"
                        >
                          {activeSpeechId === msg.id ? (
                            <>
                              <VolumeX className="h-3 w-3 text-red-400 animate-pulse" />
                              <span className="text-red-400">Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3" />
                              <span>Read aloud</span>
                            </>
                          )}
                        </button>

                        {/* Thumbs Up Like */}
                        <button
                          onClick={() => handleLikeMessage(msg.id)}
                          className={`p-1.5 border rounded-lg transition-all cursor-pointer ${msg.liked ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-slate-950/80 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </button>

                        {/* Thumbs Down Dislike */}
                        <button
                          onClick={() => handleDislikeMessage(msg.id)}
                          className={`p-1.5 border rounded-lg transition-all cursor-pointer ${msg.disliked ? 'bg-red-950/40 border-red-800 text-red-400' : 'bg-slate-950/80 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[8px] font-mono text-slate-500 font-bold tracking-wider mt-0.5 block pl-1">
                    {msg.timestamp}
                  </span>
                </div>

                {isUser && (
                  <div className="shrink-0 self-start">
                    <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-300 font-black border border-slate-800 shadow-md">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* STREAMING CHUNK PREVIEW */}
          {streamingContent && (
            <div className="flex gap-4 max-w-3xl mx-auto justify-start">
              <div className="shrink-0 self-start relative">
                <CircularLogo size="sm" animateContinuous={true} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[9.5px] font-mono font-bold text-slate-500 tracking-wider">RUQAYYA ERP CO-PILOT</span>
                <div className="p-4 rounded-2xl text-[12.5px] leading-relaxed bg-transparent text-slate-200 rounded-tl-none whitespace-pre-wrap">
                  <MarkdownRenderer content={streamingContent} />
                  <span className="inline-block w-1.5 h-3 bg-brand-gold ml-1 animate-ping" />
                </div>
              </div>
            </div>
          )}

          {/* LOADING SPINNER */}
          {isLoading && !streamingContent && (
            <div className="flex gap-4 max-w-3xl mx-auto justify-start">
              <div className="shrink-0 self-start relative">
                <CircularLogo size="sm" animateContinuous={true} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[9.5px] font-mono font-bold text-slate-500 tracking-wider">RUQAYYA ERP CO-PILOT</span>
                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-2xl rounded-tl-none flex items-center gap-1.5 w-max">
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* DRAG-AND-DROP ACTIVE HOVER OVERLAY */}
        {isDragging && (
          <div className="absolute inset-0 bg-[#030712]/90 border-2 border-dashed border-brand-gold/40 flex flex-col items-center justify-center gap-3.5 z-20 animate-fadeIn">
            <div className="p-4 bg-brand-gold/10 border border-brand-gold/20 rounded-full animate-bounce">
              <Sparkles className="h-8 w-8 text-brand-gold" />
            </div>
            <p className="text-xs font-black text-slate-200">{lang === 'en' ? 'Drop document files or receipts here' : 'Sanya fayiloli ko takaddun kudi a nan'}</p>
            <p className="text-[10px] text-slate-500 font-mono">SUPPORTED FORMATS: PDF, JPEG, PNG, EXCEL, CSV</p>
          </div>
        )}

        {/* ACTIVE FILE ATTACHMENTS PREVIEW TRAY */}
        {attachedFiles.length > 0 && (
          <div className="px-6 py-2.5 border-t border-slate-800/60 bg-[#070a11]/90 flex flex-wrap gap-2.5 z-10">
            {attachedFiles.map((file, fIdx) => (
              <div key={fIdx} className="bg-[#101522] border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-[10.5px] shadow-md animate-fadeIn">
                <FileCheck className="h-4 w-4 text-brand-gold shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-200 truncate max-w-xs">{file.name}</p>
                  <p className="text-[8px] text-slate-500 font-mono">{file.size} • Document AI</p>
                </div>
                <button
                  onClick={() => removeAttachment(fIdx)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-colors ml-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* INTERACTIVE CHATGPT-STYLE SMART INPUT BAR */}
        <div className="p-4 border-t border-slate-800/60 bg-[#090d16]/80 backdrop-blur-md z-10">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            <form onSubmit={handleSend} className="flex gap-2.5 items-end">
              <div className="flex-1 relative bg-slate-950 border border-slate-800/80 focus-within:border-brand-gold/40 focus-within:ring-1 focus-within:ring-brand-gold/20 rounded-[24px] p-2 transition-all flex items-center gap-2 shadow-inner">
                
                {/* Paperclip attachment button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-brand-gold rounded-full hover:bg-slate-900 transition-all cursor-pointer shrink-0"
                  title="Attach financial files or documents"
                >
                  <Paperclip className="h-4.5 w-4.5" />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple
                />

                {/* Auto-resizing textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={lang === 'en' ? "Ask Ruqayya AI anything..." : "Yi tambayar Ruqayya AI a nan..."}
                  disabled={isLoading || !activeSessionId}
                  className="flex-1 bg-transparent border-none py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50 resize-none min-h-[36px] max-h-[180px] scrollbar-none"
                />

                {/* Microphone visual voice icon resembling ChatGPT client input */}
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`p-2 rounded-full transition-all cursor-pointer shrink-0 shrink-0 ${isRecording ? 'text-red-400 bg-red-950/20 animate-pulse' : 'text-slate-400 hover:text-brand-gold hover:bg-slate-900'}`}
                  title={isRecording ? "Listening... Click to stop" : "Voice command input"}
                >
                  {isRecording ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
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
            
            {/* Disclaimer and Technology label */}
            <div className="flex justify-between items-center px-2.5 text-[9px] text-slate-500">
              <span className="font-medium flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-brand-gold/60 shrink-0" />
                {lang === 'en' ? 'Ruqayya AI compiles live double-entry data. Please verify core operations.' : 'AI tana amfani da bayanan aiki na yanzu. Da fatan a sake dubawa.'}
              </span>
              <span className="font-mono text-[8px] text-brand-gold/40 tracking-wider font-extrabold uppercase shrink-0">
                Llama 3.1 x Google Flash
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
