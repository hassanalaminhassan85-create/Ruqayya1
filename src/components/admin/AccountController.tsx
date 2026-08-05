/**
 * AccountController.tsx
 * Admin management portal for managing driver, shareholder, admin, and director login credentials,
 * usernames, passwords, and access security.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  ShieldCheck, 
  KeyRound, 
  Search, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  Edit3, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Filter, 
  Truck, 
  TrendingUp, 
  ShieldAlert,
  UserPlus,
  X
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { api } from '../../utils/api';

interface AccountUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  fullName: string;
  role: string;
  roleId: string;
  status: 'active' | 'suspended' | 'pending';
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AccountControllerProps {
  lang: 'en' | 'ha';
}

export const AccountController: React.FC<AccountControllerProps> = ({ lang }) => {
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [editingUser, setEditingUser] = useState<AccountUser | null>(null);
  const [modalUsername, setModalUsername] = useState<string>('');
  const [modalEmail, setModalEmail] = useState<string>('');
  const [modalPhone, setModalPhone] = useState<string>('');
  const [modalFullName, setModalFullName] = useState<string>('');
  const [modalNewPassword, setModalNewPassword] = useState<string>('');
  const [modalStatus, setModalStatus] = useState<'active' | 'suspended'>('active');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Quick Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<AccountUser | null>(null);
  const [generatedPass, setGeneratedPass] = useState<string>('');

  const fetchAccounts = async () => {
    setLoading(true);
    setActionFeedback(null);
    try {
      const res = await api.request('/api/admin/accounts');
      if (res && res.accounts) {
        setAccounts(res.accounts);
      } else if (Array.isArray(res)) {
        setAccounts(res);
      }
    } catch (err: any) {
      console.error('Failed to load accounts list', err);
      // Fallback from local state if available
      const lastState = (window as any).lastSSEState || {};
      if (lastState.users && Array.isArray(lastState.users)) {
        const mapped = lastState.users.map((u: any) => ({
          id: u.id,
          username: u.username || '',
          email: u.email || '',
          phone: u.phone || '',
          fullName: u.full_name || u.fullName || 'User',
          role: u.role || (u.role_id === 'role-driver' ? 'driver' : u.role_id === 'role-admin' ? 'admin' : u.role_id === 'role-director' ? 'director' : 'shareholder'),
          roleId: u.role_id || 'role-driver',
          status: u.status || 'active',
          companyId: u.company_id || u.companyId || ''
        }));
        setAccounts(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenEditModal = (user: AccountUser) => {
    setEditingUser(user);
    setModalUsername(user.username || '');
    setModalEmail(user.email || '');
    setModalPhone(user.phone || '');
    setModalFullName(user.fullName || '');
    setModalNewPassword('');
    setModalStatus(user.status === 'suspended' ? 'suspended' : 'active');
    setShowPassword(false);
    setActionFeedback(null);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setModalNewPassword(pass);
    setShowPassword(true);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaving(true);
    setActionFeedback(null);

    try {
      const payload: any = {
        username: modalUsername.trim(),
        email: modalEmail.trim(),
        phone: modalPhone.trim(),
        fullName: modalFullName.trim(),
        full_name: modalFullName.trim(),
        status: modalStatus
      };

      if (modalNewPassword.trim().length > 0) {
        payload.newPassword = modalNewPassword.trim();
        payload.password = modalNewPassword.trim();
      }

      const res = await api.request(`/api/admin/users/${editingUser.id}/credentials`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        setActionFeedback({
          type: 'success',
          message: lang === 'en' 
            ? `Credentials for ${modalFullName || editingUser.username || editingUser.email} updated successfully! New login details are active.` 
            : `An sabunta shaidar shiga gidan yanar gizo cikin nasara!`
        });

        // Update local state list immediately
        setAccounts(prev => prev.map(a => a.id === editingUser.id ? {
          ...a,
          username: modalUsername.trim(),
          email: modalEmail.trim(),
          phone: modalPhone.trim(),
          fullName: modalFullName.trim(),
          status: modalStatus
        } : a));

        setTimeout(() => {
          setEditingUser(null);
        }, 1200);
      } else {
        setActionFeedback({
          type: 'error',
          message: res?.error || 'Failed to update credentials.'
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to update credentials. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (user: AccountUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const confirmMsg = lang === 'en'
      ? `Are you sure you want to ${newStatus === 'suspended' ? 'SUSPEND' : 'ACTIVATE'} ${user.fullName || user.username}?`
      : `Shin kun tabbata kuna son sauya matsayin ${user.fullName || user.username}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.request(`/api/admin/users/${user.id}/credentials`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });

      if (res && res.success) {
        setAccounts(prev => prev.map(a => a.id === user.id ? { ...a, status: newStatus } : a));
      }
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter(acc => {
    // Role filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'admin' && acc.role !== 'admin' && acc.role !== 'director') return false;
      if (roleFilter === 'driver' && acc.role !== 'driver') return false;
      if (roleFilter === 'shareholder' && acc.role !== 'shareholder') return false;
    }

    // Status filter
    if (statusFilter !== 'all' && acc.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = acc.fullName?.toLowerCase().includes(q);
      const matchUsername = acc.username?.toLowerCase().includes(q);
      const matchEmail = acc.email?.toLowerCase().includes(q);
      const matchPhone = acc.phone?.toLowerCase().includes(q);
      const matchCompanyId = acc.companyId?.toLowerCase().includes(q);
      return matchName || matchUsername || matchEmail || matchPhone || matchCompanyId;
    }

    return true;
  });

  const countAdmins = accounts.filter(a => a.role === 'admin' || a.role === 'director').length;
  const countDrivers = accounts.filter(a => a.role === 'driver').length;
  const countShareholders = accounts.filter(a => a.role === 'shareholder').length;

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-surface border border-border-main p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-xl text-brand-gold shrink-0">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-text-main tracking-wide uppercase">
                {lang === 'en' ? 'Account Controller & Access Management' : 'Ikon Akantocin Base & Masu Shiga'}
              </h2>
              <Badge variant="outline" className="border-brand-gold/40 text-brand-gold text-[10px] font-bold">
                Live Credential Control
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {lang === 'en'
                ? 'Manage and edit usernames, login passwords, and access privileges for Drivers, Shareholders, and Admin Operators.'
                : 'Sarrafa sunayen shiga (usernames), kalmar sirri (passwords), da matsayin shiga tsarin kamfani.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAccounts}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {lang === 'en' ? 'Sync Accounts' : 'Sabunta Akantoci'}
          </Button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-surface border border-border-main p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Total Accounts</p>
            <h3 className="text-2xl font-black text-text-main font-mono mt-1">{accounts.length}</h3>
          </div>
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-lg">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-bg-surface border border-border-main p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Admin & Director</p>
            <h3 className="text-2xl font-black text-brand-gold font-mono mt-1">{countAdmins}</h3>
          </div>
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-lg">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-bg-surface border border-border-main p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Certified Drivers</p>
            <h3 className="text-2xl font-black text-emerald-500 font-mono mt-1">{countDrivers}</h3>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Truck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-bg-surface border border-border-main p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Shareholders</p>
            <h3 className="text-2xl font-black text-purple-500 font-mono mt-1">{countShareholders}</h3>
          </div>
          <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-lg">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-bg-surface border border-border-main p-3.5 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder={lang === 'en' ? 'Search by username, full name, email, phone...' : 'Nemo ta hanyar username, suna, email...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-base border border-border-main rounded-lg text-xs text-text-main focus:outline-none focus:border-brand-gold"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter Pills */}
          <div className="flex items-center bg-bg-base p-1 border border-border-main rounded-lg text-xs font-bold">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1 rounded-md transition-all ${roleFilter === 'all' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main'}`}
            >
              All Roles
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1 rounded-md transition-all ${roleFilter === 'admin' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main'}`}
            >
              Admins
            </button>
            <button
              onClick={() => setRoleFilter('driver')}
              className={`px-3 py-1 rounded-md transition-all ${roleFilter === 'driver' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main'}`}
            >
              Drivers
            </button>
            <button
              onClick={() => setRoleFilter('shareholder')}
              className={`px-3 py-1 rounded-md transition-all ${roleFilter === 'shareholder' ? 'bg-brand-gold text-slate-950 shadow-xs' : 'text-text-muted hover:text-text-main'}`}
            >
              Shareholders
            </button>
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-bg-base border border-border-main rounded-lg text-xs font-bold text-text-main focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="suspended">Suspended Accounts</option>
          </select>
        </div>
      </div>

      {/* ACCOUNTS DATA TABLE */}
      <div className="bg-bg-surface border border-border-main rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bg-base/60 border-b border-border-main text-[11px] text-text-muted font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Account Holder</th>
                <th className="py-3 px-4">Role / Access</th>
                <th className="py-3 px-4">Login Username</th>
                <th className="py-3 px-4">Email / Phone</th>
                <th className="py-3 px-4">System ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/50 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-brand-gold" />
                      <p className="text-xs font-bold">Loading Account Credentials...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">
                    <p className="text-xs font-bold">No accounts found matching search criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isAdminOrDirector = acc.role === 'admin' || acc.role === 'director';
                  const isDriver = acc.role === 'driver';
                  const isShareholder = acc.role === 'shareholder';

                  return (
                    <tr key={acc.id} className="hover:bg-bg-base/40 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs font-mono uppercase shrink-0 ${
                            isAdminOrDirector 
                              ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                              : isDriver 
                                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' 
                                : 'bg-purple-500/20 text-purple-500 border border-purple-500/30'
                          }`}>
                            {acc.fullName ? acc.fullName.substring(0, 2) : (acc.username || 'U').substring(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-text-main text-xs">{acc.fullName || 'Enterprise Account'}</p>
                            <p className="text-[10px] text-text-muted font-mono">{acc.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase font-bold ${
                          isAdminOrDirector
                            ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                            : isDriver
                              ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                              : 'border-purple-500/40 text-purple-500 bg-purple-500/10'
                        }`}>
                          {acc.role || 'user'}
                        </Badge>
                      </td>

                      {/* Login Username */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-amber-400">
                        {acc.username ? (
                          <div className="flex items-center gap-1.5">
                            <span className="bg-bg-base px-2 py-0.5 rounded border border-border-main text-xs">
                              {acc.username}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted text-[11px] italic">No username set</span>
                        )}
                      </td>

                      {/* Email / Phone */}
                      <td className="py-3.5 px-4 text-xs">
                        <p className="text-text-main font-mono text-[11px]">{acc.email || 'No email registered'}</p>
                        <p className="text-text-muted text-[10px] font-mono">{acc.phone || 'No phone'}</p>
                      </td>

                      {/* System ID */}
                      <td className="py-3.5 px-4 font-mono text-xs text-text-muted">
                        {acc.companyId || 'N/A'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge 
                          variant={acc.status === 'active' ? 'success' : acc.status === 'suspended' ? 'danger' : 'outline'}
                          className="font-mono text-[10px] font-bold uppercase"
                        >
                          {acc.status || 'active'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenEditModal(acc)}
                            className="flex items-center gap-1 text-[11px] py-1 px-2.5"
                          >
                            <KeyRound className="h-3 w-3" />
                            {lang === 'en' ? 'Edit Credentials' : 'Gyara Shaidar Shiga'}
                          </Button>

                          <Button
                            variant={acc.status === 'active' ? 'danger' : 'outline'}
                            size="sm"
                            onClick={() => handleToggleUserStatus(acc)}
                            title={acc.status === 'active' ? 'Suspend Access' : 'Activate Access'}
                            className="py-1 px-2 text-[11px]"
                          >
                            {acc.status === 'active' ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT CREDENTIALS MODAL */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-surface border border-border-main w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between p-4 md:p-5 border-b border-border-main bg-bg-base/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-gold/10 text-brand-gold rounded-xl border border-brand-gold/20">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-text-main uppercase tracking-wider">
                      Edit Account Credentials
                    </h3>
                    <p className="text-xs text-text-muted">
                      {editingUser.fullName} ({editingUser.role.toUpperCase()})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingUser(null)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-base transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* MODAL FORM */}
              <form onSubmit={handleSaveCredentials} className="p-4 md:p-6 space-y-4">
                {actionFeedback && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    actionFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  }`}>
                    {actionFeedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    <span>{actionFeedback.message}</span>
                  </div>
                )}

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-[11px] flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Changing credentials will update login access immediately in the system database. If password or username is changed, active sessions will be invalidated.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-text-main mb-1">Account Full Name</label>
                    <input
                      type="text"
                      value={modalFullName}
                      onChange={(e) => setModalFullName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-bg-base border border-border-main rounded-xl text-xs text-text-main focus:outline-none focus:border-brand-gold"
                    />
                  </div>

                  {/* Username Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-text-main">Login Username</label>
                      <span className="text-[10px] text-text-muted">Used for login authentication</span>
                    </div>
                    <input
                      type="text"
                      value={modalUsername}
                      onChange={(e) => setModalUsername(e.target.value)}
                      placeholder="e.g. ADAM, ABAKAKA, drv_ibrahim"
                      className="w-full px-3 py-2 bg-bg-base border border-border-main rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-amber-400 focus:outline-none focus:border-brand-gold"
                    />
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-text-main mb-1">Registered Email</label>
                      <input
                        type="email"
                        value={modalEmail}
                        onChange={(e) => setModalEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-bg-base border border-border-main rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-brand-gold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-main mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={modalPhone}
                        onChange={(e) => setModalPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-bg-base border border-border-main rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                  </div>

                  {/* New Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-text-main">Set New Login Password</label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[10px] font-bold text-brand-gold hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        Generate Password
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={modalNewPassword}
                        onChange={(e) => setModalNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className="w-full pl-3 pr-10 py-2 bg-bg-base border border-border-main rounded-xl text-xs font-mono text-text-main focus:outline-none focus:border-brand-gold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Account Status */}
                  <div>
                    <label className="block text-xs font-bold text-text-main mb-1">Account Access Status</label>
                    <select
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-bg-base border border-border-main rounded-xl text-xs font-bold text-text-main focus:outline-none"
                    >
                      <option value="active">Active (Full Access)</option>
                      <option value="suspended">Suspended (Blocked Access)</option>
                    </select>
                  </div>
                </div>

                {/* MODAL ACTIONS */}
                <div className="pt-3 border-t border-border-main flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={saving}
                    className="flex items-center gap-1.5"
                  >
                    {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {saving ? 'Saving...' : 'Update Credentials'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
