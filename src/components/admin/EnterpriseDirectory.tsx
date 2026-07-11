import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  User, 
  Camera,
  Shield, 
  Briefcase, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Filter, 
  ArrowUpDown, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Award, 
  Calendar, 
  CreditCard, 
  Landmark, 
  FileText, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle,
  Truck,
  Eye,
  Key
} from 'lucide-react';
import { api } from '../../utils/api';
import { Badge } from '../ui/SharedComponents';
import { Button } from '../ui/Button';

interface EnterpriseDirectoryProps {
  lang: 'en' | 'ha';
  dictionary: any;
}

export default function EnterpriseDirectory({ lang, dictionary }: EnterpriseDirectoryProps) {
  // Tabs: 'drivers' | 'shareholders' | 'admins' | 'directors'
  const [activeTab, setActiveTab] = useState<'drivers' | 'shareholders' | 'admins' | 'directors'>('drivers');
  
  // Real-time Lists State
  const [drivers, setDrivers] = useState<any[]>([]);
  const [shareholders, setShareholders] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // UI Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subFilter, setSubFilter] = useState<string>('all'); // classification for drivers, portfolio for directors, level for admins
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Selected Profile for Detail View
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);

  // Form Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form Fields
  const [formData, setFormData] = useState({
    id: '', // for edits
    fullName: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    status: 'active',
    // Drivers fields
    nin: '',
    licenseNumber: '',
    licenseExpiry: '',
    classification: 'Assisted',
    agreedAmount: '30000',
    remainingVehicleBalance: '15000000',
    // Shareholders fields
    investmentAmount: '5000000',
    investmentDate: new Date().toISOString().split('T')[0],
    bankName: 'Access Bank PLC',
    accountNumber: '',
    // Admins fields
    privilegeLevel: 'Level 1: Fleet Operations',
    assignedTasks: 'Fleet Dispatch, Voucher Issuance, Real-time Tracking',
    // Directors fields
    portfolio: 'Executive Director',
    shareholdingEquity: '5.0%'
  });

  // Fetch all directories
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await api.request('/api/directory/all');
      if (data.success) {
        setDrivers(data.drivers || []);
        setShareholders(data.shareholders || []);
        setAdmins(data.admins || []);
        setDirectors(data.directors || []);
      } else {
        setErrorMsg(lang === 'en' ? 'Failed to fetch personnel directory' : 'An kasa samun rukunin ma’aikata');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Network communication error');
    } finally {
      setLoading(false);
    }
  };

  // Listen to SSE updates
  useEffect(() => {
    fetchAllData();

    const handleDBChange = () => {
      fetchAllData();
    };

    window.addEventListener('db-change', handleDBChange);
    return () => {
      window.removeEventListener('db-change', handleDBChange);
    };
  }, []);

  // Helper translations
  const t = {
    searchPlaceholder: lang === 'en' ? "Search Name, ID, Telephone, Email..." : "Nemo Suna, ID, Wayar Tarho, Email...",
    allStatus: lang === 'en' ? "All Statuses" : "Duk Matsayi",
    active: lang === 'en' ? "Active" : "Aiki",
    suspended: lang === 'en' ? "Suspended" : "An Dakatar",
    pending: lang === 'en' ? "Pending Review" : "Jiran Dubawa",
    rest: lang === 'en' ? "On Rest" : "Hutu",
    addPerson: lang === 'en' ? "Register New" : "Rijista Sabo",
    addDriver: lang === 'en' ? "Register Driver" : "Rijistar Direba",
    addShareholder: lang === 'en' ? "Add Shareholder" : "Saka Shareholder",
    addAdmin: lang === 'en' ? "Create Admin" : "Siri Admin",
    addDirector: lang === 'en' ? "Add Director" : "Saka Director",
    editProfile: lang === 'en' ? "Modify Profile" : "Gyara Bayanai",
    statusLabel: lang === 'en' ? "Status" : "Matusayi",
    companyId: lang === 'en' ? "Company ID" : "Lambar Kamfani",
    actions: lang === 'en' ? "Actions" : "Ayyuka",
    viewProfile: lang === 'en' ? "View Details" : "Duba Bayanai",
    saveChange: lang === 'en' ? "Save Operational Profile" : "Ajiye Bayanan Aiki",
    cancel: lang === 'en' ? "Cancel" : "Soke",
    deleteSuccess: lang === 'en' ? "Record successfully cleared from system nodes" : "An goge bayanin cikin nasara",
    confirmDelete: lang === 'en' ? "Are you sure you want to permanently delete this account? This cannot be undone." : "Shin kuna da tabbacin kuna son goge wannan asusun gaba daya? Ba za a iya dawo da shi ba."
  };

  // Switch tab resets pagination & filters
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery('');
    setStatusFilter('all');
    setSubFilter('all');
  };

  // Get active list based on tab
  const getActiveList = () => {
    switch (activeTab) {
      case 'drivers': return drivers;
      case 'shareholders': return shareholders;
      case 'admins': return admins;
      case 'directors': return directors;
    }
  };

  // Filter & Sort active list
  const getFilteredList = () => {
    let list = [...getActiveList()];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => 
        (item.fullName && item.fullName.toLowerCase().includes(q)) ||
        (item.company_driver_id && item.company_driver_id.toLowerCase().includes(q)) ||
        (item.company_id && item.company_id.toLowerCase().includes(q)) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(item => item.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    // Sub-filters
    if (subFilter !== 'all') {
      if (activeTab === 'drivers') {
        list = list.filter(item => item.classification?.toLowerCase() === subFilter.toLowerCase());
      } else if (activeTab === 'admins') {
        list = list.filter(item => item.privilege_level?.toLowerCase().includes(subFilter.toLowerCase()));
      } else if (activeTab === 'directors') {
        list = list.filter(item => item.portfolio?.toLowerCase().includes(subFilter.toLowerCase()));
      }
    }

    // Sort
    list.sort((a, b) => {
      let valA = a.fullName || '';
      let valB = b.fullName || '';
      
      if (sortBy === 'date') {
        valA = a.registrationDate || '';
        valB = b.registrationDate || '';
      } else if (sortBy === 'id') {
        valA = a.company_driver_id || a.company_id || '';
        valB = b.company_driver_id || b.company_id || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  };

  const filteredList = getFilteredList();

  // Paginated elements
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginatedList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Form toggles
  const openAddModal = () => {
    setFormData({
      id: '',
      fullName: '',
      email: '',
      phone: '',
      password: '',
      address: '',
      status: 'active',
      nin: '',
      licenseNumber: '',
      licenseExpiry: '',
      classification: 'Assisted',
      agreedAmount: '30000',
      remainingVehicleBalance: '15000000',
      investmentAmount: '5000000',
      investmentDate: new Date().toISOString().split('T')[0],
      bankName: 'Access Bank PLC',
      accountNumber: '',
      privilegeLevel: 'Level 1: Fleet Operations',
      assignedTasks: 'Fleet Dispatch, Voucher Issuance, Real-time Tracking',
      portfolio: 'Executive Director',
      shareholdingEquity: '5.0%'
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (person: any) => {
    setFormData({
      id: person.id || person.user_id || person.user_id_ref || '',
      fullName: person.fullName || person.full_name || '',
      email: person.email || '',
      phone: person.phone || '',
      password: '', // blank during edits
      address: person.address || '',
      status: person.status || 'active',
      nin: person.nin || '',
      licenseNumber: person.license_number || '',
      licenseExpiry: person.license_expiry || '',
      classification: person.classification || 'Assisted',
      agreedAmount: String(person.agreed_amount || '30000'),
      remainingVehicleBalance: String(person.remaining_vehicle_balance || '15000000'),
      investmentAmount: String(person.investment_amount || '5000000'),
      investmentDate: person.investment_date || new Date().toISOString().split('T')[0],
      bankName: person.bank_name || 'Access Bank PLC',
      accountNumber: person.account_number || '',
      privilegeLevel: person.privilege_level || 'Level 1: Fleet Operations',
      assignedTasks: Array.isArray(person.assigned_tasks) ? person.assigned_tasks.join(', ') : person.assigned_tasks || '',
      portfolio: person.portfolio || 'Executive Director',
      shareholdingEquity: person.shareholding_equity || '5.0%'
    });
    setIsEditModalOpen(true);
  };

  // Handle Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isAddModalOpen) {
        // ADD PERSON
        if (activeTab === 'drivers') {
          // Add driver using assisted registration
          await api.request('/api/auth/register-driver', {
            method: 'POST',
            body: JSON.stringify({
              personal: {
                fullName: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                password: formData.password || 'driver123',
                address: formData.address,
                nin: formData.nin,
                licenseNumber: formData.licenseNumber,
                licenseExpiry: formData.licenseExpiry
              },
              guarantor: {
                fullName: 'Alhaji Haruna Musa',
                phone: '+234 803 000 9999',
                address: '14 Airport Road, Zaria',
                relationship: 'Uncle',
                nin: '11223344556'
              },
              vehicle: {
                brand: 'Mercedes-Benz',
                model: 'Actros heavy hauler',
                year: '2021',
                colour: 'White',
                plateNumber: `KANO-${Math.floor(100+Math.random()*900)}-KN`,
                registrationNumber: `REG-${Math.floor(1000+Math.random()*9000)}`,
                chassisNumber: `WDB9340${Math.floor(10000+Math.random()*90000)}`,
                engineNumber: `OM501LA-${Math.floor(10000+Math.random()*90000)}`,
                capacity: '30 Tons'
              }
            })
          });
        } else if (activeTab === 'shareholders') {
          await api.request('/api/shareholders', {
            method: 'POST',
            body: JSON.stringify({
              fullName: formData.fullName,
              email: formData.email,
              phone: formData.phone,
              address: formData.address,
              investmentAmount: parseFloat(formData.investmentAmount),
              investmentDate: formData.investmentDate,
              bankName: formData.bankName,
              accountNumber: formData.accountNumber
            })
          });
        } else if (activeTab === 'admins') {
          await api.request('/api/director/admins', {
            method: 'POST',
            body: JSON.stringify({
              fullName: formData.fullName,
              email: formData.email,
              phone: formData.phone,
              password: formData.password || 'admin123',
              privilegeLevel: formData.privilegeLevel,
              assignedTasks: formData.assignedTasks.split(',').map(s => s.trim())
            })
          });
        } else if (activeTab === 'directors') {
          await api.request('/api/director/directors', {
            method: 'POST',
            body: JSON.stringify({
              fullName: formData.fullName,
              email: formData.email,
              phone: formData.phone,
              password: formData.password || 'director123',
              portfolio: formData.portfolio,
              shareholdingEquity: formData.shareholdingEquity
            })
          });
        }
      } else {
        // EDIT PERSON
        const editId = formData.id;
        if (activeTab === 'drivers') {
          await api.request(`/api/drivers/${editId}`, {
            method: 'PUT',
            body: JSON.stringify({
              fullName: formData.fullName,
              phone: formData.phone,
              address: formData.address,
              nin: formData.nin,
              licenseNumber: formData.licenseNumber,
              licenseExpiry: formData.licenseExpiry,
              agreedAmount: parseFloat(formData.agreedAmount),
              remainingVehicleBalance: parseFloat(formData.remainingVehicleBalance),
              status: formData.status
            })
          });
        } else if (activeTab === 'shareholders') {
          await api.request(`/api/shareholders/${editId}`, {
            method: 'PUT',
            body: JSON.stringify({
              fullName: formData.fullName,
              email: formData.email,
              phone: formData.phone,
              address: formData.address,
              investmentAmount: parseFloat(formData.investmentAmount),
              investmentDate: formData.investmentDate,
              bankName: formData.bankName,
              accountNumber: formData.accountNumber,
              status: formData.status
            })
          });
        } else if (activeTab === 'admins') {
          await api.request(`/api/director/admins/${editId}`, {
            method: 'PUT',
            body: JSON.stringify({
              fullName: formData.fullName,
              phone: formData.phone,
              status: formData.status,
              privilegeLevel: formData.privilegeLevel,
              assignedTasks: formData.assignedTasks.split(',').map(s => s.trim()),
              ...(formData.password ? { password: formData.password } : {})
            })
          });
        } else if (activeTab === 'directors') {
          await api.request(`/api/director/directors/${editId}`, {
            method: 'PUT',
            body: JSON.stringify({
              fullName: formData.fullName,
              phone: formData.phone,
              status: formData.status,
              portfolio: formData.portfolio,
              shareholdingEquity: formData.shareholdingEquity,
              ...(formData.password ? { password: formData.password } : {})
            })
          });
        }
      }

      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      fetchAllData();
      
      // Update selected profile view if open
      if (selectedPerson) {
        setSelectedPerson(null);
      }
    } catch (err: any) {
      alert(err.message || 'Verification Error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Person
  const handleDeletePerson = async (person: any) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const deleteId = person.user_id || person.id;
      if (activeTab === 'drivers') {
        alert(lang === 'en' ? "Please suspend the driver rather than deleting Operational Ledgers." : "Da fatan a dakatarda direba maimakon goge bayanan kudi.");
        return;
      } else if (activeTab === 'shareholders') {
        alert(lang === 'en' ? "Shareholders cannot be deleted. Please suspend status for security audit trail." : "Ba za a iya goge masu hannun jari ba. Da fatan a canza matsayi zuwa 'dakatar'.");
        return;
      } else if (activeTab === 'admins') {
        await api.request(`/api/director/admins/${deleteId}`, { method: 'DELETE' });
      } else if (activeTab === 'directors') {
        await api.request(`/api/director/directors/${deleteId}`, { method: 'DELETE' });
      }
      alert(t.deleteSuccess);
      fetchAllData();
      if (selectedPerson) setSelectedPerson(null);
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    }
  };

  // Status badges colors helper
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'active':
      case 'approved':
      case 'available':
        return <Badge variant="success">{lang === 'en' ? 'Active' : 'Aiki'}</Badge>;
      case 'suspended':
        return <Badge variant="danger">{lang === 'en' ? 'Suspended' : 'An Dakatar'}</Badge>;
      case 'pending':
        return <Badge variant="warning">{lang === 'en' ? 'Pending' : 'Jiran amincewa'}</Badge>;
      case 'rest':
      case 'on rest':
        return <Badge variant="info">{lang === 'en' ? 'On Rest' : 'Hutu'}</Badge>;
      default:
        return <Badge variant="outline">{(status || '').toUpperCase()}</Badge>;
    }
  };

  // Get initial letters for avatar placeholder
  const getInitials = (name: string) => {
    if (!name) return 'RU';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Color map based on index or name for profile background
  const getAvatarBg = (name: string) => {
    const charCode = name.charCodeAt(0) || 0;
    const colors = [
      'bg-brand-navy dark:bg-slate-800 text-brand-gold border-brand-gold',
      'bg-brand-gold text-brand-navy border-brand-navy',
      'bg-emerald-900/40 text-emerald-400 border-emerald-500/30',
      'bg-rose-950/40 text-rose-300 border-rose-500/20'
    ];
    return colors[charCode % colors.length];
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Tab Switchers */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border-main/50 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            onClick={() => handleTabChange('drivers')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap transition-all ${
              activeTab === 'drivers' 
                ? 'bg-brand-navy text-brand-gold shadow-sm scale-102 border-b-2 border-brand-gold' 
                : 'text-text-muted hover:text-text-main hover:bg-bg-base'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>{lang === 'en' ? "Logistic Drivers" : "Direbobi Logistics"}</span>
            <span className="text-[10px] bg-brand-gold/10 px-1.5 py-0.5 rounded font-mono font-bold text-brand-gold">{drivers.length}</span>
          </button>

          <button
            onClick={() => handleTabChange('shareholders')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap transition-all ${
              activeTab === 'shareholders' 
                ? 'bg-brand-navy text-brand-gold shadow-sm scale-102 border-b-2 border-brand-gold' 
                : 'text-text-muted hover:text-text-main hover:bg-bg-base'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>{lang === 'en' ? "Shareholders" : "Masu Hannun Jari"}</span>
            <span className="text-[10px] bg-brand-gold/10 px-1.5 py-0.5 rounded font-mono font-bold text-brand-gold">{shareholders.length}</span>
          </button>

          <button
            onClick={() => handleTabChange('admins')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap transition-all ${
              activeTab === 'admins' 
                ? 'bg-brand-navy text-brand-gold shadow-sm scale-102 border-b-2 border-brand-gold' 
                : 'text-text-muted hover:text-text-main hover:bg-bg-base'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>{lang === 'en' ? "System Admins" : "Masu Gudanarwa"}</span>
            <span className="text-[10px] bg-brand-gold/10 px-1.5 py-0.5 rounded font-mono font-bold text-brand-gold">{admins.length}</span>
          </button>

          <button
            onClick={() => handleTabChange('directors')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap transition-all ${
              activeTab === 'directors' 
                ? 'bg-brand-navy text-brand-gold shadow-sm scale-102 border-b-2 border-brand-gold' 
                : 'text-text-muted hover:text-text-main hover:bg-bg-base'
            }`}
          >
            <User className="h-4 w-4" />
            <span>{lang === 'en' ? "Board Directors" : "Daraktocin Kamfani"}</span>
            <span className="text-[10px] bg-brand-gold/10 px-1.5 py-0.5 rounded font-mono font-bold text-brand-gold">{directors.length}</span>
          </button>
        </div>

        <Button
          onClick={openAddModal}
          className="font-bold flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{t.addPerson}</span>
        </Button>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-bg-base border border-border-main rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-bg-surface text-text-main border border-border-main pl-10 pr-4 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
          />
        </div>

        {/* Filter Selection Grid */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto py-1">
          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="bg-bg-surface text-text-main border border-border-main text-xs px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="all">{t.allStatus}</option>
              <option value="active">{lang === 'en' ? 'Active' : 'Aiki'}</option>
              <option value="suspended">{lang === 'en' ? 'Suspended' : 'An Dakatar'}</option>
              <option value="pending">{lang === 'en' ? 'Pending' : 'Jiran amincewa'}</option>
              {activeTab === 'drivers' && <option value="rest">{lang === 'en' ? 'On Rest' : 'Hutu'}</option>}
            </select>
          </div>

          {/* Sub-Filters */}
          {activeTab === 'drivers' && (
            <select
              value={subFilter}
              onChange={(e) => { setSubFilter(e.target.value); setCurrentPage(1); }}
              className="bg-bg-surface text-text-main border border-border-main text-xs px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="all">{lang === 'en' ? "All Classifications" : "Duk Rukunoni"}</option>
              <option value="smart">Smart</option>
              <option value="assisted">Assisted</option>
            </select>
          )}

          {activeTab === 'admins' && (
            <select
              value={subFilter}
              onChange={(e) => { setSubFilter(e.target.value); setCurrentPage(1); }}
              className="bg-bg-surface text-text-main border border-border-main text-xs px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="all">{lang === 'en' ? "All Clearances" : "Duk Matakan Iko"}</option>
              <option value="level 1">Level 1: Fleet</option>
              <option value="level 2">Level 2: Financials</option>
            </select>
          )}

          {activeTab === 'directors' && (
            <select
              value={subFilter}
              onChange={(e) => { setSubFilter(e.target.value); setCurrentPage(1); }}
              className="bg-bg-surface text-text-main border border-border-main text-xs px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="all">{lang === 'en' ? "All Portfolios" : "Duk Ayyuka"}</option>
              <option value="chairman">Chairman</option>
              <option value="managing">Managing Director</option>
              <option value="executive">Executive Director</option>
            </select>
          )}

          {/* Sort trigger */}
          <button
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 border border-border-main bg-bg-surface text-text-muted hover:text-text-main rounded-lg cursor-pointer"
            title="Reverse sorting order"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 text-red-600 dark:bg-rose-950/20 dark:text-rose-400 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CORE PERSONNEL GRID/LIST VIEW */}
      {loading ? (
        <div className="py-20 text-center font-bold font-mono text-xs text-text-muted">
          {lang === 'en' ? "Synchronizing database nodes with enterprise state..." : "Ana duba kundayen ajiye bayanai na kamfani..."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {paginatedList.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-text-muted font-bold font-mono">
                  {lang === 'en' ? "No personnel logs matched the query." : "Babu wani ma’aikaci da ya dace da binciken ku."}
                </div>
              ) : (
                paginatedList.map((person, idx) => {
                  const companyId = person.company_driver_id || person.company_id || `CORP-${String(idx + 100)}`;
                  const subtitle = activeTab === 'drivers' 
                    ? `Classification: ${person.classification || 'Assisted'}`
                    : activeTab === 'shareholders'
                    ? `Investment: ₦${(person.investment_amount || 0).toLocaleString()}`
                    : activeTab === 'admins'
                    ? person.privilege_level || 'Level 1 clearance'
                    : person.portfolio || 'Executive Director';

                  return (
                    <motion.div
                      key={person.id || person.user_id || idx}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="bg-bg-surface border border-border-main rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-brand-gold/60 transition-all group relative overflow-hidden"
                    >
                      {/* Top Section with Avatar & Quick Details */}
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          {/* Avatar Display */}
                          <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-xs border ${getAvatarBg(person.fullName || person.full_name || '')}`}>
                            {person.passport_photo_url ? (
                              <img 
                                src={person.passport_photo_url} 
                                alt={person.fullName} 
                                className="h-full w-full rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              getInitials(person.fullName || person.full_name || '')
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-text-muted font-mono font-bold block">{companyId}</span>
                            <span className="text-xs font-bold text-text-main block truncate group-hover:text-brand-gold transition-colors">{person.fullName || person.full_name}</span>
                            <span className="text-[9px] text-text-muted block font-mono leading-none mt-0.5">{subtitle}</span>
                          </div>
                        </div>

                        {/* Middle section containing contact hooks */}
                        <div className="border-t border-border-main/40 pt-2.5 flex flex-col gap-1.5 text-[10px] text-text-muted font-mono">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-brand-gold shrink-0" />
                            <span className="truncate">{person.phone || 'No direct phone'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-brand-gold shrink-0" />
                            <span className="truncate">{person.email || 'No email registered'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom actions section */}
                      <div className="border-t border-border-main/40 mt-3 pt-3 flex items-center justify-between gap-1.5">
                        <div>
                          {getStatusBadge(person.status || 'active')}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedPerson(person)}
                            className="p-1.5 bg-bg-base hover:bg-brand-navy/10 hover:text-brand-navy dark:hover:bg-slate-800 rounded text-text-muted transition-colors cursor-pointer"
                            title={t.viewProfile}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(person)}
                            className="p-1.5 bg-bg-base hover:bg-amber-500/10 hover:text-amber-600 rounded text-text-muted transition-colors cursor-pointer"
                            title={t.editProfile}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          {(activeTab === 'admins' || activeTab === 'directors') && (
                            <button
                              onClick={() => handleDeletePerson(person)}
                              className="p-1.5 bg-bg-base hover:bg-red-500/10 hover:text-red-500 rounded text-text-muted transition-colors cursor-pointer"
                              title="Delete permanently"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center border-t border-border-main/40 pt-4 mt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                className="px-3 py-1 cursor-pointer text-xs"
              >
                {lang === 'en' ? "Previous" : "Baya"}
              </Button>
              <span className="text-[11px] text-text-muted font-bold font-mono">
                {lang === 'en' ? `Page ${currentPage} of ${totalPages}` : `Shafi na ${currentPage} cikin ${totalPages}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                className="px-3 py-1 cursor-pointer text-xs"
              >
                {lang === 'en' ? "Next" : "Gaba"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: COMPLETE DETAILED PROFILE DIALOG */}
      <AnimatePresence>
        {selectedPerson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-surface border border-border-main rounded-2xl w-full max-w-2xl p-6 relative shadow-xl overflow-y-auto max-h-[90vh]"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedPerson(null)}
                className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-bg-base transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Profile Overview Header */}
              <div className="flex items-start gap-4 flex-wrap border-b border-border-main/50 pb-5 mb-5">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center font-bold text-lg border-2 ${getAvatarBg(selectedPerson.fullName || selectedPerson.full_name || '')}`}>
                  {selectedPerson.passport_photo_url ? (
                    <img 
                      src={selectedPerson.passport_photo_url} 
                      alt={selectedPerson.fullName} 
                      className="h-full w-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    getInitials(selectedPerson.fullName || selectedPerson.full_name || '')
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-extrabold text-text-main leading-tight">{selectedPerson.fullName || selectedPerson.full_name}</h2>
                    {getStatusBadge(selectedPerson.status || 'active')}
                  </div>
                  <span className="text-xs text-brand-gold font-mono font-bold block mt-0.5">
                    {t.companyId}: {selectedPerson.company_driver_id || selectedPerson.company_id || 'EXECUTIVE_ROLE'}
                  </span>
                  <span className="text-[10px] text-text-muted block mt-1 font-mono">
                    Registered: {new Date(selectedPerson.registrationDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* BENTO GRID DETAILS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Official Passport Photograph */}
                <div className="bg-bg-base border border-border-main/50 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-3 self-start flex items-center gap-1.5 w-full border-b border-border-main/20 pb-2">
                    <Camera className="h-3.5 w-3.5 text-brand-gold" />
                    <span>{lang === 'en' ? "Verified Passport Photo" : "Hoton Fasfo Tabbatacce"}</span>
                  </h3>
                  <div className="relative group overflow-hidden rounded-xl border border-border-main/50 h-32 w-32 bg-bg-surface flex items-center justify-center shadow-md">
                    <img 
                      src={selectedPerson.passport_photo_url || (activeTab === 'drivers' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300' : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300')} 
                      alt="Official Passport" 
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {lang === 'en' ? "SECURE CHIP ACTIVE" : "AMINTACCE KAN TSARI"}
                  </span>
                </div>
                
                {/* Standard Account Details */}
                <div className="bg-bg-base border border-border-main/50 rounded-xl p-4">
                  <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-2.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>{lang === 'en' ? "Identity & Contact Parameters" : "Sadarwa & Bayanan Kai"}</span>
                  </h3>
                  <div className="flex flex-col gap-2 text-xs font-mono">
                    <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                      <span className="text-text-muted">Email:</span>
                      <span className="text-text-main font-bold truncate max-w-[200px]" title={selectedPerson.email}>{selectedPerson.email || 'None'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                      <span className="text-text-muted">Telephone:</span>
                      <span className="text-text-main font-bold">{selectedPerson.phone || 'None'}</span>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span className="text-text-muted">Location Address:</span>
                      <span className="text-text-main font-bold truncate max-w-[180px]" title={selectedPerson.address}>{selectedPerson.address || 'Kano Head Office'}</span>
                    </div>
                  </div>
                </div>

                {/* ROLE-SPECIFIC BENTO BOXES */}
                
                {/* 1. DRIVER DETAILS */}
                {activeTab === 'drivers' && (
                  <div className="bg-bg-base border border-border-main/50 rounded-xl p-4">
                    <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5" />
                      <span>{lang === 'en' ? "Licensing & Classification" : "Lasisin Tuki & Rukunoni"}</span>
                    </h3>
                    <div className="flex flex-col gap-2 text-xs font-mono">
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">License Number:</span>
                        <span className="text-text-main font-bold">{selectedPerson.license_number || 'NGA-DL-11840'}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">License Expiry:</span>
                        <span className="text-text-main font-bold text-red-500">{selectedPerson.license_expiry || '2028-10-10'}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-text-muted">Safety rating:</span>
                        <span className="text-text-main font-bold text-brand-gold">⭐ {selectedPerson.rating || '5.0'} / 5.0</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'drivers' && (
                  <div className="bg-bg-base border border-border-main/50 rounded-xl p-4 col-span-full">
                    <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-3 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>{lang === 'en' ? "Driver Financial Ledger Progress" : "Shafin Kudade & Biyan Kuɗi"}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono mb-3">
                      <div className="bg-bg-surface p-2.5 border border-border-main rounded-lg">
                        <span className="text-[10px] text-text-muted block">INSTALLMENTS REMAINING</span>
                        <span className="text-sm font-extrabold text-brand-gold block mt-1">
                          ₦{(selectedPerson.remaining_vehicle_balance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-bg-surface p-2.5 border border-border-main rounded-lg">
                        <span className="text-[10px] text-text-muted block">TOTAL PAID TODATE</span>
                        <span className="text-sm font-extrabold text-emerald-500 block mt-1">
                          ₦{(selectedPerson.total_amount_paid || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-bg-surface p-2.5 border border-border-main rounded-lg">
                        <span className="text-[10px] text-text-muted block">WEEKLY MINIMUM DUE</span>
                        <span className="text-sm font-extrabold text-text-main block mt-1">
                          ₦{(selectedPerson.agreed_amount || 30000).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* Financial Progress Bar */}
                    <div className="bg-bg-surface p-3 border border-border-main rounded-lg">
                      <div className="flex justify-between items-center text-[10px] font-bold text-text-muted mb-1.5">
                        <span>LEASING COMPLETION PROGRESS</span>
                        <span>
                          {selectedPerson.total_amount_paid && selectedPerson.vehicle_purchase_price
                            ? `${((selectedPerson.total_amount_paid / selectedPerson.vehicle_purchase_price) * 100).toFixed(1)}%`
                            : '0%'}
                        </span>
                      </div>
                      <div className="w-full bg-border-main h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{ 
                            width: selectedPerson.total_amount_paid && selectedPerson.vehicle_purchase_price
                              ? `${Math.min(100, (selectedPerson.total_amount_paid / selectedPerson.vehicle_purchase_price) * 100)}%` 
                              : '0%' 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'drivers' && selectedPerson.guarantor && (
                  <div className="bg-bg-base border border-border-main/50 rounded-xl p-4 col-span-full">
                    <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{lang === 'en' ? "Guarantor Details & Documentation" : "Amintaccen Garanti & Shaida"}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Guarantor Name:</span>
                        <span className="text-text-main font-bold">{selectedPerson.guarantor.full_name}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Telephone:</span>
                        <span className="text-text-main font-bold">{selectedPerson.guarantor.phone}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Relationship:</span>
                        <span className="text-text-main font-bold">{selectedPerson.guarantor.relationship}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">NIN Code:</span>
                        <span className="text-text-main font-bold">{selectedPerson.guarantor.nin || '98765432101'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. SHAREHOLDER DETAILS */}
                {activeTab === 'shareholders' && (
                  <div className="bg-bg-base border border-border-main/50 rounded-xl p-4 col-span-full">
                    <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-3 flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5" />
                      <span>{lang === 'en' ? "Capital Investment & Settlements" : "Zuba Jari & Asusu"}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="bg-bg-surface p-2.5 border border-border-main rounded-lg">
                        <span className="text-[10px] text-text-muted block">CAPITAL CONTRIBUTED</span>
                        <span className="text-sm font-extrabold text-brand-gold block mt-1">
                          ₦{(selectedPerson.investment_amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-bg-surface p-2.5 border border-border-main rounded-lg">
                        <span className="text-[10px] text-text-muted block">ESTIMATED EQUITY</span>
                        <span className="text-sm font-extrabold text-emerald-500 block mt-1">
                          {selectedPerson.investment_amount ? `${((selectedPerson.investment_amount / 225000000) * 100).toFixed(2)}%` : '0%'}
                        </span>
                      </div>
                      <div className="bg-bg-surface p-2.5 border border-border-main rounded-lg">
                        <span className="text-[10px] text-text-muted block">LIFETIME DIVIDENDS</span>
                        <span className="text-sm font-extrabold text-text-main block mt-1">
                          ₦{(selectedPerson.lifetime_dividends || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 bg-bg-surface p-3 border border-border-main rounded-lg text-xs font-mono flex flex-col gap-2">
                      <div className="flex justify-between border-b border-border-main/20 pb-2">
                        <span className="text-text-muted">Settlement Bank Name:</span>
                        <span className="text-text-main font-bold">{selectedPerson.bank_name || 'Access Bank PLC'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Settlement Account:</span>
                        <span className="text-text-main font-bold">{selectedPerson.account_number || '0049102945'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ADMIN DETAILS */}
                {activeTab === 'admins' && (
                  <div className="bg-bg-base border border-border-main/50 rounded-xl p-4 col-span-full">
                    <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{lang === 'en' ? "Operations Authority & Audit" : "Ikon Gudanarwa & Tuba"}</span>
                    </h3>
                    <div className="flex flex-col gap-2.5 text-xs font-mono">
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Clearance Level:</span>
                        <span className="text-text-main font-bold text-brand-gold">{selectedPerson.privilege_level || 'Level 1: Fleet Operations'}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Audit logs count:</span>
                        <span className="text-text-main font-bold">{selectedPerson.actions_audited || 0} modifications</span>
                      </div>
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Last System Action:</span>
                        <span className="text-text-main font-bold text-[10px]">{selectedPerson.last_active ? new Date(selectedPerson.last_active).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-text-muted block mb-1">Assigned Operational Duties:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(Array.isArray(selectedPerson.assigned_tasks) ? selectedPerson.assigned_tasks : String(selectedPerson.assigned_tasks || 'Fleet Dispatch').split(',')).map((task: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-800 text-brand-gold text-[9px] font-bold rounded-full border border-slate-700">
                              {task.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. DIRECTOR DETAILS */}
                {activeTab === 'directors' && (
                  <div className="bg-bg-base border border-border-main/50 rounded-xl p-4 col-span-full">
                    <h3 className="text-xs font-bold uppercase text-brand-gold tracking-wider mb-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{lang === 'en' ? "Board Portfolio & Sovereign Shareholding" : "Bayanan Darakta & Hannun Jari"}</span>
                    </h3>
                    <div className="flex flex-col gap-2 text-xs font-mono">
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Board Portfolio Designation:</span>
                        <span className="text-text-main font-bold text-brand-gold">{selectedPerson.portfolio || 'Executive Board Director'}</span>
                      </div>
                      <div className="flex justify-between border-b border-border-main/20 pb-1.5">
                        <span className="text-text-muted">Direct Equity Ratio:</span>
                        <span className="text-text-main font-bold">{selectedPerson.shareholding_equity || '10.0%'} ownership</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-text-muted">Sovereign Signature Logs:</span>
                        <span className="text-text-main font-bold">{selectedPerson.approved_signatures || 0} executive signatures logged</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Modify Profile Action */}
              <div className="mt-6 pt-4 border-t border-border-main flex justify-end gap-2">
                <Button 
                  onClick={() => setSelectedPerson(null)}
                  variant="outline"
                  className="px-4 py-2 cursor-pointer text-xs"
                >
                  Close
                </Button>
                <Button 
                  onClick={() => openEditModal(selectedPerson)}
                  className="px-4 py-2 cursor-pointer text-xs"
                >
                  {t.editProfile}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ADD / EDIT DIALOG FORM */}
      <AnimatePresence>
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-surface border border-border-main rounded-2xl w-full max-w-lg p-6 relative shadow-xl overflow-y-auto max-h-[90vh]"
            >
              {/* Close Button */}
              <button 
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-bg-base transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="text-base font-extrabold text-brand-gold mb-4 uppercase tracking-wider flex items-center gap-1.5">
                <Edit className="h-4 w-4" />
                <span>
                  {isAddModalOpen 
                    ? `${lang === 'en' ? 'Register New' : 'Rijistar Sabon'} ${activeTab.toUpperCase()}`
                    : `${lang === 'en' ? 'Modify Profile' : 'Gyara Bayanan'} ${activeTab.toUpperCase()}`
                  }
                </span>
              </h2>

              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 text-xs font-semibold">
                
                {/* Standard Account Inputs */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-muted">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                    placeholder="e.g. Alhaji Ibrahim Bello"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-text-muted">Email Address</label>
                    <input
                      type="email"
                      required={activeTab !== 'drivers'} // optional for drivers
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                      placeholder="e.g. name@ruqayyatransport.com"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-text-muted">Telephone Number</label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                      placeholder="e.g. +234 803 000 0000"
                    />
                  </div>
                </div>

                {isAddModalOpen && (activeTab === 'admins' || activeTab === 'directors') && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-text-muted">Initial Security Password</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                      placeholder="Enter strong login key"
                    />
                  </div>
                )}

                {/* Edit status support */}
                {isEditModalOpen && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-text-muted">{t.statusLabel}</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none cursor-pointer"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      {activeTab === 'drivers' && <option value="pending">Pending Review</option>}
                      {activeTab === 'drivers' && <option value="rest">On Rest</option>}
                    </select>
                  </div>
                )}

                {/* ROLE SPECIFIC FIELD OVERLAYS */}

                {/* 1. Drivers Options */}
                {activeTab === 'drivers' && (
                  <div className="flex flex-col gap-3 border-t border-border-main/30 pt-3 mt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">National NIN (11 Digits)</label>
                        <input
                          type="text"
                          required
                          maxLength={11}
                          value={formData.nin}
                          onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Driver Classification</label>
                        <select
                          value={formData.classification}
                          onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none cursor-pointer"
                        >
                          <option value="Assisted">Assisted (Remittance Sharing)</option>
                          <option value="Smart">Smart (Fixed Leasing)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">FRSC DL Number</label>
                        <input
                          type="text"
                          required
                          value={formData.licenseNumber}
                          onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">License Expiry Date</label>
                        <input
                          type="date"
                          required
                          value={formData.licenseExpiry}
                          onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Weekly Installment Agreement</label>
                        <input
                          type="number"
                          required
                          value={formData.agreedAmount}
                          onChange={(e) => setFormData({ ...formData, agreedAmount: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Remaining Vehicle Balance</label>
                        <input
                          type="number"
                          required
                          value={formData.remainingVehicleBalance}
                          onChange={(e) => setFormData({ ...formData, remainingVehicleBalance: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-text-muted">Home Location Address</label>
                      <input
                        type="text"
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Shareholders Options */}
                {activeTab === 'shareholders' && (
                  <div className="flex flex-col gap-3 border-t border-border-main/30 pt-3 mt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Investment Principal (₦)</label>
                        <input
                          type="number"
                          required
                          value={formData.investmentAmount}
                          onChange={(e) => setFormData({ ...formData, investmentAmount: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Investment Logging Date</label>
                        <input
                          type="date"
                          required
                          value={formData.investmentDate}
                          onChange={(e) => setFormData({ ...formData, investmentDate: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Settlement Bank Name</label>
                        <input
                          type="text"
                          required
                          value={formData.bankName}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Bank Account Number</label>
                        <input
                          type="text"
                          required
                          maxLength={10}
                          value={formData.accountNumber}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                          placeholder="e.g. 0110329482"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-text-muted">Home/Corporate Location Address</label>
                      <input
                        type="text"
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 3. Admins Options */}
                {activeTab === 'admins' && (
                  <div className="flex flex-col gap-3 border-t border-border-main/30 pt-3 mt-1">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-text-muted">Administrative Clearance Clearance</label>
                      <select
                        value={formData.privilegeLevel}
                        onChange={(e) => setFormData({ ...formData, privilegeLevel: e.target.value })}
                        className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none cursor-pointer"
                      >
                        <option value="Level 1: Fleet Operations">Level 1: Fleet Operations (Dispatches & Vouchers)</option>
                        <option value="Level 2: Financials">Level 2: Financials (Ledgers & Audits)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-text-muted">Assigned Tasks (Comma-separated list)</label>
                      <input
                        type="text"
                        required
                        value={formData.assignedTasks}
                        onChange={(e) => setFormData({ ...formData, assignedTasks: e.target.value })}
                        className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                        placeholder="e.g. Fleet Dispatch, Voucher Issuance, Real-time Tracking"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Directors Options */}
                {activeTab === 'directors' && (
                  <div className="flex flex-col gap-3 border-t border-border-main/30 pt-3 mt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Board Designation portfolio</label>
                        <input
                          type="text"
                          required
                          value={formData.portfolio}
                          onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                          placeholder="e.g. Managing Director, Executive Director"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-text-muted">Corporate Equity % (if any)</label>
                        <input
                          type="text"
                          required
                          value={formData.shareholdingEquity}
                          onChange={(e) => setFormData({ ...formData, shareholdingEquity: e.target.value })}
                          className="w-full bg-bg-base text-text-main border border-border-main px-3 py-2 rounded-lg focus:outline-none"
                          placeholder="e.g. 10.0%"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit actions */}
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border-main">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    {submitting 
                      ? (lang === 'en' ? "Encrypting node..." : "Ana ajiye bayanai...") 
                      : t.saveChange
                    }
                  </Button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
