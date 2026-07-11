import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert } from '../ui/SharedComponents';
import { api } from '../../utils/api';
import { Language, Vehicle, Driver } from '../../types';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Download, 
  Search, 
  Filter, 
  History, 
  FileUp, 
  User, 
  Car, 
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DocumentHubProps {
  lang: Language;
}

interface DocItem {
  id: string;
  title?: string;
  document_type: string;
  file_url: string;
  created_at: string;
  created_by?: string;
  status: string;
  version?: number;
  versions?: {
    version: number;
    file_url: string;
    created_at: string;
    created_by: string;
    title: string;
  }[];
  // Helper tags
  category: 'vehicle' | 'driver' | 'company';
  entityName?: string;
  vehicle_id?: string;
  driver_id?: string;
}

export const DocumentHub: React.FC<DocumentHubProps> = ({ lang }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  
  const [activeCategory, setActiveCategory] = useState<'all' | 'vehicle' | 'driver' | 'company'>('all');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');

  // New Document upload states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'vehicle' | 'driver' | 'company'>('company');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState('license');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Replace/Version State
  const [replacingDoc, setReplacingDoc] = useState<DocItem | null>(null);
  const [replaceFileBase64, setReplaceFileBase64] = useState('');
  const [replaceFileName, setReplaceFileName] = useState('');
  const [replaceError, setReplaceError] = useState('');
  
  // Versions view state
  const [viewingHistoryDoc, setViewingHistoryDoc] = useState<DocItem | null>(null);

  useEffect(() => {
    fetchMetadataAndDocs();

    // Setup listener for real-time SSE updates
    const handleDBChange = () => {
      fetchMetadataAndDocs(false);
    };
    window.addEventListener('db-change', handleDBChange);
    return () => window.removeEventListener('db-change', handleDBChange);
  }, []);

  const fetchMetadataAndDocs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      
      // Fetch metadata for drop-downs
      const vehiclesRes = await fetch('/api/vehicles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const driversRes = await fetch('/api/drivers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const vData = vehiclesRes.ok ? await vehiclesRes.json() : [];
      const dData = driversRes.ok ? await driversRes.json() : [];
      setVehicles(vData);
      setDrivers(dData);

      // We fetch the entire DB or specific lists
      const sseData = (window as any).lastSSEState;
      if (sseData) {
        compileDocs(sseData, vData, dData);
      } else {
        // Fallback or trigger active read
        const dbRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (dbRes.ok) {
          // Trigger custom fetch to compile
          compileDocsFromAPI(vData, dData);
        }
      }
    } catch (err) {
      console.error('Error fetching documents data:', err);
    } finally {
      setLoading(false);
    }
  };

  const compileDocs = (db: any, vList: Vehicle[], dList: Driver[]) => {
    const list: DocItem[] = [];

    if (db.vehicle_documents) {
      db.vehicle_documents.forEach((d: any) => {
        const v = vList.find((vItem: any) => vItem.id === d.vehicle_id);
        list.push({
          ...d,
          category: 'vehicle',
          entityName: v ? `${v.model} (${v.plateNumber})` : 'Unknown Vehicle'
        });
      });
    }

    if (db.driver_documents) {
      db.driver_documents.forEach((d: any) => {
        const drv = dList.find((dItem: any) => dItem.id === d.driver_id);
        list.push({
          ...d,
          category: 'driver',
          entityName: drv ? drv.fullName : 'Unknown Driver'
        });
      });
    }

    if (db.company_documents) {
      db.company_documents.forEach((d: any) => {
        list.push({
          ...d,
          category: 'company',
          entityName: 'Corporate Office'
        });
      });
    }

    setDocs(list);
  };

  const compileDocsFromAPI = async (vList: Vehicle[], dList: Driver[]) => {
    // If SSE isn't ready, let's fallback compile
    const token = localStorage.getItem('ruqayya_token') || '';
    try {
      // In our mock database setup, we can fetch all by category via endpoint fallback
      // Since sseState holds them, we look inside sseState first
      const state = (window as any).lastSSEState;
      if (state) compileDocs(state, vList, dList);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string, name: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(lang === 'en' ? "File limit is 10MB." : "Iyakar girman fayil shine 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string, file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!fileBase64) {
      setUploadError(lang === 'en' ? "Please select a file to upload." : "Da fatan za a zaɓi fayil don shigarwa.");
      return;
    }

    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      const payload = {
        title: uploadTitle || fileName,
        docType: uploadDocType,
        fileBase64,
        driverId: uploadCategory === 'driver' ? selectedDriverId : undefined,
        vehicleId: uploadCategory === 'vehicle' ? selectedVehicleId : undefined
      };

      const res = await fetch('/api/documents/upload-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setUploadSuccess(lang === 'en' ? "Document securely archived!" : "An adana takaddar lafiya!");
      setUploadTitle('');
      setFileBase64('');
      setFileName('');
      setTimeout(() => {
        setUploadOpen(false);
        setUploadSuccess('');
        fetchMetadataAndDocs(false);
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingDoc || !replaceFileBase64) return;

    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      const res = await fetch('/api/documents/replace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          docId: replacingDoc.id,
          category: replacingDoc.category,
          title: replacingDoc.title || replacingDoc.document_type,
          fileBase64: replaceFileBase64
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to replace');

      alert(lang === 'en' ? "New version securely published!" : "An buga sabon salo lafiya!");
      setReplacingDoc(null);
      setReplaceFileBase64('');
      setReplaceFileName('');
      fetchMetadataAndDocs(false);
    } catch (err: any) {
      setReplaceError(err.message);
    }
  };

  const handleDeleteDoc = async (doc: DocItem) => {
    const msg = lang === 'en' 
      ? `Are you absolutely sure you want to permanently delete: ${doc.title || doc.document_type}? This is un-archivable.` 
      : `Shin ko kun tabbata kuna son goge wannan takarda gaba daya: ${doc.title || doc.document_type}? Ba za a iya dawo da ita ba.`;
    
    if (!window.confirm(msg)) return;

    try {
      const token = localStorage.getItem('ruqayya_token') || '';
      const res = await fetch(`/api/documents/${doc.category}/${doc.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deletion failed');

      alert(lang === 'en' ? "Document purged successfully." : "An goge takaddar cikin nasara.");
      fetchMetadataAndDocs(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Helper to trigger secure downloading
  const handleDownload = (fileUrl: string, title?: string) => {
    const token = localStorage.getItem('ruqayya_token') || '';
    const fullUrl = `${fileUrl}?token=${token}`;
    
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = title || 'Document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredDocs = docs.filter(d => {
    const matchesCategory = activeCategory === 'all' || d.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      String(d.title || d.document_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(d.entityName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(d.created_by || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = docTypeFilter === 'all' || d.document_type === docTypeFilter;

    return matchesCategory && matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* DMS Header Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-text-main flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-gold animate-pulse" />
            {lang === 'en' ? "SECURE DOCUMENT ARCHIVE (DMS)" : "GURIN ADANA TAKARDU (DMS)"}
          </h3>
          <p className="text-xs text-text-muted">
            {lang === 'en' 
              ? "Cloudflare R2 Encrypted storage with revision control, actor tracking, and cryptographic audit logging." 
              : "Amintaccen gurin ajiya na Cloudflare R2 tare da bin diddigin sigogi da tarihin ma'aikata."}
          </p>
        </div>
        
        <Button
          onClick={() => setUploadOpen(true)}
          className="font-bold flex items-center gap-2 text-xs cursor-pointer bg-brand-navy hover:bg-slate-900 text-brand-gold self-start sm:self-auto"
        >
          <Upload className="h-4 w-4" />
          {lang === 'en' ? "Upload New Document" : "Sanya Sabuwar Takarda"}
        </Button>
      </div>

      {/* Categories & Navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-main/40 pb-3">
        <div className="flex bg-bg-surface p-1 rounded-lg border border-border-main/50 gap-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'all' ? 'bg-brand-gold text-slate-950 shadow-xs font-extrabold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? "All Records" : "Duk Takardu"}
            <span className="text-[10px] bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{docs.length}</span>
          </button>
          
          <button
            onClick={() => setActiveCategory('vehicle')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'vehicle' ? 'bg-brand-gold text-slate-950 shadow-xs font-extrabold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            {lang === 'en' ? "Fleet Assets" : "Motoci"}
            <span className="text-[10px] bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{docs.filter(d => d.category === 'vehicle').length}</span>
          </button>
          
          <button
            onClick={() => setActiveCategory('driver')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'driver' ? 'bg-brand-gold text-slate-950 shadow-xs font-extrabold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            {lang === 'en' ? "Driver Dossiers" : "Direbobi"}
            <span className="text-[10px] bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{docs.filter(d => d.category === 'driver').length}</span>
          </button>

          <button
            onClick={() => setActiveCategory('company')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'company' ? 'bg-brand-gold text-slate-950 shadow-xs font-extrabold' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Building className="h-3.5 w-3.5" />
            {lang === 'en' ? "Corporate Files" : "Kamfani"}
            <span className="text-[10px] bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{docs.filter(d => d.category === 'company').length}</span>
          </button>
        </div>

        {/* Live Filter Inputs */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? "Search by title, uploader, entity..." : "Nemo ta sunan takarda, mai sanyawa..."}
              className="w-full pl-8 pr-3 py-2 text-xs bg-bg-surface border border-border-main/75 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>

          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="px-2 py-2 text-xs bg-bg-surface border border-border-main/75 rounded-lg focus:outline-none text-text-main font-bold"
          >
            <option value="all">{lang === 'en' ? "All Types" : "Duk Iri"}</option>
            <option value="passport_photo">{lang === 'en' ? "Passport Photo" : "Hoton Fasfo"}</option>
            <option value="driver_license">{lang === 'en' ? "Driver License" : "Lasisin Tuki"}</option>
            <option value="guarantor_id">{lang === 'en' ? "Guarantor ID" : "ID na Mai Tabbatarwa"}</option>
            <option value="vehicle_registration">{lang === 'en' ? "Vehicle Registration" : "Rijistar Mota"}</option>
            <option value="road_worthiness">{lang === 'en' ? "Road Worthiness" : "Hanyar Lafiya"}</option>
            <option value="insurance_policy">{lang === 'en' ? "Insurance" : "Inshora"}</option>
            <option value="customs_declaration">{lang === 'en' ? "Customs Clearing" : "Kayan Kwastam"}</option>
            <option value="corporate_minutes">{lang === 'en' ? "Meeting Minutes" : "Taron Kamfani"}</option>
            <option value="audit_report">{lang === 'en' ? "Financial Audit" : "Rahoton Kudi"}</option>
            <option value="contract">{lang === 'en' ? "Legal Contract" : "Yarjejeniyar Shari'a"}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-muted font-mono text-xs">
          {lang === 'en' ? "Decrypting secure records from R2..." : "Ana duba takaddun R2..."}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-12 text-center bg-bg-surface rounded-xl border border-dashed border-border-main p-8">
          <FileText className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
          <span className="block text-xs font-extrabold text-text-main">
            {lang === 'en' ? "No archived documents found" : "Ba a sami takaddun da aka adana ba"}
          </span>
          <span className="text-[10px] text-text-muted block mt-1">
            {lang === 'en' ? "Adjust your search parameters or archive a new file." : "Gyara bincikenka ko sanya sabon fayil."}
          </span>
        </div>
      ) : (
        /* Document Table Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const token = localStorage.getItem('ruqayya_token') || '';
            const previewUrl = `${doc.file_url}?token=${token}`;

            return (
              <Card key={doc.id} className="bg-bg-surface border-border-main/60 hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden relative">
                
                {/* Version Tag */}
                <div className="absolute right-3 top-3 flex items-center gap-1">
                  <Badge variant={doc.version && doc.version > 1 ? 'info' : 'secondary'} className="text-[9px] font-bold">
                    V{doc.version || 1}
                  </Badge>
                </div>

                <div className="p-4 flex flex-col gap-3">
                  {/* Category and Entity Banner */}
                  <div className="flex items-center gap-1.5 text-[10px] text-brand-navy dark:text-slate-300 font-extrabold uppercase tracking-wider">
                    {doc.category === 'vehicle' && <Car className="h-3 w-3 text-brand-gold" />}
                    {doc.category === 'driver' && <User className="h-3 w-3 text-brand-gold" />}
                    {doc.category === 'company' && <Building className="h-3 w-3 text-brand-gold" />}
                    <span>{doc.category} Archive</span>
                  </div>

                  {/* Title and Uploader info */}
                  <div>
                    <h4 className="text-xs font-bold text-text-main line-clamp-1 group-hover:text-brand-navy dark:group-hover:text-brand-gold transition-colors">
                      {doc.title || (doc.document_type || '').replace(/_/g, ' ').toUpperCase()}
                    </h4>
                    <span className="text-[10px] text-text-muted font-medium block truncate mt-0.5">
                      Entity: {doc.entityName}
                    </span>
                    <span className="text-[9px] text-text-muted font-mono block mt-1">
                      Uploaded by: {doc.created_by || 'System'} | {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Document Type Badge */}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight py-0.5 px-2 bg-bg-base/40 text-text-main border-border-main/75">
                      {(doc.document_type || '').replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="bg-bg-base/40 border-t border-border-main/50 px-4 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownload(doc.file_url, doc.title)}
                      className="p-1.5 rounded-md hover:bg-bg-surface text-brand-navy dark:text-slate-300 hover:text-brand-gold transition-colors cursor-pointer"
                      title={lang === 'en' ? "Download File" : "Zazzage Fayil"}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-bg-surface text-brand-navy dark:text-slate-300 hover:text-brand-gold transition-colors cursor-pointer"
                      title={lang === 'en' ? "Preview File" : "Duba Fayil"}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </a>

                    <button
                      onClick={() => {
                        setReplacingDoc(doc);
                        setReplaceError('');
                      }}
                      className="p-1.5 rounded-md hover:bg-bg-surface text-blue-600 hover:text-blue-500 transition-colors cursor-pointer"
                      title={lang === 'en' ? "Replace / Upload Revision" : "Musanya Salo"}
                    >
                      <FileUp className="h-3.5 w-3.5" />
                    </button>

                    {doc.versions && doc.versions.length > 0 && (
                      <button
                        onClick={() => setViewingHistoryDoc(doc)}
                        className="p-1.5 rounded-md hover:bg-bg-surface text-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer"
                        title={lang === 'en' ? "View Revision History" : "Tarihin Sigogi"}
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteDoc(doc)}
                    className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 text-brand-danger transition-colors cursor-pointer"
                    title={lang === 'en' ? "Purge Record" : "Goge Gaba daya"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* --- MODAL: UPLOAD NEW DOCUMENT --- */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-bg-surface border-border-main shadow-2xl p-6 text-text-main flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-sm font-bold text-text-main">
                {lang === 'en' ? "Archive Document to Cloudflare R2" : "Sanya Takarda a R2 Bucket"}
              </h3>
              <button onClick={() => setUploadOpen(false)} className="text-text-muted hover:text-text-main font-bold cursor-pointer">X</button>
            </div>

            {uploadError && <Alert type="danger">{uploadError}</Alert>}
            {uploadSuccess && <Alert type="success">{uploadSuccess}</Alert>}

            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
              
              {/* Category Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Archive Category" : "Rukunin Ajiya"}</label>
                <select
                  value={uploadCategory}
                  onChange={(e: any) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                >
                  <option value="company">{lang === 'en' ? "Corporate HQ File" : "Fayil na Kamfani"}</option>
                  <option value="driver">{lang === 'en' ? "Driver Dossier (Passport/License)" : "Fayil na Direba"}</option>
                  <option value="vehicle">{lang === 'en' ? "Fleet Asset (Registration/Roadworthiness)" : "Fayil na Mota"}</option>
                </select>
              </div>

              {/* Entity Context selection */}
              {uploadCategory === 'driver' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Select Driver Profile" : "Zaɓi Direba"}</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                  >
                    <option value="">-- {lang === 'en' ? "Choose Driver" : "Zaɓi Direba"} --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName} ({d.company_driver_id || 'Pending'})</option>
                    ))}
                  </select>
                </div>
              )}

              {uploadCategory === 'vehicle' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Select Vehicle Asset" : "Zaɓi Mota"}</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                  >
                    <option value="">-- {lang === 'en' ? "Choose Truck" : "Zaɓi Mota"} --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate_number})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Document Type select */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Document Type" : "Irin Takarda"}</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                >
                  {uploadCategory === 'company' && (
                    <>
                      <option value="corporate_minutes">{lang === 'en' ? "Board Meeting Minutes" : "Taron Hukumar Kamfani"}</option>
                      <option value="audit_report">{lang === 'en' ? "Corporate Audit / Taxes" : "Rahoton Kudi"}</option>
                      <option value="contract">{lang === 'en' ? "Legal Trade Contract" : "Yarjejeniya"}</option>
                      <option value="general">{lang === 'en' ? "General File" : "Wani Fayil"}</option>
                    </>
                  )}
                  {uploadCategory === 'driver' && (
                    <>
                      <option value="passport_photo">{lang === 'en' ? "Passport Photograph" : "Hoton Fasfo"}</option>
                      <option value="driver_license">{lang === 'en' ? "National Driver's License" : "Lasisin Tuki"}</option>
                      <option value="guarantor_id">{lang === 'en' ? "Guarantor ID & Reference" : "ID na Mai Tabbatarwa"}</option>
                      <option value="contract">{lang === 'en' ? "Employment Agreement" : "Yarjejeniyar Aiki"}</option>
                    </>
                  )}
                  {uploadCategory === 'vehicle' && (
                    <>
                      <option value="vehicle_registration">{lang === 'en' ? "Vehicle Log Registration" : "Rijistar Mota"}</option>
                      <option value="road_worthiness">{lang === 'en' ? "Road Worthiness Certificate" : "Hanyar Lafiya"}</option>
                      <option value="insurance_policy">{lang === 'en' ? "Insurance Cover Policy" : "Inshora"}</option>
                      <option value="customs_declaration">{lang === 'en' ? "Customs Clearance Dossier" : "Kayan Kwastam"}</option>
                    </>
                  )}
                </select>
              </div>

              {/* Title Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Document Title / Alias" : "Sunan Takarda"}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Garba_Musa_License_2026"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg-base border border-border-main rounded-lg focus:outline-none"
                />
              </div>

              {/* File input (Accept PDF and Images) */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Upload File (PDF, PNG, JPG, JPEG)" : "Fayil dake son sakawa"}</label>
                <div className="border border-dashed border-border-main/80 hover:border-brand-gold rounded-lg p-4 text-center cursor-pointer relative transition-colors bg-bg-base/30">
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => handleFileRead(e, (b64, name) => {
                      setFileBase64(b64);
                      setFileName(name);
                      if (!uploadTitle) setUploadTitle(name.split('.')[0]);
                    })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileUp className="h-6 w-6 text-text-muted mx-auto mb-2 opacity-60" />
                  <span className="text-[11px] font-bold text-text-main block">
                    {fileName || (lang === 'en' ? "Click or Drag to Upload" : "Danna ko Jawo Fayil Nan")}
                  </span>
                  <span className="text-[9px] text-text-muted mt-1 block">Max size: 10MB</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border-main/50 pt-3 mt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setUploadOpen(false)} className="font-bold cursor-pointer">
                  {lang === 'en' ? "Cancel" : "Soke"}
                </Button>
                <Button variant="secondary" size="sm" type="submit" className="font-bold cursor-pointer text-slate-950 bg-brand-gold">
                  {lang === 'en' ? "Commit Archive" : "Adana"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* --- MODAL: REPLACE / PUBLISH REVISION --- */}
      {replacingDoc && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-bg-surface border-border-main shadow-2xl p-6 text-text-main flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-sm font-bold text-text-main">
                {lang === 'en' ? `Publish Version V${(replacingDoc.version || 1) + 1} Revision` : `Buga Sabon Siga na V${(replacingDoc.version || 1) + 1}`}
              </h3>
              <button onClick={() => setReplacingDoc(null)} className="text-text-muted hover:text-text-main font-bold cursor-pointer">X</button>
            </div>

            {replaceError && <Alert type="danger">{replaceError}</Alert>}

            <form onSubmit={handleReplaceSubmit} className="flex flex-col gap-4">
              <div className="bg-bg-base/50 p-3 rounded-lg border border-border-main/40 text-[11px] flex flex-col gap-1">
                <span className="font-bold text-text-main">{lang === 'en' ? "Original Document Details" : "Bayanin Asalin Takarda"}:</span>
                <span>ID: {replacingDoc.id}</span>
                <span>Type: {replacingDoc.document_type}</span>
                <span>Current Version: V{replacingDoc.version || 1}</span>
                <span>Uploader: {replacingDoc.created_by || 'System'}</span>
              </div>

              {/* New file selection */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Upload Replacement File" : "Zaɓi Fayil na Sauyi"}</label>
                <div className="border border-dashed border-border-main/80 hover:border-brand-gold rounded-lg p-4 text-center cursor-pointer relative transition-colors bg-bg-base/30">
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => handleFileRead(e, (b64, name) => {
                      setReplaceFileBase64(b64);
                      setReplaceFileName(name);
                    })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="h-6 w-6 text-text-muted mx-auto mb-2 opacity-60" />
                  <span className="text-[11px] font-bold text-text-main block">
                    {replaceFileName || (lang === 'en' ? "Click to pick replacement" : "Danna don zaɓar takardar canji")}
                  </span>
                  <span className="text-[9px] text-text-muted mt-1 block">R2 Encrypted revisioning logs will preserve older versions.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border-main/50 pt-3 mt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setReplacingDoc(null)} className="font-bold cursor-pointer">
                  {lang === 'en' ? "Cancel" : "Soke"}
                </Button>
                <Button variant="secondary" size="sm" type="submit" className="font-bold cursor-pointer text-slate-950 bg-brand-gold">
                  {lang === 'en' ? "Publish Revision" : "Buga Sabon Siga"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* --- MODAL: REVISION VERSION HISTORY VIEW --- */}
      {viewingHistoryDoc && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-bg-surface border-border-main shadow-2xl p-6 text-text-main flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-1.5">
                <History className="h-4 w-4 text-indigo-500" />
                {lang === 'en' ? `Revision Logs for: ${viewingHistoryDoc.title || viewingHistoryDoc.document_type}` : `Tarihin Sigogi na: ${viewingHistoryDoc.title || viewingHistoryDoc.document_type}`}
              </h3>
              <button onClick={() => setViewingHistoryDoc(null)} className="text-text-muted hover:text-text-main font-bold cursor-pointer">X</button>
            </div>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              
              {/* Current Active Version Banner */}
              <div className="p-3 bg-brand-navy/10 border border-brand-navy/40 rounded-lg flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-brand-navy dark:text-slate-200 block">
                    {lang === 'en' ? "Active Version (Latest)" : "Siga dake Aiki (Sabuwa)"} - V{viewingHistoryDoc.version || 1}
                  </span>
                  <span className="text-[9px] text-text-muted font-mono">
                    Uploaded: {new Date(viewingHistoryDoc.created_at).toLocaleString()} by {viewingHistoryDoc.created_by || 'System'}
                  </span>
                </div>
                <Button 
                  size="xs" 
                  variant="outline"
                  onClick={() => handleDownload(viewingHistoryDoc.file_url, viewingHistoryDoc.title)}
                  className="cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>

              {/* Historic versions listing */}
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">{lang === 'en' ? "Historic Archived Versions" : "Tsofaffin Sigogi a R2"}</span>
                {viewingHistoryDoc.versions?.map((history, idx) => (
                  <div key={idx} className="p-3 bg-bg-base/50 rounded-lg border border-border-main/40 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-text-main block">Version V{history.version}</span>
                      <span className="text-[9px] text-text-muted font-mono block">
                        Archived: {new Date(history.created_at).toLocaleString()} by {history.created_by}
                      </span>
                    </div>
                    <Button 
                      size="xs" 
                      variant="outline"
                      onClick={() => handleDownload(history.file_url, history.title)}
                      className="cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-border-main/50 pt-3 mt-2">
              <Button variant="outline" size="sm" onClick={() => setViewingHistoryDoc(null)} className="font-bold cursor-pointer">
                {lang === 'en' ? "Close" : "Rufe"}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};
