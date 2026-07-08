import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert } from '../ui/SharedComponents';
import { 
  Send, 
  MessageSquare, 
  Megaphone, 
  Paperclip, 
  User, 
  Users, 
  Shield, 
  Image, 
  FileText, 
  Search, 
  Bell, 
  Download, 
  CheckCheck,
  Building
} from 'lucide-react';
import { Language, Driver } from '../../types';
import { saveR2File } from '../../utils/server_db'; // client side helper is built inside API proxy, let's mock local uploads inside component

interface CommunicationCenterProps {
  lang: Language;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  receiver_id: string;
  receiver_role: string;
  text: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  delivered_status: number;
  read_status: number;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  target_audience: string;
  image_url?: string;
  attachment_url?: string;
  attachment_name?: string;
  published_by: string;
  created_at: string;
}

interface UserSummary {
  id: string;
  fullName: string;
  role: 'driver' | 'admin' | 'director' | 'shareholder';
  phone?: string;
  avatar?: string;
}

export const CommunicationCenter: React.FC<CommunicationCenterProps> = ({ lang }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [usersList, setUsersList] = useState<UserSummary[]>([]);
  
  const [activeTab, setActiveTab] = useState<'chat' | 'announcements' | 'publish'>('chat');
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  
  // Chat input states
  const [chatText, setChatText] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState(''); // 'image' or 'pdf'
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // New Announcement states
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annAudience, setAnnAudience] = useState<'all' | 'driver' | 'admin' | 'shareholder'>('all');
  const [annImageBase64, setAnnImageBase64] = useState('');
  const [annFileName, setAnnFileName] = useState('');
  const [annFileBase64, setAnnFileBase64] = useState('');
  const [annError, setAnnError] = useState('');
  const [annSuccess, setAnnSuccess] = useState('');

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchUserQuery, setSearchUserQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchActiveUserAndEntities();

    // SSE window listener
    const handleDBChange = () => {
      syncCommunications(false);
    };
    window.addEventListener('db-change', handleDBChange);
    return () => window.removeEventListener('db-change', handleDBChange);
  }, []);

  useEffect(() => {
    // Scroll chats to bottom when messages list or active user shifts
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedUser]);

  const fetchActiveUserAndEntities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      
      // Get current logged-in user profile
      const userRes = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!userRes.ok) throw new Error('Auth failed');
      const userData = await userRes.json();
      setCurrentUser(userData);

      // Get drivers
      const drvRes = await fetch('/api/drivers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const drvList = drvRes.ok ? await drvRes.json() : [];
      setDrivers(drvList);

      // We compile possible recipients:
      // Directs, Admins, Drivers, Shareholders
      // Compile them based on mock database snapshot
      const sseData = (window as any).lastSSEState;
      if (sseData) {
        compileUsersList(sseData, userData);
        setMessages(sseData.messages || []);
        setAnnouncements(sseData.announcements || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const syncCommunications = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const sseData = (window as any).lastSSEState;
    if (sseData && currentUser) {
      compileUsersList(sseData, currentUser);
      setMessages(sseData.messages || []);
      setAnnouncements(sseData.announcements || []);
    }
    if (showLoading) setLoading(false);
  };

  const compileUsersList = (db: any, currUser: any) => {
    const list: UserSummary[] = [];

    // Add corporate office actors (admins & directors)
    if (db.users) {
      db.users.forEach((u: any) => {
        if (u.id === currUser.id) return; // skip self
        const role = db.roles.find((r: any) => r.id === u.role_id);
        const roleName = role ? role.name : 'public';
        
        if (roleName !== 'public') {
          list.push({
            id: u.id,
            fullName: u.full_name,
            role: roleName as any,
            phone: u.phone || undefined
          });
        }
      });
    }

    setUsersList(list);
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size limit is 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentBase64(reader.result as string);
        setAttachmentName(file.name);
        setAttachmentType(file.type.includes('pdf') ? 'pdf' : 'image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || (!chatText && !attachmentBase64)) return;

    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      let remoteAttachmentUrl = '';

      if (attachmentBase64) {
        setUploadingAttachment(true);
        // Upload attachment to R2 Simulation first
        const uploadRes = await fetch('/api/documents/upload-company', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: `attachment_${Date.now()}_${attachmentName.replace(/\s+/g, '_')}`,
            docType: 'general',
            fileBase64: attachmentBase64
          })
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          remoteAttachmentUrl = uploadData.fileUrl;
        }
        setUploadingAttachment(false);
      }

      // Send actual message
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          receiverRole: selectedUser.role,
          text: chatText,
          attachmentUrl: remoteAttachmentUrl || undefined,
          attachmentType: remoteAttachmentUrl ? attachmentType : undefined,
          attachmentName: remoteAttachmentUrl ? attachmentName : undefined
        })
      });

      if (!res.ok) throw new Error('Send failure');

      setChatText('');
      setAttachmentBase64('');
      setAttachmentName('');
      setAttachmentType('');
      
      // Force instant poll check
      fetchActiveUserAndEntities();
    } catch (err) {
      console.error(err);
      setUploadingAttachment(false);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnError('');
    setAnnSuccess('');

    if (!annTitle || !annMessage) {
      setAnnError("Please supply a valid title and broadcast body.");
      return;
    }

    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      let imageUrl = '';
      let attachmentUrl = '';

      // Upload image attachment if specified
      if (annImageBase64) {
        const uRes = await fetch('/api/documents/upload-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            title: `announcement_img_${Date.now()}`,
            docType: 'general',
            fileBase64: annImageBase64
          })
        });
        if (uRes.ok) {
          const uD = await uRes.json();
          imageUrl = uD.fileUrl;
        }
      }

      // Upload file document attachment if specified
      if (annFileBase64) {
        const uRes = await fetch('/api/documents/upload-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            title: annFileName.replace(/\s+/g, '_'),
            docType: 'general',
            fileBase64: annFileBase64
          })
        });
        if (uRes.ok) {
          const uD = await uRes.json();
          attachmentUrl = uD.fileUrl;
        }
      }

      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: annTitle,
          message: annMessage,
          targetAudience: annAudience,
          imageUrl,
          attachmentUrl,
          attachmentName: annFileName
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Broadcast failed');

      setAnnSuccess("Broadcast published successfully to target audience!");
      setAnnTitle('');
      setAnnMessage('');
      setAnnImageBase64('');
      setAnnFileBase64('');
      setAnnFileName('');

      setTimeout(() => {
        setActiveTab('announcements');
        setAnnSuccess('');
        fetchActiveUserAndEntities();
      }, 1500);

    } catch (err: any) {
      setAnnError(err.message);
    }
  };

  const handleDownloadAttachment = (url: string, name?: string) => {
    const token = localStorage.getItem('ruqayya_token') || '';
    const fullUrl = `${url}?token=${token}`;
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = name || 'Attachment';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Compile active messages of the selected thread (between currentUser.id <-> selectedUser.id)
  const activeConversation = selectedUser && currentUser ? messages.filter(m => {
    return (m.sender_id === currentUser.id && m.receiver_id === selectedUser.id) ||
           (m.sender_id === selectedUser.id && m.receiver_id === currentUser.id);
  }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];

  const filteredUsers = usersList.filter(u => {
    return String(u.fullName || '').toLowerCase().includes(searchUserQuery.toLowerCase()) ||
           String(u.role || '').toLowerCase().includes(searchUserQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-main/50 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-text-main flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand-gold animate-bounce" />
            {lang === 'en' ? "COMMUNICATIONS CENTRAL" : "GURIN SADA ZUMUNTA"}
          </h3>
          <p className="text-xs text-text-muted">
            {lang === 'en' 
              ? "Internal workspace chat, document attachments, and broadcast role-specific announcements." 
              : "Tattaunawar cikin gida ta ma'aikata, musayar fayiloli, da rarraba sanarwa ga takamaiman mutane."}
          </p>
        </div>

        <div className="flex bg-bg-surface p-1 rounded-lg border border-border-main/60 gap-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'chat' ? 'bg-brand-navy text-brand-gold font-extrabold shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "Direct Messages" : "Tattaunawa"}
          </button>
          
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'announcements' ? 'bg-brand-navy text-brand-gold font-extrabold shadow-sm' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "Announcements" : "Sanarwa"}
          </button>

          {currentUser && (currentUser.role === 'admin' || currentUser.role === 'director') && (
            <button
              onClick={() => setActiveTab('publish')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === 'publish' ? 'bg-brand-gold text-slate-950 font-extrabold shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Megaphone className="h-3.5 w-3.5 inline mr-1" />
              {lang === 'en' ? "Broadcast" : "Sanar da Jama'a"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-muted font-mono text-xs">
          {lang === 'en' ? "Initializing real-time channels..." : "Ana buɗe hanyoyin tattaunawa..."}
        </div>
      ) : activeTab === 'chat' ? (
        /* ================== DIRECT MESSAGING PANEL ================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-bg-surface border border-border-main/60 rounded-xl overflow-hidden min-h-[500px]">
          
          {/* LEFT RECIPIENT COLUMN */}
          <div className="lg:col-span-4 border-r border-border-main/50 flex flex-col">
            <div className="p-4 border-b border-border-main/50 flex flex-col gap-3">
              <span className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                {lang === 'en' ? "Corporate Roster" : "Ma'aikata & Direbobi"}
              </span>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder={lang === 'en' ? "Search people..." : "Nemo mutum..."}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-bg-base border border-border-main/50 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px]">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-[11px] text-text-muted">
                  No contacts found matching search.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const unreadCount = messages.filter(m => m.sender_id === u.id && m.receiver_id === currentUser?.id && m.read_status === 0).length;
                  const isSelected = selectedUser?.id === u.id;

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        // Trigger read acknowledgement
                        if (unreadCount > 0) {
                          const token = localStorage.getItem('ruqayya_token') || '';
                          fetch('/api/messages/read', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ senderId: u.id })
                          }).then(() => fetchActiveUserAndEntities());
                        }
                      }}
                      className={`p-3.5 border-b border-border-main/30 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-navy/10 border-l-4 border-l-brand-gold' : 'hover:bg-bg-base/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-brand-navy text-brand-gold border-brand-gold' : 'bg-slate-100 dark:bg-slate-800 text-text-muted border-border-main'
                        }`}>
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-text-main truncate block">{u.fullName}</span>
                          <span className="text-[10px] text-text-muted capitalize block font-medium font-mono">{u.role}</span>
                        </div>
                      </div>

                      {unreadCount > 0 && (
                        <span className="h-4 min-w-4 bg-brand-danger text-white rounded-full text-[9px] font-bold flex items-center justify-center px-1">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT MESSAGES SCREEN */}
          <div className="lg:col-span-8 flex flex-col min-h-[500px]">
            {selectedUser ? (
              <>
                {/* Active Thread Bar */}
                <div className="px-5 py-3.5 border-b border-border-main/50 bg-bg-base/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-brand-navy text-brand-gold flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-text-main block">{selectedUser.fullName}</span>
                      <span className="text-[10px] text-text-muted block font-mono capitalize">{selectedUser.role} Portal Thread</span>
                    </div>
                  </div>
                </div>

                {/* Conversation Box */}
                <div className="flex-1 p-5 overflow-y-auto max-h-[350px] bg-bg-base/10 flex flex-col gap-4">
                  {activeConversation.length === 0 ? (
                    <div className="my-auto text-center py-12">
                      <MessageSquare className="h-8 w-8 text-text-muted opacity-40 mx-auto mb-2" />
                      <span className="text-xs font-bold text-text-muted block">No messages exchanged yet.</span>
                      <span className="text-[10px] text-text-muted block mt-1">Start the workspace discussion below.</span>
                    </div>
                  ) : (
                    activeConversation.map((m) => {
                      const isMe = m.sender_id === currentUser.id;

                      return (
                        <div key={m.id} className={`flex flex-col max-w-[75%] gap-1 ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                          
                          {/* Chat bubble */}
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isMe ? 'bg-brand-navy text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-text-main rounded-tl-none'
                          }`}>
                            {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}

                            {/* Secure Attachment Display inside bubble */}
                            {m.attachment_url && (
                              <div className={`mt-2 p-2 rounded-lg border flex items-center gap-2 bg-bg-surface/50 border-border-main/30`}>
                                {m.attachment_type === 'image' ? (
                                  <div className="relative group shrink-0 w-16 h-12 rounded overflow-hidden border border-border-main">
                                    <img 
                                      src={`${m.attachment_url}?token=${localStorage.getItem('ruqayya_token')}`} 
                                      alt="Attachment" 
                                      className="h-full w-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <FileText className="h-5 w-5 text-brand-gold shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-[10px] font-bold block truncate text-text-main">{m.attachment_name || "Attachment"}</span>
                                  <button
                                    onClick={() => handleDownloadAttachment(m.attachment_url!, m.attachment_name)}
                                    className="text-[9px] text-brand-gold font-bold hover:underline cursor-pointer"
                                  >
                                    Download
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Timestamp / Read status */}
                          <div className="flex items-center gap-1.5 text-[9px] text-text-muted font-mono mt-0.5">
                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              <CheckCheck className={`h-3.5 w-3.5 ${m.read_status === 1 ? 'text-blue-500' : 'text-text-muted'}`} />
                            )}
                          </div>

                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Secure File upload indicator */}
                {attachmentName && (
                  <div className="px-5 py-2 bg-bg-base border-t border-border-main/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-main flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3 text-brand-gold" />
                      Attachment Selected: {attachmentName}
                    </span>
                    <button 
                      onClick={() => { setAttachmentBase64(''); setAttachmentName(''); setAttachmentType(''); }}
                      className="text-[10px] text-brand-danger font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Form Inputs */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-border-main/50 bg-bg-base/20 flex items-center gap-2">
                  
                  {/* File Upload Attachment Trigger */}
                  <div className="relative shrink-0">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleAttachmentUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-8 h-8"
                    />
                    <button type="button" className="p-2 rounded-lg bg-bg-surface hover:bg-bg-base border border-border-main text-text-muted hover:text-text-main transition-colors cursor-pointer" title="Attach image or PDF">
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder={lang === 'en' ? "Type a corporate response..." : "Rubuta saƙo na aiki..."}
                    className="flex-1 px-3 py-2 text-xs bg-bg-surface border border-border-main rounded-lg focus:outline-none"
                  />

                  <Button
                    type="submit"
                    disabled={uploadingAttachment}
                    className="font-bold cursor-pointer text-brand-navy shrink-0 py-2 px-3 hover:scale-105"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="m-auto text-center py-24">
                <MessageSquare className="h-12 w-12 text-brand-gold opacity-50 mx-auto mb-3 animate-pulse" />
                <h4 className="text-sm font-extrabold text-text-main">{lang === 'en' ? "Open a Workspace Chat" : "Buɗe Tattaunawa"}</h4>
                <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
                  {lang === 'en' 
                    ? "Select a corporate officer, director, driver, or shareholder from the roster to begin secure messaging." 
                    : "Zaɓi ma'aikaci, darekta, ko direba daga jerin sunayen don fara tattaunawa amintacciya."}
                </p>
              </div>
            )}
          </div>

        </div>
      ) : activeTab === 'announcements' ? (
        /* ================== ANNOUNCEMENTS TIMELINE PANEL ================== */
        <div className="flex flex-col gap-4">
          <span className="text-xs font-extrabold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Active Announcements & Directives" : "Sanarwa na Kamfani dake Aiki"}</span>
          
          {announcements.length === 0 ? (
            <div className="py-12 text-center bg-bg-surface rounded-xl border border-dashed border-border-main/60 p-8">
              <Megaphone className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
              <span className="block text-xs font-bold text-text-main">{lang === 'en' ? "No corporate announcements" : "Babu wata sanarwa a yanzu"}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {announcements.map((ann) => {
                const token = localStorage.getItem('ruqayya_token') || '';
                const imageUrl = ann.image_url ? `${ann.image_url}?token=${token}` : '';
                const attachmentUrl = ann.attachment_url ? `${ann.attachment_url}?token=${token}` : '';

                return (
                  <Card key={ann.id} className="bg-bg-surface border-border-main/50 p-5 flex flex-col gap-3 hover:shadow-xs transition-shadow">
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="info" className="uppercase text-[9px] font-bold font-mono py-0.5 px-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                          To: {ann.target_audience === 'all' ? "All Staff" : `${ann.target_audience}s`}
                        </Badge>
                      </div>
                      <span className="text-[9px] text-text-muted font-mono">{new Date(ann.created_at).toLocaleString()}</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-extrabold text-text-main">{ann.title}</h4>
                      <p className="text-xs text-text-muted mt-2 leading-relaxed whitespace-pre-wrap">{ann.message}</p>
                    </div>

                    {/* Announcement Image preview */}
                    {ann.image_url && (
                      <div className="max-w-md border border-border-main rounded-lg overflow-hidden my-1 bg-bg-base relative">
                        <img 
                          src={imageUrl} 
                          alt="Announcement illustration" 
                          className="w-full max-h-64 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {/* Announcement file attachments */}
                    {ann.attachment_url && (
                      <div className="p-3 bg-bg-base rounded-lg border border-border-main/50 flex items-center justify-between gap-3 self-start">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-brand-gold shrink-0" />
                          <span className="text-[11px] font-bold text-text-main max-w-xs truncate">{ann.attachment_name || "Download Attachment"}</span>
                        </div>
                        <Button 
                          size="xs" 
                          variant="secondary"
                          onClick={() => handleDownloadAttachment(ann.attachment_url!, ann.attachment_name)}
                          className="cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    <div className="border-t border-border-main/40 pt-2 flex items-center justify-between">
                      <span className="text-[9px] text-text-muted font-medium font-mono">Published by Director: {ann.published_by}</span>
                    </div>

                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================== PUBLISH BROADCAST EDITOR ================== */
        <div className="max-w-2xl bg-bg-surface border border-border-main/60 rounded-xl p-6 shadow-xs mx-auto w-full">
          <div className="flex items-center gap-2 border-b border-border-main/50 pb-3 mb-5">
            <Megaphone className="h-5 w-5 text-brand-gold" />
            <h4 className="text-sm font-extrabold text-text-main">{lang === 'en' ? "Draft Corporate Announcement" : "Rubuta Sabuwar Sanarwa"}</h4>
          </div>

          {annError && <Alert type="danger">{annError}</Alert>}
          {annSuccess && <Alert type="success">{annSuccess}</Alert>}

          <form onSubmit={handlePublishAnnouncement} className="flex flex-col gap-4">
            
            {/* Target audience */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Target Audience Group" : "Masu Karbar Sanarwa"}</label>
              <select
                value={annAudience}
                onChange={(e: any) => setAnnAudience(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none font-bold"
              >
                <option value="all">{lang === 'en' ? "Everyone (All Users)" : "Kowa da Kowa"}</option>
                <option value="driver">{lang === 'en' ? "Drivers Only" : "Direbobi Kawai"}</option>
                <option value="admin">{lang === 'en' ? "Admins Only" : "Masu Kula Kawai (Admins)"}</option>
                <option value="shareholder">{lang === 'en' ? "Shareholders Only" : "Masu Hannun Jari"}</option>
              </select>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Broadcast Title" : "Taken Sanarwa"}</label>
              <input
                type="text"
                required
                placeholder="e.g. Fuel Voucher Rates Adjustment Q3"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
              />
            </div>

            {/* Message Body */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Official Message" : "Sakon Sanarwa"}</label>
              <textarea
                required
                rows={5}
                placeholder="Write the corporate memo or operational guidelines..."
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
              />
            </div>

            {/* Image Upload */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Embed Illustration Image" : "Saka Hoto a Sanarwar"}</label>
              <div className="border border-dashed border-border-main/80 rounded-lg p-3 text-center cursor-pointer relative bg-bg-base/30 hover:border-brand-gold">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onloadend = () => setAnnImageBase64(r.result as string);
                      r.readAsDataURL(file);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Image className="h-5 w-5 text-text-muted mx-auto mb-1" />
                <span className="text-[10px] font-bold text-text-main block">
                  {annImageBase64 ? "Image Loaded Successfully" : "Click to select inline JPEG/PNG banner"}
                </span>
              </div>
            </div>

            {/* Document File Attachment */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Attach Official PDF Memo" : "Saka Fayil na PDF"}</label>
              <div className="border border-dashed border-border-main/80 rounded-lg p-3 text-center cursor-pointer relative bg-bg-base/30 hover:border-brand-gold">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAnnFileName(file.name);
                      const r = new FileReader();
                      r.onloadend = () => setAnnFileBase64(r.result as string);
                      r.readAsDataURL(file);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileText className="h-5 w-5 text-text-muted mx-auto mb-1" />
                <span className="text-[10px] font-bold text-text-main block">
                  {annFileName ? `Attached: ${annFileName}` : "Click to attach secure document PDF"}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border-main/50 pt-4 mt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setActiveTab('announcements')} className="font-bold cursor-pointer">
                Cancel
              </Button>
              <Button variant="secondary" size="sm" type="submit" className="font-bold cursor-pointer text-slate-950 bg-brand-gold">
                Publish Memo Broadcast
              </Button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};
