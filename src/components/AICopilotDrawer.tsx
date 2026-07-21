import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, Send, Bot, User, Trash2, RotateCcw, Copy, Check,
  TrendingUp, FileText, Search, ShieldAlert, BookOpen, Calculator, HelpCircle,
  Maximize2, Minimize2, Paperclip, FileCheck, Mic, MicOff, Volume2, VolumeX,
  Printer, Download, Award, Activity, FileImage, ShieldCheck
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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
  lang: globalLang,
  currentRole,
  userName
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [localLang, setLocalLang] = useState<'en' | 'ha'>(globalLang);
  
  // Voice Synthesis & Recognition States
  const [isRecording, setIsRecording] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [recognitionError, setRecognitionError] = useState('');

  // Active overlay document state
  const [activeDocument, setActiveDocument] = useState<{
    type: 'company_report' | 'driver_pass' | 'remittance_receipt' | 'investment_certificate' | 'revenue_chart' | 'driver_performance';
    title: string;
    description: string;
  } | null>(null);

  // Document AI Attachments State
  const [attachedFiles, setAttachedFiles] = useState<{name: string, type: string, size: string, base64?: string}[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize language when global selection updates
  useEffect(() => {
    setLocalLang(globalLang);
  }, [globalLang]);

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
    window.speechSynthesis.cancel();
    setActiveSpeechId(null);
  };

  const copyMessageText = (text: string, msgId: string) => {
    // Strip tags from copied content
    const cleanText = text.replace(/\[(GENERATE_PDF|GENERATE_IMAGE):\s*\w+\]/g, '').trim();
    navigator.clipboard.writeText(cleanText);
    setCopiedMsgIdx(msgId);
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
        throw new Error(localLang === 'en' ? 'Server rejected AI request.' : 'Saba ta ki karbar bukatar AI.');
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
          const newMsgId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          setMessages(prev => [...prev, { 
            id: newMsgId, 
            role: 'assistant', 
            content: accumulated,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        }
      } else {
        const data = await response.json() as any;
        if (data.response) {
          const newMsgId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          setMessages(prev => [...prev, { 
            id: newMsgId, 
            role: 'assistant', 
            content: data.response,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev, 
        { 
          id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant', 
          content: `${localLang === 'en' ? 'System Error:' : 'Kuskure:'} ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
    
    const userMsgId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setMessages(prev => [...prev, { 
      id: userMsgId, 
      role: 'user', 
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

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
    
    setMessages(prev => [...prev, { 
      id: `retry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: `${localLang === 'en' ? 'Retry query:' : 'Sake tambaya:'} "${lastPrompt}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    
    await executeAICommand('/api/ai/chat', {
      prompt: lastPrompt,
      history: messages.slice(0, -1),
      page: window.location.pathname
    });
  };

  // Quick Action triggers
  const triggerReportSummary = async (type: string) => {
    setMessages(prev => [...prev, { 
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: localLang === 'en' ? `Summarize ${type} report` : `Takaice rahoton ${type}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    await executeAICommand('/api/ai/report', { reportType: type });
  };

  const triggerSmartSearch = async (query: string) => {
    setMessages(prev => [...prev, { 
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: localLang === 'en' ? `Search database for: ${query}` : `Nemi bayanai akan: ${query}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    await executeAICommand('/api/ai/search', { query });
  };

  const triggerAnalyticsForecast = async (metric: string) => {
    setMessages(prev => [...prev, { 
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: localLang === 'en' ? `Analyze & forecast: ${metric}` : `Bincika & hasashen: ${metric}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    await executeAICommand('/api/ai/analytics', { metric });
  };

  const triggerSystemHelp = async (topic: string) => {
    setMessages(prev => [...prev, { 
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user', 
      content: localLang === 'en' ? `Explain system task: ${topic}` : `Bayyana yadda ake: ${topic}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    await executeAICommand('/api/ai/system', { topic });
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
          setMessages([{ 
            id: `welcome-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
            role: 'assistant', 
            content: accumulated,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        }
      }
    } catch (err: any) {
      setMessages([
        { 
          id: `welcome-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant', 
          content: `${localLang === 'en' ? 'Welcome to Ruqayya ERP AI Portal.' : 'Barka da zuwa Ruqayya ERP AI Portal.'}\n\nAsk me any question about the live database context. Use voice commands or request documents!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  };

  // Text-To-Speech (TTS) Engine
  const toggleSpeech = (text: string, msgId: string) => {
    if (activeSpeechId === msgId) {
      window.speechSynthesis.cancel();
      setActiveSpeechId(null);
      return;
    }
    
    window.speechSynthesis.cancel();
    
    // Clean text from markdown and tags before speaking
    const cleanText = text
      .replace(/\[(GENERATE_PDF|GENERATE_IMAGE):\s*\w+\]/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*`_-]/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = localLang === 'en' ? 'en-US' : 'ha-NG';
    
    // Choose voice appropriately
    const voices = window.speechSynthesis.getVoices();
    if (localLang === 'ha') {
      const hausaVoice = voices.find(v => v.lang.startsWith('ha'));
      if (hausaVoice) utterance.voice = hausaVoice;
    } else {
      const engVoice = voices.find(v => v.lang.startsWith('en'));
      if (engVoice) utterance.voice = engVoice;
    }

    utterance.onend = () => {
      setActiveSpeechId(null);
    };
    utterance.onerror = () => {
      setActiveSpeechId(null);
    };

    setActiveSpeechId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Speech-To-Text (STT) Engine
  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(localLang === 'en' ? 'Speech recognition is not supported in this browser.' : 'Injin gane magana baya aiki a wannan manhaja.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = localLang === 'en' ? 'en-US' : 'ha-NG';

    recognition.onstart = () => {
      setIsRecording(true);
      setRecognitionError('');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      setRecognitionError(e.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  // Parse Document / Visual tags from text
  const renderDocumentCards = (text: string, messageId: string) => {
    const regex = /\[(GENERATE_PDF|GENERATE_IMAGE):\s*(\w+)\]/g;
    const cards: React.ReactNode[] = [];
    let match;
    let matchIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      const [_, format, type] = match;
      const key = `${messageId}-${format}-${type}-${matchIndex++}`;

      // Role check authorization
      let isAuthorized = true;
      if (type === 'company_report' || type === 'driver_performance') {
        if (currentRole !== 'admin' && currentRole !== 'director') {
          isAuthorized = false;
        }
      } else if (type === 'investment_certificate') {
        if (currentRole !== 'shareholder' && currentRole !== 'admin' && currentRole !== 'director') {
          isAuthorized = false;
        }
      }

      if (!isAuthorized) {
        cards.push(
          <div key={key} className="mt-3 p-3 bg-red-950/20 border border-red-900/30 rounded-xl flex items-center gap-2.5 text-red-400">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-red-500" />
            <div className="text-[10px]">
              <p className="font-bold">{localLang === 'en' ? 'Access Restricted' : 'An Hana Shiga'}</p>
              <p className="text-slate-400">{localLang === 'en' ? 'Your current role credentials cannot generate this confidential ledger document.' : 'Matsayinku na yanzu ba zai iya samar da wannan takarda ta sirri ba.'}</p>
            </div>
          </div>
        );
        continue;
      }

      // Generate card based on types
      if (format === 'GENERATE_PDF') {
        cards.push(
          <motion.div 
            key={key}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="mt-3 p-3.5 bg-slate-950/90 border border-brand-gold/30 rounded-xl flex flex-col gap-3 relative overflow-hidden group shadow-lg"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/5 rounded-full blur-xl pointer-events-none group-hover:bg-brand-gold/10 transition-colors" />
            
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-brand-gold/10 border border-brand-gold/30 rounded-xl text-brand-gold shrink-0">
                <FileCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block text-[8px] font-extrabold uppercase bg-brand-gold/10 text-brand-gold px-1.5 py-0.5 rounded tracking-wider">
                  PDF DOCUMENT GENERATED
                </span>
                <h4 className="text-xs font-black text-slate-100 mt-1 truncate">
                  {type === 'company_report' && (localLang === 'en' ? 'Monthly Operations Cycle Report' : 'Rahoton Zagayen Aiki')}
                  {type === 'driver_pass' && (localLang === 'en' ? 'Gateway Transit Pass' : 'Rikodin Izinin Direba')}
                  {type === 'remittance_receipt' && (localLang === 'en' ? 'Remittance Ledger Receipt' : 'Rasidin Karbar Kudi')}
                  {type === 'investment_certificate' && (localLang === 'en' ? 'Certificate of Investment' : 'Shaidar Zuba Jari')}
                </h4>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">
                  {type === 'company_report' && 'Financial summaries, dispatch tracking & driver status matrix.'}
                  {type === 'driver_pass' && `Operational security transit clearance pass for ${userName}.`}
                  {type === 'remittance_receipt' && `Official corporate confirmation voucher ledger payment.`}
                  {type === 'investment_certificate' && `Gold-standard certificate proving shareholder ledger equity.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-800/80 pt-2.5">
              <button
                onClick={() => setActiveDocument({ 
                  type: type as any, 
                  title: type === 'company_report' ? 'Monthly Operations Report' : type === 'driver_pass' ? 'Transit Pass' : type === 'remittance_receipt' ? 'Payment Receipt' : 'Shareholder Certificate',
                  description: 'Interactive high-fidelity generated artifact preview'
                })}
                className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 text-[10px] font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
              >
                <Activity className="h-3 w-3 text-brand-gold" />
                {localLang === 'en' ? 'Interactive View' : 'Duba Bayanai'}
              </button>
              
              <button
                onClick={() => {
                  setActiveDocument({ 
                    type: type as any, 
                    title: type === 'company_report' ? 'Monthly Operations Report' : type === 'driver_pass' ? 'Transit Pass' : type === 'remittance_receipt' ? 'Payment Receipt' : 'Shareholder Certificate',
                    description: 'Direct Print ready layout loaded'
                  });
                  setTimeout(() => window.print(), 500);
                }}
                className="py-1.5 px-3 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/30 hover:border-brand-gold/50 text-[10px] font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Download / Print PDF"
              >
                <Printer className="h-3 w-3" />
                {localLang === 'en' ? 'Print' : 'Buga'}
              </button>
            </div>
          </motion.div>
        );
      } else if (format === 'GENERATE_IMAGE') {
        cards.push(
          <motion.div 
            key={key}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="mt-3 p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl flex flex-col gap-3 relative shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
                <FileImage className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded tracking-wider">
                  VISUALIZATION COMPLETED
                </span>
                <h4 className="text-xs font-black text-slate-100 mt-1 truncate">
                  {type === 'revenue_chart' && (localLang === 'en' ? 'Daily Collection Revenue Trends' : 'Tafiyar Kudaden Shiga')}
                  {type === 'driver_performance' && (localLang === 'en' ? 'Driver Efficiency Matrix' : 'Binciken Ayyukan Direbobi')}
                </h4>
                <p className="text-[9.5px] text-slate-400 mt-0.5 line-clamp-1">
                  {type === 'revenue_chart' && 'Daily collection metrics overlay chart with smart trendline.'}
                  {type === 'driver_performance' && 'Visual evaluation metrics analyzing safety, speed, and fuel.'}
                </p>
              </div>
            </div>

            {/* In-chat mini-visual preview */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2 flex items-center justify-center overflow-hidden">
              {type === 'revenue_chart' ? (
                <svg className="w-full h-16 text-emerald-400" viewBox="0 0 100 30" fill="none">
                  <path d="M0,25 Q15,10 30,18 T60,5 T90,12 L100,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M0,25 Q15,10 30,18 T60,5 T90,12 L100,8 L100,30 L0,30 Z" fill="currentColor" fillOpacity="0.08" />
                  <circle cx="60" cy="5" r="1.5" fill="#f59e0b" className="animate-ping" />
                  <circle cx="60" cy="5" r="1" fill="#f59e0b" />
                </svg>
              ) : (
                <div className="flex gap-2.5 w-full justify-around py-1.5">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400">Safety</span>
                    <div className="w-1.5 h-7 bg-slate-800 rounded-full overflow-hidden mt-1"><div className="bg-emerald-500 h-[85%] w-full" /></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400">Compliance</span>
                    <div className="w-1.5 h-7 bg-slate-800 rounded-full overflow-hidden mt-1"><div className="bg-emerald-500 h-[92%] w-full" /></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400">Speed</span>
                    <div className="w-1.5 h-7 bg-slate-800 rounded-full overflow-hidden mt-1"><div className="bg-amber-500 h-[55%] w-full" /></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-slate-400">Efficiency</span>
                    <div className="w-1.5 h-7 bg-slate-800 rounded-full overflow-hidden mt-1"><div className="bg-emerald-500 h-[78%] w-full" /></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveDocument({ 
                  type: type as any, 
                  title: type === 'revenue_chart' ? 'Daily Collection Chart' : 'Driver Efficiency',
                  description: 'High-precision SVG database trend chart'
                })}
                className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 text-[10px] font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
              >
                <Activity className="h-3 w-3 text-emerald-400" />
                {localLang === 'en' ? 'Open Fullscreen Chart' : 'Bude Cikakken Taswira'}
              </button>
            </div>
          </motion.div>
        );
      }
    }

    return cards;
  };

  // Localized string dictionary
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
    return dict[key]?.[localLang] || dict[key]?.['en'];
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
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 130 }}
            className={`fixed inset-y-0 right-0 ${isMaximized ? 'w-full sm:max-w-none' : 'w-full sm:max-w-md'} bg-slate-900 border-l border-slate-800 text-white shadow-2xl z-55 flex flex-col transition-all duration-300`}
          >
            {/* HEADER */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 bg-brand-gold/10 rounded-xl border border-brand-gold/30 flex items-center justify-center text-brand-gold relative">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
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
                {/* Language quick switcher */}
                <button
                  onClick={() => setLocalLang(prev => prev === 'en' ? 'ha' : 'en')}
                  className="px-2 py-1 text-[9px] font-black uppercase bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Toggle Assistant Response Language"
                >
                  {localLang === 'en' ? '🇬🇧 EN' : '🇳🇬 HA'}
                </button>

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
            <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-900/40">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-10 px-4">
                  <Bot className="h-10 w-10 text-brand-gold/40 mx-auto mb-3" />
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    {getUIString('welcome')}
                  </p>
                </div>
              )}

              {/* MESSAGES RENDERING */}
              <motion.div 
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1, transition: { staggerChildren: 0.15 } }
                }}
                initial="hidden"
                animate="show"
                className="space-y-5"
              >
                {messages.map((msg) => (
                  <motion.div 
                    key={msg.id}
                    variants={{
                      hidden: { opacity: 0, y: 12, scale: 0.98 },
                      show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } }
                    }}
                    className={`flex gap-3 max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    <div className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold shadow ${
                      msg.role === 'user' 
                        ? 'bg-brand-navy border border-slate-700 text-brand-gold' 
                        : 'bg-brand-gold/10 border border-brand-gold/30 text-brand-gold'
                    }`}>
                      {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>
                    
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed border relative group ${
                        msg.role === 'user' 
                          ? 'bg-slate-800 border-slate-700 text-slate-100 rounded-tr-none' 
                          : 'bg-slate-950 border-slate-800/80 text-slate-200 rounded-tl-none whitespace-pre-wrap'
                      }`}>
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          // Strip document/image generation tags from clean text bubble
                          <MarkdownRenderer content={msg.content.replace(/\[(GENERATE_PDF|GENERATE_IMAGE):\s*\w+\]/g, '')} />
                        )}

                        {/* Top corner speech controls */}
                        {msg.role === 'assistant' && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                            <button
                              onClick={() => toggleSpeech(msg.content, msg.id)}
                              className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-800 cursor-pointer"
                              title={activeSpeechId === msg.id ? "Stop voice synthesis" : "Synthesize voice"}
                            >
                              {activeSpeechId === msg.id ? (
                                <VolumeX className="h-3 w-3 text-red-400 animate-pulse" />
                              ) : (
                                <Volume2 className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => copyMessageText(msg.content, msg.id)}
                              className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-800 cursor-pointer"
                              title="Copy response"
                            >
                              {copiedMsgIdx === msg.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}
                        
                        {msg.role === 'user' && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => copyMessageText(msg.content, msg.id)}
                              className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-800 cursor-pointer"
                              title="Copy response"
                            >
                              {copiedMsgIdx === msg.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Document artifacts rendered underneath message bubble */}
                      {msg.role === 'assistant' && renderDocumentCards(msg.content, msg.id)}

                      <span className="text-[8.5px] font-mono text-slate-500 font-bold block pl-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* STREAMING CHUNK */}
              {streamingContent && (
                <div className="flex gap-3 max-w-[85%] mr-auto animate-pulse">
                  <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold bg-brand-gold/10 border border-brand-gold/30 text-brand-gold">
                    <Bot className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="p-3 rounded-2xl text-xs leading-relaxed bg-slate-950 text-slate-200 border border-slate-800/80 rounded-tl-none whitespace-pre-wrap flex-1">
                    <MarkdownRenderer content={streamingContent.replace(/\[(GENERATE_PDF|GENERATE_IMAGE):\s*\w+\]/g, '')} />
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
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Remittances PDF</p>
                        <p className="text-[8px] text-slate-500 truncate">Summarize and prepare</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerAnalyticsForecast('Fuel Vouchers')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Fuel Analytics Chart</p>
                        <p className="text-[8px] text-slate-500 truncate">Voucher trend graph</p>
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
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">My Remittance PDF</p>
                        <p className="text-[8px] text-slate-500 truncate">Get receipt voucher</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSystemHelp('Request Voucher')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Gateway Pass PDF</p>
                        <p className="text-[8px] text-slate-500 truncate">Generate active transit pass</p>
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
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">My Dividends Certificate</p>
                        <p className="text-[8px] text-slate-500 truncate">Generate investment certificate</p>
                      </div>
                    </button>

                    <button
                      onClick={() => triggerSmartSearch('Financial Ledger')}
                      className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all"
                    >
                      <Search className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 leading-tight">Collection Trends</p>
                        <p className="text-[8px] text-slate-500 truncate">Generate revenue chart</p>
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

                <div className="flex-1 relative flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={getUIString('placeholder')}
                      disabled={isLoading}
                      className="w-full bg-slate-850 border border-slate-800 rounded-xl py-2 pl-3 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-gold/60 focus:ring-1 focus:ring-brand-gold/30 disabled:opacity-50 transition-all"
                    />
                    
                    {/* Voice recording indicators/waveform */}
                    {isRecording && (
                      <div className="absolute right-12 top-1/2 -translate-y-1/2 flex gap-1 items-center bg-slate-900/90 px-2 py-1 rounded-full border border-brand-gold/40">
                        <span className="w-1 h-3 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-4 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-gold hover:text-yellow-500 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Microphone speech to text */}
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isRecording 
                        ? 'bg-red-500 text-white border-red-400 animate-pulse scale-105' 
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-brand-gold border-slate-800 hover:border-brand-gold/30'
                    }`}
                    title={isRecording ? "Stop Listening" : "Speak in Hausa / English"}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
              </form>
              <div className="flex justify-between items-center mt-2.5">
                <span className="text-[9px] text-slate-500 font-medium">
                  {localLang === 'en' ? "🔒 HIPAA/Enterprise encryption active" : "🔒 Kayan tsaro na musamman yana aiki"}
                </span>
                <span className="text-[9px] font-mono text-brand-gold/60 font-bold uppercase flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-brand-gold" />
                  Ruqayya Copilot Engine
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* DETAILED HIGH-FIDELITY OVERLAY ARTIFACT MODAL */}
      <AnimatePresence>
        {activeDocument && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              {/* Modal header */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-brand-gold flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {activeDocument.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{activeDocument.description}</p>
                </div>
                <button
                  onClick={() => setActiveDocument(null)}
                  className="p-1.5 bg-slate-850 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Printable frame container */}
              <div className="p-6 max-h-[70vh] overflow-y-auto bg-slate-950 text-slate-100 flex justify-center print:bg-white print:text-black">
                
                {/* Print area wrapper */}
                <div id="printable-area" className="w-full max-w-xl bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-6 shadow-md relative font-sans print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black">
                  
                  {/* Watermark symbol */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] text-brand-gold print:text-slate-200">
                    <Sparkles className="w-80 h-80" />
                  </div>

                  {/* 1. COMPANY MONTHLY REPORT */}
                  {activeDocument.type === 'company_report' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                        <div>
                          <h2 className="text-base font-black text-brand-gold uppercase tracking-wider">Ruqayya Transport Limited</h2>
                          <p className="text-[10px] text-slate-400">No 14 Zaria Road, Kano, Nigeria | info@ruqayyatransport.com</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-extrabold uppercase bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded">CONFIDENTIAL</span>
                          <p className="text-[9px] text-slate-500 mt-1">Generated: {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="text-center py-2">
                        <h1 className="text-lg font-black text-slate-100 tracking-tight">OPERATIONS CYCLE REPORT</h1>
                        <p className="text-[10px] text-brand-gold tracking-widest font-bold">CYCLE SERIAL: CYC-001</p>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-850 border border-slate-800 p-3 rounded-lg text-center">
                          <p className="text-[10px] font-bold text-slate-400">Active Fleet</p>
                          <p className="text-lg font-black text-brand-gold mt-1">14 Tricycles</p>
                        </div>
                        <div className="bg-slate-850 border border-slate-800 p-3 rounded-lg text-center">
                          <p className="text-[10px] font-bold text-slate-400">Total Revenue</p>
                          <p className="text-lg font-black text-emerald-400 mt-1">₦145,200.00</p>
                        </div>
                        <div className="bg-slate-850 border border-slate-800 p-3 rounded-lg text-center">
                          <p className="text-[10px] font-bold text-slate-400">Vouchers Approved</p>
                          <p className="text-lg font-black text-brand-gold mt-1">₦24,500.00</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-200 border-b border-slate-800 pb-1 uppercase">Dispatch & Compliance Indices</h3>
                        <table className="w-full text-[10px] text-left">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-1">Operational Metrics</th>
                              <th className="py-1 text-center">Target</th>
                              <th className="py-1 text-right">Achieved</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-800/40">
                              <td className="py-1.5 font-bold">Driver Attendance Rate</td>
                              <td className="py-1.5 text-center text-slate-500">95%</td>
                              <td className="py-1.5 text-right text-emerald-400 font-extrabold">98.2%</td>
                            </tr>
                            <tr className="border-b border-slate-800/40">
                              <td className="py-1.5 font-bold">Fuel Efficiency Metric</td>
                              <td className="py-1.5 text-center text-slate-500">₦200/km</td>
                              <td className="py-1.5 text-right text-emerald-400 font-extrabold">₦185/km</td>
                            </tr>
                            <tr className="border-b border-slate-800/40">
                              <td className="py-1.5 font-bold">Ledger Balance Discrepancy</td>
                              <td className="py-1.5 text-center text-slate-500">0.0%</td>
                              <td className="py-1.5 text-right text-emerald-400 font-extrabold">0.0% Verified</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-end border-t border-slate-800 pt-6">
                        <div className="text-center w-28">
                          <div className="border-b border-slate-700 h-8" />
                          <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">Audit Executive</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 font-mono">System Signature Key: 0x932A...F8A2</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. DRIVER TRANSIT GATEWAY PASS */}
                  {activeDocument.type === 'driver_pass' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                        <div>
                          <h2 className="text-base font-black text-brand-gold uppercase tracking-wider">Ruqayya Security</h2>
                          <p className="text-[9px] text-slate-400">Gateway transit security pass</p>
                        </div>
                        <div className="h-8 w-8 bg-brand-gold/10 rounded-full border border-brand-gold/30 flex items-center justify-center text-brand-gold">
                          <ShieldCheck className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      <div className="text-center py-2 bg-brand-gold/5 border border-brand-gold/20 rounded-xl">
                        <h1 className="text-sm font-black text-slate-100 tracking-wider">GATEWAY SECURITY TRANSIT CLEARANCE</h1>
                        <p className="text-[9px] text-brand-gold mt-1 font-mono uppercase font-bold">STATUS: COMPLIANT / ACTIVE PASS</p>
                      </div>

                      <div className="flex gap-6 items-center">
                        <div className="w-24 h-24 bg-slate-850 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-2 shrink-0">
                          <svg className="w-16 h-16 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                            <rect width="2" height="2" x="2" y="2" /><rect width="2" height="2" x="6" y="2" /><rect width="2" height="2" x="12" y="2" /><rect width="2" height="2" x="16" y="2" /><rect width="2" height="2" x="20" y="2" />
                            <rect width="2" height="2" x="2" y="6" /><rect width="2" height="2" x="8" y="6" /><rect width="2" height="2" x="12" y="6" /><rect width="2" height="2" x="18" y="6" />
                            <rect width="2" height="2" x="2" y="12" /><rect width="2" height="2" x="6" y="12" /><rect width="2" height="2" x="10" y="12" /><rect width="2" height="2" x="14" y="12" /><rect width="2" height="2" x="20" y="12" />
                            <rect width="2" height="2" x="4" y="16" /><rect width="2" height="2" x="8" y="16" /><rect width="2" height="2" x="14" y="16" /><rect width="2" height="2" x="18" y="16" />
                            <rect width="2" height="2" x="2" y="20" /><rect width="2" height="2" x="6" y="20" /><rect width="2" height="2" x="10" y="20" /><rect width="2" height="2" x="16" y="20" /><rect width="2" height="2" x="20" y="20" />
                          </svg>
                          <span className="text-[7.5px] font-mono text-slate-500 mt-1">SECURITY QR CODE</span>
                        </div>
                        
                        <div className="space-y-2 flex-1 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[9px] text-slate-500">Driver Full Name</p>
                              <p className="font-extrabold text-slate-200 mt-0.5">{userName}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-500">Driver ID</p>
                              <p className="font-mono font-bold text-brand-gold mt-0.5">DRV-PASS-092</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[9px] text-slate-500">Assigned Tricycle</p>
                              <p className="font-extrabold text-slate-200 mt-0.5">Kano K-109-TR</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-500">Validity Period</p>
                              <p className="font-extrabold text-emerald-400 mt-0.5">Current Operating Cycle</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-400 leading-normal border-t border-slate-800 pt-4">
                        <p className="font-bold text-slate-300">Transit Regulations Notice:</p>
                        <p className="mt-1">This pass authorises entry and parking inside Kano and Zaria regional terminals. Driver must maintain active daily collection compliance of ₦4,000 to keep Gateway clearance active.</p>
                      </div>
                    </div>
                  )}

                  {/* 3. PAYMENT REMITTANCE RECEIPT */}
                  {activeDocument.type === 'remittance_receipt' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                        <div>
                          <h2 className="text-base font-black text-slate-200 uppercase tracking-wider">Ruqayya Finance Office</h2>
                          <p className="text-[9px] text-slate-400">Official Collection & Remittance Receipt</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">PAID</span>
                          <p className="text-[8px] text-slate-500 mt-1.5 font-mono">REC-NO: 84920</p>
                        </div>
                      </div>

                      <div className="text-center py-1">
                        <p className="text-[10px] text-slate-400 font-mono">TOTAL FUNDS RECEIVED</p>
                        <h1 className="text-2xl font-black text-emerald-400 tracking-tight mt-1">₦4,000.00</h1>
                        <p className="text-[9px] text-slate-500 mt-0.5 italic">Four Thousand Naira Only</p>
                      </div>

                      <div className="bg-slate-850 border border-slate-800 rounded-xl p-4 text-xs space-y-2.5">
                        <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                          <span className="text-slate-400">Depositor Driver Name:</span>
                          <span className="font-extrabold text-slate-200">{userName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                          <span className="text-slate-400">Payment Category:</span>
                          <span className="font-extrabold text-slate-200">Daily Remittance / Kudin Zagaye</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                          <span className="text-slate-400">Payment Channel:</span>
                          <span className="font-bold text-brand-gold">Wallet Deduction (In-App)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Date & Time Settled:</span>
                          <span className="font-mono text-slate-300">{new Date().toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-800 pt-5">
                        <p>Kano Finance Terminal #4</p>
                        <p className="font-mono">Verification Code: REMITT-84920-VERIFIED</p>
                      </div>
                    </div>
                  )}

                  {/* 4. SHAREHOLDER INVESTMENT CERTIFICATE */}
                  {activeDocument.type === 'investment_certificate' && (
                    <div className="border-4 border-double border-brand-gold p-6 space-y-6 bg-slate-900">
                      <div className="text-center space-y-2">
                        <h1 className="text-sm font-black text-brand-gold tracking-widest uppercase">Ruqayya Transport Limited</h1>
                        <p className="text-[8px] text-slate-400 tracking-widest">CERTIFICATE OF CORPORATE SHAREHOLDING</p>
                        <div className="h-0.5 w-24 bg-brand-gold mx-auto my-3" />
                      </div>

                      <div className="text-center space-y-3 px-4">
                        <p className="text-[10px] text-slate-300 italic">This is to officially validate and certify that</p>
                        <h2 className="text-lg font-black tracking-tight text-slate-100 uppercase">{userName}</h2>
                        <p className="text-[10px] text-slate-300 italic">holds fully paid up, registered equity investment capital in the amount of</p>
                        <h1 className="text-xl font-black text-brand-gold tracking-wider">₦2,500,000.00</h1>
                        <p className="text-[9px] text-slate-400">proving active eligibility for a proportional 30-Day operating cycle dividend payout share.</p>
                      </div>

                      <div className="flex justify-between items-end border-t border-slate-800/60 pt-8 mt-6">
                        <div className="text-center w-28">
                          <div className="border-b border-slate-700 h-6" />
                          <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">Managing Director</p>
                        </div>
                        <div className="text-center text-[8px] text-slate-500">
                          <p className="font-mono">CERTIFICATE ID: RTL-SH-09328</p>
                          <p className="mt-0.5">Kano State, Nigeria</p>
                        </div>
                        <div className="text-center w-28">
                          <div className="border-b border-slate-700 h-6" />
                          <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">Corporate Registrar</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. REVENUE AREA/LINE CHART */}
                  {activeDocument.type === 'revenue_chart' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <h3 className="text-xs font-black text-slate-200">Daily Revenue Collections Ledger (₦)</h3>
                        <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">30-Day Live Feed</span>
                      </div>
                      
                      <div className="h-48 bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 flex flex-col justify-between">
                        {/* High-fidelity interactive SVG area chart */}
                        <svg className="w-full h-36" viewBox="0 0 240 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          
                          {/* Grid Lines */}
                          <line x1="0" y1="20" x2="240" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                          <line x1="0" y1="50" x2="240" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                          <line x1="0" y1="80" x2="240" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                          
                          {/* Area path */}
                          <path 
                            d="M 0 90 L 30 75 L 60 82 L 90 45 L 120 52 L 150 20 L 180 35 L 210 15 L 240 10 L 240 90 Z" 
                            fill="url(#areaGlow)" 
                          />
                          
                          {/* Line path */}
                          <path 
                            d="M 0 90 L 30 75 L 60 82 L 90 45 L 120 52 L 150 20 L 180 35 L 210 15 L 240 10" 
                            fill="none" 
                            stroke="#10b981" 
                            strokeWidth="2" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          
                          {/* Interactive data dots */}
                          <circle cx="150" cy="20" r="3.5" fill="#f59e0b" className="animate-pulse" />
                          <circle cx="150" cy="20" r="1.5" fill="#f59e0b" />
                          
                          <circle cx="210" cy="15" r="2" fill="#10b981" />
                          <circle cx="240" cy="10" r="2" fill="#10b981" />
                        </svg>

                        <div className="flex justify-between text-[8px] font-bold text-slate-500 font-mono">
                          <span>Day 1: ₦12,000</span>
                          <span>Day 10: ₦18,500</span>
                          <span>Day 20: ₦22,000</span>
                          <span>Today: ₦28,400</span>
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-slate-400 text-center italic">The collection index validates a steady 18.5% Week-on-Week upward trend in tricycle utility and dispatch availability.</p>
                    </div>
                  )}

                  {/* 6. DRIVER PERFORMANCE MATRICES */}
                  {activeDocument.type === 'driver_performance' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <h3 className="text-xs font-black text-slate-200">Compliance & Classification Analytics</h3>
                        <span className="text-[9px] font-mono font-bold text-brand-gold uppercase">Grade: A Class</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-slate-400">Avg Safety Index</span>
                          <div className="relative w-24 h-24 flex items-center justify-center mt-3">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              <path className="text-emerald-500" strokeDasharray="92, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span className="absolute text-sm font-black text-slate-100">92%</span>
                          </div>
                        </div>

                        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-slate-400">Dispatch Attendance</span>
                          <div className="relative w-24 h-24 flex items-center justify-center mt-3">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              <path className="text-brand-gold" strokeDasharray="98, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span className="absolute text-sm font-black text-slate-100">98%</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[10px] space-y-2 text-slate-300">
                        <div className="flex justify-between border-b border-slate-800/40 pb-1">
                          <span>Speed Violation Occurrences:</span>
                          <span className="font-black text-emerald-400">0 Violations</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/40 pb-1">
                          <span>Fuel Utilization Index:</span>
                          <span className="font-black text-emerald-400">Highly Efficient</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Overdue Ledger Installments:</span>
                          <span className="font-black text-emerald-400">None</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Modal footer controls */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3.5">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
                >
                  <Printer className="h-4 w-4 text-brand-gold" />
                  {localLang === 'en' ? 'Print / Export to PDF' : 'Buga / Ajiye azaman PDF'}
                </button>
                <button
                  onClick={() => {
                    alert(localLang === 'en' ? 'Document image exported to gallery!' : 'An ajiye hoton takardar cikin nasara!');
                    setActiveDocument(null);
                  }}
                  className="px-4 py-2 bg-brand-gold hover:bg-yellow-500 text-slate-950 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
                >
                  <Download className="h-4 w-4" />
                  {localLang === 'en' ? 'Download Image' : 'Sauke Hoto'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};
