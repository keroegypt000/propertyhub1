'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { buildingIncomeStats, totalIncomeStats, contractBalance, fmtKWD } from '@/lib/calc';
import { SOURCE_LABELS } from '@/lib/accounting';
import {
  VoucherDialog, printHtmlDoc,
  paymentReceiptHtml, loanReceiptHtml, loanPaymentVoucherHtml,
  maintenanceVoucherHtml, transactionVoucherHtml,
  journalEntryDocHtml, journalBookDocHtml, trialBalanceDocHtml, TBRow,
} from '@/components/print-docs';
import {
  Building2, Home, Users, FileText, DollarSign, Wrench, Shield, Clock,
  Upload, Download, Trash2, Edit3, Plus, Search, Eye, Lock, LogOut,
  ChevronDown, ChevronLeft, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Calendar, Phone, Mail, MapPin, Hash, Briefcase, Settings,
  Archive, Activity, UserPlus, Key, ToggleLeft, ToggleRight, Info,
  LayoutDashboard, FolderOpen, Camera, FileImage, CloudUpload, Printer, Scale,
  Menu, X, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

// Types
interface User { id: string; username: string; name: string; role: string; roleName: string; permissions?: string; }
interface Building { id: string; code?: string; name: string; address?: string; city?: string; floors?: number; unitsCount?: number; value?: number; license?: string; notes?: string; units?: Unit[]; transactions?: any[]; createdAt: string; }
interface Unit { id: string; buildingId: string; number: string; floor?: number; area?: number; type?: string; status: string; rentAmount?: number; notes?: string; building?: Building; createdAt: string; }
interface Tenant { id: string; name: string; phone?: string; email?: string; idNumber?: string; idType?: string; address?: string; notes?: string; uploads?: FileUpload[]; createdAt: string; }
interface Contract { id: string; unitId: string; tenantId: string; startDate: string; endDate: string; rentAmount: number; deposit?: number; paymentDay?: number; status: string; terms?: string; notes?: string; unit?: Unit; tenant?: Tenant; payments?: Payment[]; attachments?: FileUpload[]; createdAt: string; }
interface Payment { id: string; contractId: string; amount: number; dueDate: string; paidDate?: string; month?: string; status: string; method?: string; reference?: string; notes?: string; contract?: Contract; createdAt: string; }
interface MaintenanceItem { id: string; title: string; description?: string; priority: string; status: string; cost?: number; estimatedCost?: number; category?: string; assignedTo?: string; unitId?: string; unit?: Unit; attachments?: FileUpload[]; createdAt: string; }
interface FileUpload { id: string; filename: string; originalName: string; mimeType: string; size: number; category: string; contractId?: string; tenantId?: string; maintenanceId?: string; createdAt: string; }
interface AuditEntry { id: string; userId: string; action: string; entity: string; entityId?: string; changes?: string; details?: string; createdAt: string; user?: { id: string; name: string; username: string }; }
interface RestorePoint { id: string; name: string; description?: string; createdBy: string; createdAt: string; creator?: { id: string; name: string; username: string }; }

const CURRENCY = 'د.ك'; // Kuwaiti Dinar

type Section = 'dashboard' | 'buildings' | 'units' | 'tenants' | 'contracts' | 'payments' | 'maintenance' | 'files' | 'transactions' | 'loans' | 'loanPayments' | 'accounts' | 'journal' | 'trialBalance' | 'audit' | 'restore' | 'health' | 'users' | 'settings';

const ROLES_MAP: Record<string, string> = { admin: 'مدير', manager: 'مدير فرعي', accountant: 'محاسب', collector: 'محصّل', viewer: 'مشاهد' };
const UNIT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  available: { label: 'متاحة', color: 'bg-emerald-100 text-emerald-800' },
  rented: { label: 'مؤجرة', color: 'bg-blue-100 text-blue-800' },
  maintenance: { label: 'صيانة', color: 'bg-amber-100 text-amber-800' },
  reserved: { label: 'محجوزة', color: 'bg-purple-100 text-purple-800' },
};
const CONTRACT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'نشط', color: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'منتهي', color: 'bg-red-100 text-red-800' },
  terminated: { label: 'ملغي', color: 'bg-gray-100 text-gray-800' },
  renewed: { label: 'مجدد', color: 'bg-blue-100 text-blue-800' },
};
const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'معلق', color: 'bg-amber-100 text-amber-800' },
  paid: { label: 'مدفوع', color: 'bg-emerald-100 text-emerald-800' },
  partial: { label: 'جزئي', color: 'bg-blue-100 text-blue-800' },
  overdue: { label: 'متأخر', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'ملغي', color: 'bg-gray-100 text-gray-800' },
};
const MAINT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'مفتوح', color: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'ملغي', color: 'bg-gray-100 text-gray-800' },
};
const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفض', color: 'bg-gray-100 text-gray-800' },
  medium: { label: 'متوسط', color: 'bg-amber-100 text-amber-800' },
  high: { label: 'عالي', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: 'عاجل', color: 'bg-red-100 text-red-800' },
};

// Token management
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sid');
}
function setStoredToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('sid', token);
}
function clearStoredToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('sid');
}

async function api<T = any>(url: string, method = 'GET', body?: any): Promise<T> {
  const headers: Record<string, string> = {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('unauthorized');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'خطأ في الخادم');
  return data as T;
}

export default function PropertyManagerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loginTimeRef = useRef(0); // Guard against race condition in checkAuth
  const [section, setSection] = useState<Section>('dashboard');
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allFiles, setAllFiles] = useState<FileUpload[]>([]);
  const [contractFilter, setContractFilter] = useState('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const go = (s: Section) => { setSection(s); setMobileNavOpen(false); };

  const checkAuth = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) { setUser(null); setLoading(false); return; }
      const u = await api<User>('/api/auth/me');
      setUser(u);
    } catch {
      // Only clear session if no recent login (prevents race condition)
      if (Date.now() - loginTimeRef.current > 3000) {
        setUser(null); clearStoredToken();
      }
    } finally { setLoading(false); }
  }, []);

  const checkSetup = useCallback(async () => {
    try { const data = await api<{ needed: boolean }>('/api/setup-needed'); setSetupNeeded(data.needed); } catch {}
  }, []);

  useEffect(() => { checkSetup(); checkAuth(); }, [checkAuth, checkSetup]);

  const loadData = useCallback(async (s: Section) => {
    try {
      if (s === 'buildings') setBuildings(await api<Building[]>('/api/buildings'));
      if (s === 'units') setUnits(await api<Unit[]>('/api/units'));
      if (s === 'tenants') { const data = await api<Tenant[]>('/api/tenants'); setTenants(data); }
      if (s === 'contracts') setContracts(await api<Contract[]>('/api/contracts'));
      if (s === 'payments') setPayments(await api<Payment[]>('/api/payments'));
      if (s === 'maintenance') setMaintenance(await api<MaintenanceItem[]>('/api/maintenance'));
      if (s === 'files') { setAllFiles(await api<FileUpload[]>('/api/files/all')); setContracts(await api<Contract[]>('/api/contracts')); setTenants(await api<Tenant[]>('/api/tenants')); }
      if (s === 'audit') { const data = await api<{ logs: AuditEntry[] }>('/api/audit?limit=100'); setAuditLogs(data.logs || []); }
      if (s === 'restore') setRestorePoints(await api<RestorePoint[]>('/api/restore'));
      if (s === 'users') setAllUsers(await api('/api/users'));
      if (s === 'transactions') setTransactions(await api('/api/transactions'));
      if (s === 'loans') { setLoans(await api('/api/loans')); setLoanPayments(await api('/api/loan-payments')); }
      if (s === 'accounts') setAccounts(await api('/api/accounts'));
      if (s === 'journal') {
        setJournalEntries(await api('/api/journal'));
        setAccounts(await api('/api/accounts'));
        setBuildings(await api('/api/buildings'));
      }
      if (s === 'trialBalance') {
        setJournalEntries(await api('/api/journal'));
        setAccounts(await api('/api/accounts'));
      }
      if (s === 'dashboard') {
        // Use allSettled so one failing API doesn't break everything
        const results = await Promise.allSettled([
          api<Building[]>('/api/buildings'), api<Unit[]>('/api/units'), api<Tenant[]>('/api/tenants'),
          api<Contract[]>('/api/contracts'), api<Payment[]>('/api/payments'), api<MaintenanceItem[]>('/api/maintenance'),
          api('/api/transactions'), api('/api/accounts'), api('/api/loans'), api('/api/loan-payments'),
        ]);
        const [b, u, t, c, p, m, tr, ac, lo, lp] = results.map((r, i) => {
          if (r.status === 'fulfilled') return r.value;
          console.warn(`Dashboard API ${i} failed:`, r.reason);
          return [];
        });
        setBuildings(b); setUnits(u); setTenants(t); setContracts(c); setPayments(p); setMaintenance(m); setTransactions(tr); setAccounts(ac); setLoans(lo); setLoanPayments(lp);
      }
    } catch (e: any) {
      // Re-check auth before logging out - don't immediately logout on data errors
      if (e.message === 'unauthorized') {
        try { await api<User>('/api/auth/me'); } catch { clearStoredToken(); setUser(null); return; }
        toast.error('خطأ في تحميل البيانات');
        return;
      }
      toast.error(e.message);
    }
  }, []);

  useEffect(() => { if (user) loadData(section); }, [user, section, loadData]);
  useEffect(() => { setSearchQuery(''); }, [section]);

  const handleLogout = async () => { await api('/api/auth/logout', 'POST'); clearStoredToken(); setUser(null); };

  // Auto create restore point after every data mutation
  const autoRestore = useCallback(async (actionDesc: string) => {
    try { await api('/api/restore', 'POST', { name: `تلقائي - ${actionDesc}`, description: actionDesc }); } catch (e) { /* silently ignore if not admin */ }
  }, []);

  // ضغط الصور في المتصفح قبل الرفع (لتجاوز حد 4.5MB في السيرفر وتسريع الرفع)
  const compressImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    if (file.size < 400 * 1024) return file; // الصور الصغيرة ترفع كما هي
    try {
      const img = await createImageBitmap(file);
      const maxDim = 1920;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob || blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg' });
    } catch { return file; }
  };

  // Upload file helper
  const uploadFile = useCallback(async (file: File, category: string, meta?: { contractId?: string; tenantId?: string; maintenanceId?: string }) => {
    const processed = await compressImage(file);
    if (processed.size > 4 * 1024 * 1024) throw new Error('حجم الملف كبير جداً — الحد الأقصى 4MB. الصور تُضغط تلقائياً، والمستندات الكبيرة قلّل حجمها أولاً');
    const buf = await processed.arrayBuffer();
    const headers: Record<string, string> = { 'X-Filename': encodeURIComponent(processed.name), 'X-Category': category };
    if (meta?.contractId) headers['X-Contract-Id'] = meta.contractId;
    if (meta?.tenantId) headers['X-Tenant-Id'] = meta.tenantId;
    if (meta?.maintenanceId) headers['X-Maintenance-Id'] = meta.maintenanceId;
    const st = getStoredToken(); if (st) headers['Authorization'] = `Bearer ${st}`;
    const res = await fetch('/api/files/upload', { method: 'POST', headers, body: buf, credentials: 'include' });
    if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error || 'فشل رفع الملف'); }
    return await res.json();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg text-orange-800 font-semibold">جاري التحميل...</p>
      </div>
    </div>
  );

  if (!user && !setupNeeded) return <LoginScreen onLogin={() => { loginTimeRef.current = Date.now(); checkAuth(); }} />;
  if (!user && setupNeeded) return <SetupScreen onSetup={() => { loginTimeRef.current = Date.now(); setSetupNeeded(false); checkAuth(); }} />;
  if (!user) return <LoginScreen onLogin={() => { loginTimeRef.current = Date.now(); checkAuth(); }} />;

  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const totalRent = contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.rentAmount || 0), 0);
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'overdue').length;
  const openMaintenance = maintenance.filter(m => m.status === 'open' || m.status === 'in_progress').length;
  const canWriteCheck = (entity: string) => {
    if (user.role === 'admin' || user.role === 'manager') return true;
    // Check granular permissions first
    if (user.permissions) {
      try {
        const perms = JSON.parse(user.permissions);
        if (perms[entity] === false) return false;
        if (perms[entity] === true) return true;
      } catch {}
    }
    if (user.role === 'accountant') return !['users', 'restore'].includes(entity);
    if (user.role === 'collector') return ['payments', 'maintenance', 'files'].includes(entity);
    return false;
  };
  const isAdmin = user.role === 'admin' || user.role === 'manager';

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 lg:flex">
      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-orange-200 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => setMobileNavOpen(true)} aria-label="فتح القائمة" className="p-2 -mr-2 rounded-xl text-orange-700 hover:bg-orange-100 active:scale-95 transition">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow">
              <Building2 size={16} className="text-white" />
            </div>
            <div className="leading-tight"><span className="font-bold text-orange-900 block">PropertyHub</span><span className="text-[10px] text-orange-600">نظام إدارة العقارات</span></div>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white flex items-center justify-center font-bold text-sm shadow">{user.name.charAt(0)}</div>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      <div className={`lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileNavOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileNavOpen(false)} />

      {/* Mobile drawer sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileNavOpen ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden={!mobileNavOpen}>
        <button onClick={() => setMobileNavOpen(false)} aria-label="إغلاق القائمة" className="absolute top-4 left-4 p-1.5 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-700 transition"><X size={18} /></button>
        <SidebarContent user={user} section={section} isAdmin={isAdmin} onNavigate={go} onLogout={handleLogout} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-screen w-64 bg-white/80 backdrop-blur-xl border-l border-orange-200 shadow-xl flex-col shrink-0">
        <SidebarContent user={user} section={section} isAdmin={isAdmin} onNavigate={go} onLogout={handleLogout} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="p-3 sm:p-6 max-w-7xl mx-auto pb-12">
          {/* Dashboard */}
          {section === 'dashboard' && (() => {
            // Computed dashboard values
            const buildingCount = buildings.length;
            const unitCount = units.length;
            const vacantUnits = units.filter(u => u.status === 'available').length;
            const rentedUnits = units.filter(u => u.status === 'rented').length;
            const occupancyRate = unitCount > 0 ? Math.round((rentedUnits / unitCount) * 100) : 0;

            // Arrears: sum of pending/overdue payment amounts
            const arrearsAmount = payments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0);

            // Loan balance: total principal - total paid (الأصل المسدد فقط — الفوائد مصروف لا يخصم من أصل القرض)
            const loanTotalPrincipal = loans.reduce((s: number, l: any) => s + (l.principal || 0), 0);
            const loanTotalPaid = loanPayments.reduce((s: number, lp: any) => s + (Number(lp.principal) || 0), 0);
            const loanBalance = loanTotalPrincipal - loanTotalPaid;

            // Open maintenance count
            const openMaintCount = maintenance.filter(m => m.status === 'open' || m.status === 'in_progress').length;

            // Revenue & Expenses from transactions
            const totalRevenue = transactions.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
            const totalExpenses = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + (t.amount || 0), 0);
            const netMovement = totalRevenue - totalExpenses;

            // Building comparison data: for each building, count its units, revenue, expenses
            const buildingComparison = buildings.map(b => {
              const bUnits = units.filter(u => u.buildingId === b.id);
              const bIncome = transactions.filter((t: any) => t.buildingId === b.id && t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
              const bExpense = transactions.filter((t: any) => t.buildingId === b.id && t.type === 'expense').reduce((s: number, t: any) => s + (t.amount || 0), 0);
              return { ...b, unitCount: bUnits.length, income: bIncome, expense: bExpense, net: bIncome - bExpense };
            });

            // Arrears by tenant: for each active contract with pending/overdue payments
            const arrearsByTenant = contracts.filter(c => c.status === 'active').map(c => {
              const contractPayments = payments.filter(p => p.contractId === c.id);
              const pendingOrOverdue = contractPayments.filter(p => p.status === 'pending' || p.status === 'overdue');
              const totalDue = pendingOrOverdue.reduce((s, p) => s + (p.amount || 0), 0);
              const totalPaid = contractPayments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
              const dueMonths = pendingOrOverdue.length;
              return {
                tenantName: c.tenant?.name || '-',
                unitNumber: c.unit?.number || '-',
                buildingName: c.unit?.building?.name || '-',
                rentAmount: c.rentAmount,
                dueMonths,
                totalDue,
                totalPaid,
                arrears: totalDue,
              };
            }).filter(a => a.arrears > 0);

            // Expiring contracts: within 30 days or already expired
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const expiringContracts = contracts.filter(c => {
              if (c.status !== 'active' && c.status !== 'expired') return false;
              const end = new Date(c.endDate);
              return end <= thirtyDaysFromNow;
            }).map(c => ({
              ...c,
              isExpired: new Date(c.endDate) < now,
            }));

            const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            return (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2 flex-wrap"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">لوحة التحكم</h2><Badge className="bg-orange-100 text-orange-800">{new Date().toLocaleDateString('ar')}</Badge></div>

              {/* KPI Cards - لوحة المؤشرات المجمعة */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { icon: <Building2 size={22} />, label: 'عدد العمارات', value: buildingCount, color: 'from-orange-500 to-amber-500' },
                  { icon: <Home size={22} />, label: 'عدد الوحدات', value: unitCount, color: 'from-blue-500 to-indigo-500' },
                  { icon: <Home size={22} />, label: 'وحدات شاغرة', value: vacantUnits, color: 'from-teal-500 to-cyan-500' },
                  { icon: <Activity size={22} />, label: 'نسبة الإشغال', value: `${occupancyRate}%`, color: 'from-emerald-500 to-green-500' },
                  { icon: <AlertTriangle size={22} />, label: 'المتأخرات', value: `${fmt(arrearsAmount)}`, color: 'from-red-500 to-rose-500' },
                  { icon: <Briefcase size={22} />, label: 'رصيد القروض', value: `${fmt(loanBalance)}`, color: 'from-purple-500 to-violet-500' },
                  { icon: <Wrench size={22} />, label: 'صيانة مفتوحة', value: openMaintCount, color: 'from-amber-500 to-yellow-500' },
                  { icon: <DollarSign size={22} />, label: 'الإيرادات', value: `${fmt(totalRevenue)}`, color: 'from-emerald-500 to-teal-500' },
                  { icon: <DollarSign size={22} />, label: 'المصروفات', value: `${fmt(totalExpenses)}`, color: 'from-red-500 to-pink-500' },
                  { icon: <DollarSign size={22} />, label: 'صافي الحركة', value: `${fmt(netMovement)}`, color: netMovement >= 0 ? 'from-emerald-500 to-green-500' : 'from-red-500 to-rose-500' },
                ].map((stat, i) => (
                  <Card key={i} className="border-0 shadow-lg overflow-hidden">
                    <div className={`h-1 bg-gradient-to-l ${stat.color}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div><p className="text-xs text-gray-500 mb-1">{stat.label}</p><p className="text-2xl font-bold text-gray-900">{stat.value}</p></div>
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-md`}>{stat.icon}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* ملخص العمارات - Building Summary */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Building2 size={20} className="text-orange-600" />ملخص العمارات</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-orange-50 rounded-xl text-center"><p className="text-xs text-gray-600">العمارات</p><p className="text-xl font-bold text-orange-700">{buildingCount}</p></div>
                    <div className="p-3 bg-blue-50 rounded-xl text-center"><p className="text-xs text-gray-600">الوحدات</p><p className="text-xl font-bold text-blue-700">{unitCount}</p></div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center"><p className="text-xs text-gray-600">مؤجرة</p><p className="text-xl font-bold text-emerald-700">{rentedUnits}</p></div>
                    <div className="p-3 bg-teal-50 rounded-xl text-center"><p className="text-xs text-gray-600">شاغرة</p><p className="text-xl font-bold text-teal-700">{vacantUnits}</p></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-emerald-50 rounded-xl text-center"><p className="text-xs text-gray-600">الإيرادات</p><p className="text-xl font-bold text-emerald-700">{fmt(totalRevenue)}</p></div>
                    <div className="p-3 bg-red-50 rounded-xl text-center"><p className="text-xs text-gray-600">المصروفات</p><p className="text-xl font-bold text-red-700">{fmt(totalExpenses)}</p></div>
                    <div className="p-3 bg-amber-50 rounded-xl text-center"><p className="text-xs text-gray-600">المتأخرات</p><p className="text-xl font-bold text-amber-700">{fmt(arrearsAmount)}</p></div>
                    <div className="p-3 bg-purple-50 rounded-xl text-center"><p className="text-xs text-gray-600">رصيد القروض</p><p className="text-xl font-bold text-purple-700">{fmt(loanBalance)}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* مقارنة العمارات - Building Comparison Table */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Building2 size={20} className="text-blue-600" />مقارنة العمارات</CardTitle></CardHeader>
                <CardContent>
                  {buildingComparison.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow className="bg-orange-50">
                          <TableHead>الكود</TableHead>
                          <TableHead>العمارة</TableHead>
                          <TableHead>الوحدات</TableHead>
                          <TableHead>الإيرادات</TableHead>
                          <TableHead>المصروفات</TableHead>
                          <TableHead>الصافي</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>{buildingComparison.map(b => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-sm">{b.code || b.id.slice(0, 8)}</TableCell>
                            <TableCell className="font-medium">{b.name}</TableCell>
                            <TableCell>{b.unitCount}</TableCell>
                            <TableCell className="text-emerald-700 font-semibold">{fmt(b.income)}</TableCell>
                            <TableCell className="text-red-700 font-semibold">{fmt(b.expense)}</TableCell>
                            <TableCell className={b.net >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{fmt(b.net)}</TableCell>
                          </TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-6">ابدأ بإضافة أول عمارة من تبويب «العمارات»</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* المتأخرات حسب المستأجر - Arrears by Tenant */}
                <Card className="border-0 shadow-lg overflow-hidden">
                  <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle size={20} className="text-red-600" />المتأخرات حسب المستأجر</CardTitle></CardHeader>
                  <CardContent>
                    {arrearsByTenant.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader><TableRow className="bg-red-50">
                            <TableHead>المستأجر</TableHead>
                            <TableHead>الوحدة</TableHead>
                            <TableHead>الإيجار</TableHead>
                            <TableHead>أشهر مستحقة</TableHead>
                            <TableHead>المستحق</TableHead>
                            <TableHead>المدفوع</TableHead>
                            <TableHead>المتأخر</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>{arrearsByTenant.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{a.tenantName}</TableCell>
                              <TableCell className="text-sm">{a.unitNumber}</TableCell>
                              <TableCell className="text-sm">{fmt(a.rentAmount)}</TableCell>
                              <TableCell className="text-sm text-center">{a.dueMonths}</TableCell>
                              <TableCell className="text-sm text-red-700 font-semibold">{fmt(a.totalDue)}</TableCell>
                              <TableCell className="text-sm text-emerald-700">{fmt(a.totalPaid)}</TableCell>
                              <TableCell className="text-sm text-red-700 font-bold">{fmt(a.arrears)}</TableCell>
                            </TableRow>
                          ))}</TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-6">لا توجد متأخرات</p>
                    )}
                  </CardContent>
                </Card>

                {/* عقود تنتهي خلال 30 يومًا أو منتهية - Expiring Contracts */}
                <Card className="border-0 shadow-lg overflow-hidden">
                  <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Clock size={20} className="text-amber-600" />عقود تنتهي خلال 30 يومًا أو منتهية</CardTitle></CardHeader>
                  <CardContent>
                    {expiringContracts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader><TableRow className="bg-amber-50">
                            <TableHead>المستأجر</TableHead>
                            <TableHead>الوحدة</TableHead>
                            <TableHead>النهاية</TableHead>
                            <TableHead>الحالة</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>{expiringContracts.map(c => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium text-sm">{c.tenant?.name || '-'}</TableCell>
                              <TableCell className="text-sm">{c.unit?.number || '-'}{c.unit?.building ? ` - ${c.unit.building.name}` : ''}</TableCell>
                              <TableCell className="text-sm">{new Date(c.endDate).toLocaleDateString('ar')}</TableCell>
                              <TableCell><Badge className={c.isExpired ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{c.isExpired ? 'منتهي' : 'قريب الانتهاء'}</Badge></TableCell>
                            </TableRow>
                          ))}</TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-6">لا توجد عقود قريبة الانتهاء</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Latest Maintenance Requests */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Wrench size={20} className="text-orange-600" />آخر طلبات الصيانة</CardTitle></CardHeader>
                <CardContent><div className="space-y-2">
                  {maintenance.slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2"><Badge className={MAINT_STATUS_MAP[m.status]?.color || 'bg-gray-100'}>{MAINT_STATUS_MAP[m.status]?.label || m.status}</Badge><span className="text-sm">{m.title}</span></div>
                      <Badge className={PRIORITY_MAP[m.priority]?.color || 'bg-gray-100'}>{PRIORITY_MAP[m.priority]?.label || m.priority}</Badge>
                    </div>
                  ))}
                  {maintenance.length === 0 && <p className="text-sm text-gray-400 text-center py-4">لا توجد طلبات صيانة</p>}
                </div></CardContent>
              </Card>
            </div>
            );
          })()}

          {/* Buildings */}
          {section === 'buildings' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المباني</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('buildings') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة مبنى</Button>} title="إضافة مبنى جديد">{(close) => <BuildingForm onSave={async (data) => { await api('/api/buildings', 'POST', data); autoRestore('إضافة مبنى'); loadData('buildings'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* لوحة الإيرادات المتوقعة — Expected Rental Income */}
              {buildings.length > 0 && (() => { const t = totalIncomeStats(units as any, contracts as any, buildings.map(b => b.id)); return (
                <Card className="border-0 shadow-lg"><CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3"><DollarSign size={20} className="text-emerald-600" /><h3 className="font-bold text-gray-900">لوحة الإيرادات المتوقعة — كل العمارات</h3></div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3 bg-emerald-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">المتوقع شهرياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(t.expectedMonthly)}</p></div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">المتوقع سنوياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(t.expectedAnnual)}</p></div>
                    <div className="p-3 bg-blue-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">التعاقدي شهرياً</p><p className="text-lg font-bold text-blue-700">{fmtKWD(t.contractedMonthly)}</p></div>
                    <div className="p-3 bg-teal-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">إمكانات الشواغر</p><p className="text-lg font-bold text-teal-700">{fmtKWD(t.vacantPotentialMonthly)}</p></div>
                    <div className="p-3 bg-amber-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">فرق التعاقدي عن المتوقع</p><p className={`text-lg font-bold ${t.difference >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtKWD(t.difference)}</p></div>
                    <div className="p-3 bg-purple-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">مؤجرة / شاغرة / غير قابلة</p><p className="text-lg font-bold text-purple-700">{t.occupiedUnits} / {t.vacantUnits} / {t.nonRentableUnits}</p></div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">المتوقع = مجموع الإيجار الافتراضي للوحدات القابلة للتأجير (متاحة + مؤجرة) • التعاقدي = عقود نشطة فعلية • الدفعات المحصلة تظهر في لوحة التحكم — العملة {CURRENCY}</p>
                </CardContent></Card>
              ); })()}
              <div className="grid gap-4">
                {buildings.filter(b => !searchQuery || b.name.includes(searchQuery) || (b.code || '').includes(searchQuery) || (b.city || '').includes(searchQuery) || (b.address || '').includes(searchQuery)).map(b => (
                  <Card key={b.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow"><CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white shadow"><Building2 size={24} /></div>
                        <div><h3 className="font-bold text-lg text-gray-900">{b.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            {b.address && <span className="flex items-center gap-1"><MapPin size={14} />{b.address}</span>}
                            {b.city && <span>{b.city}</span>}
                            {b.floors && <span className="flex items-center gap-1"><Hash size={14} />{b.floors} طوابق</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-100 text-orange-800">{(b.units || []).length} وحدة</Badge>
                        {canWriteCheck('buildings') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={16} /></Button>} title="تعديل المبنى">{(close) => <BuildingForm initial={b} onSave={async (data) => { await api(`/api/buildings/${b.id}`, 'PUT', data); autoRestore('تعديل مبنى'); loadData('buildings'); }} onClose={close} />}</FormDialog>}
                        {canWriteCheck('buildings') && <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => { if (confirm('هل تريد حذف هذا المبنى؟')) { await api(`/api/buildings/${b.id}`, 'DELETE'); autoRestore('حذف مبنى'); loadData('buildings'); toast.success('تم حذف المبنى'); } }}><Trash2 size={16} /></Button>}
                      </div>
                    </div>
                    {(() => { const s = buildingIncomeStats(units as any, contracts as any, b.id); const maintCost = maintenance.filter(m => m.unit?.buildingId === b.id).reduce((sum, m) => sum + (m.cost || 0), 0); return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-4 border-t border-gray-100">
                        <div className="p-2 bg-emerald-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">إيجار متوقع/شهر</p><p className="font-bold text-emerald-700 text-sm">{fmtKWD(s.expectedMonthly)} {CURRENCY}</p></div>
                        <div className="p-2 bg-blue-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">تعاقدي/شهر</p><p className="font-bold text-blue-700 text-sm">{fmtKWD(s.contractedMonthly)} {CURRENCY}</p></div>
                        <div className="p-2 bg-teal-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">إمكانات الشواغر</p><p className="font-bold text-teal-700 text-sm">{fmtKWD(s.vacantPotentialMonthly)} {CURRENCY}</p></div>
                        <div className="p-2 bg-amber-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">سنوياً (متوقع)</p><p className="font-bold text-amber-700 text-sm">{fmtKWD(s.expectedAnnual)} {CURRENCY}</p></div>
                        <div className="p-2 bg-red-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">مصروف صيانة تراكمي</p><p className="font-bold text-red-700 text-sm">{fmtKWD(maintCost)} {CURRENCY}</p></div>
                      </div>
                    ); })()}
                  </CardContent></Card>
                ))}
                {buildings.length === 0 && <EmptyState icon={<Building2 size={48} />} text="لا توجد مباني مضافة" />}
              </div>
            </div>
          )}

          {/* Units */}
          {section === 'units' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الوحدات</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('units') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة وحدة</Button>} title="إضافة وحدة جديدة">{(close) => <UnitForm buildings={buildings} onSave={async (data) => { await api('/api/units', 'POST', data); autoRestore('إضافة وحدة'); loadData('units'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {units.filter(u => !searchQuery || u.number.includes(searchQuery) || (u.building?.name || '').includes(searchQuery) || u.status.includes(searchQuery)).map(u => (
                  <Card key={u.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow"><CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-900">وحدة {u.number}</h3><Badge className={UNIT_STATUS_MAP[u.status]?.color || 'bg-gray-100'}>{UNIT_STATUS_MAP[u.status]?.label || u.status}</Badge></div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {u.building && <p className="flex items-center gap-1"><Building2 size={14} />{u.building.name}</p>}
                      {u.floor && <p>الطابق: {u.floor}</p>}
                      {u.area && <p>المساحة: {u.area} م²</p>}
                      {u.rentAmount && <p className="font-semibold text-emerald-700">الإيجار: {u.rentAmount.toLocaleString('ar')} {CURRENCY}</p>}
                    </div>
                    {canWriteCheck('units') && <div className="flex gap-2 mt-3"><FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الوحدة">{(close) => <UnitForm buildings={buildings} initial={u} onSave={async (data) => { await api(`/api/units/${u.id}`, 'PUT', data); autoRestore('تعديل وحدة'); loadData('units'); }} onClose={close} />}</FormDialog><Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/units/${u.id}`, 'DELETE'); autoRestore('حذف وحدة'); loadData('units'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button></div>}
                  </CardContent></Card>
                ))}
                {units.length === 0 && <EmptyState icon={<Home size={48} />} text="لا توجد وحدات مضافة" />}
              </div>
            </div>
          )}

          {/* Tenants */}
          {section === 'tenants' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المستأجرين</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('tenants') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة مستأجر</Button>} title="إضافة مستأجر جديد">{(close) => <TenantForm onSave={async (data) => { await api('/api/tenants', 'POST', data); autoRestore('إضافة مستأجر'); loadData('tenants'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.filter(t => !searchQuery || t.name.includes(searchQuery) || (t.phone || '').includes(searchQuery) || (t.idNumber || '').includes(searchQuery)).map(t => (
                  <Card key={t.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow"><CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">{t.name.charAt(0)}</div>
                      <div><h3 className="font-bold text-gray-900">{t.name}</h3>{t.idNumber && <p className="text-xs text-gray-500">رقم الهوية: {t.idNumber}</p>}</div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {t.phone && <p className="flex items-center gap-1"><Phone size={14} />{t.phone}</p>}
                      {t.email && <p className="flex items-center gap-1"><Mail size={14} />{t.email}</p>}
                    </div>
                    {/* Tenant uploads (civil ID, etc.) - with inline thumbnail preview */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(t.uploads || []).map(f => (
                          <span key={f.id} className="inline-flex items-center gap-1">
                            <FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} showThumbnail />
                            <span className="text-xs text-gray-600 max-w-[60px] truncate" title={f.originalName}>{f.originalName}</span>
                          </span>
                        ))}
                      </div>
                      {canWriteCheck('files') && (
                        <div className="flex gap-2">
                          <FileUploadButton className="border-blue-200 text-blue-700" icon={<Camera size={14} className="ml-1" />} onPick={async (file) => {
                            try { const saved: any = await uploadFile(file, 'identity', { tenantId: t.id }); if (saved?.warning) { toast.warning(saved.warning); } else { toast.success('تم رفع المدنية'); } loadData('tenants'); } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل رفع الملف'); }
                          }}>رفع المدنية</FileUploadButton>
                          <FileUploadButton className="border-orange-200 text-orange-700" icon={<Upload size={14} className="ml-1" />} onPick={async (file) => {
                            try { const saved: any = await uploadFile(file, 'general', { tenantId: t.id }); if (saved?.warning) { toast.warning(saved.warning); } else { toast.success('تم رفع المستند'); } loadData('tenants'); } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل رفع الملف'); }
                          }}>رفع مستند</FileUploadButton>
                        </div>
                      )}
                    </div>
                    {canWriteCheck('tenants') && <div className="flex gap-2 mt-3"><FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل المستأجر">{(close) => <TenantForm initial={t} onSave={async (data) => { await api(`/api/tenants/${t.id}`, 'PUT', data); autoRestore('تعديل مستأجر'); loadData('tenants'); }} onClose={close} />}</FormDialog><Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/tenants/${t.id}`, 'DELETE'); autoRestore('حذف مستأجر'); loadData('tenants'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button></div>}
                  </CardContent></Card>
                ))}
                {tenants.length === 0 && <EmptyState icon={<Users size={48} />} text="لا يوجد مستأجرين" />}
              </div>
            </div>
          )}

          {/* Contracts */}
          {section === 'contracts' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">العقود</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('contracts') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة عقد</Button>} title="إضافة عقد جديد" maxWidth="max-w-lg">{(close) => <ContractForm units={units} tenants={tenants} buildings={buildings} onSave={async (data) => { await api('/api/contracts', 'POST', data); if (data.updateDefaultRent && data.unitId) { await api(`/api/units/${data.unitId}`, 'PUT', { rentAmount: data.rentAmount }); loadData('units'); } autoRestore('إضافة عقد'); loadData('contracts'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[{ k: 'all', l: 'الكل' }, ...Object.entries(CONTRACT_STATUS_MAP).map(([k, v]) => ({ k, l: v.label }))].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setContractFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${contractFilter === k ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'}`}>{l}</button>
                ))}
              </div>
              <div className="grid gap-4">
                {contracts.filter(c => (contractFilter === 'all' || c.status === contractFilter) && (!searchQuery || (c.tenant?.name || '').includes(searchQuery) || (c.unit?.number || '').includes(searchQuery) || (c.unit?.building?.name || '').includes(searchQuery) || c.status.includes(searchQuery))).map(c => (
                  <Card key={c.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow"><CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2"><Badge className={CONTRACT_STATUS_MAP[c.status]?.color || 'bg-gray-100'}>{CONTRACT_STATUS_MAP[c.status]?.label || c.status}</Badge><span className="text-sm text-gray-500">العقد #{c.id.slice(0, 8)}</span></div>
                        <div className="space-y-1 text-sm">
                          {c.unit && <p className="flex items-center gap-1"><Home size={14} className="text-gray-400" />وحدة {c.unit.number} - {c.unit.building?.name}</p>}
                          {c.tenant && <p className="flex items-center gap-1"><Users size={14} className="text-gray-400" />{c.tenant.name}</p>}
                          <p className="flex items-center gap-1"><Calendar size={14} className="text-gray-400" />{new Date(c.startDate).toLocaleDateString('ar')} - {new Date(c.endDate).toLocaleDateString('ar')}</p>
                          <p className="font-semibold text-emerald-700">الإيجار: {c.rentAmount.toLocaleString('ar')} {CURRENCY}</p>
                          {(() => { try { const bal = contractBalance(c as any, (c.payments || []) as any); if (bal.totalDue <= 0) return null; return (<p className={`text-sm font-semibold ${bal.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>المستحق: {fmtKWD(bal.totalDue)} — المدفوع: {fmtKWD(bal.totalPaid)} — المتبقي: {fmtKWD(bal.outstanding)} {CURRENCY}</p>); } catch { return null; } })()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        {(() => { const list = c.attachments || []; const last = list[list.length - 1]; return last ? <FilePreviewDialog fileId={last.id} fileName={last.originalName} mimeType={last.mimeType} triggerLabel="عرض العقد" /> : null; })()}
                        {canWriteCheck('contracts') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل العقد" maxWidth="max-w-lg">{(close) => <ContractForm units={units} tenants={tenants} buildings={buildings} initial={c} onSave={async (data) => { await api(`/api/contracts/${c.id}`, 'PUT', data); if (data.updateDefaultRent && data.unitId) { await api(`/api/units/${data.unitId}`, 'PUT', { rentAmount: data.rentAmount }); loadData('units'); } autoRestore('تعديل عقد'); loadData('contracts'); }} onClose={close} />}</FormDialog>}
                        {canWriteCheck('files') && (
                          <FileUploadButton className="border-orange-200 text-orange-700" icon={<Camera size={14} className="ml-1" />} onPick={async (file) => {
                            try { const saved: any = await uploadFile(file, 'contract', { contractId: c.id }); if (saved?.warning) { toast.warning(saved.warning); } else { toast.success('تم رفع الملف'); } loadData('contracts'); } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل رفع الملف'); }
                          }}>رفع صورة العقد</FileUploadButton>
                        )}
                        {canWriteCheck('contracts') && <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/contracts/${c.id}`, 'DELETE'); autoRestore('حذف عقد'); loadData('contracts'); toast.success('تم الحذف'); } }}><Trash2 size={16} /></Button>}
                      </div>
                    </div>
                    {c.attachments && c.attachments.length > 0 && (<div className="mt-3 flex flex-wrap gap-2">{c.attachments.map(f => (<span key={f.id} className="inline-flex items-center gap-1"><FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} showThumbnail /><span className="text-xs text-gray-600 max-w-[60px] truncate" title={f.originalName}>{f.originalName}</span></span>))}</div>)}
                  </CardContent></Card>
                ))}
                {contracts.length === 0 && <EmptyState icon={<FileText size={48} />} text="لا توجد عقود" />}
              </div>
            </div>
          )}

          {/* Payments */}
          {section === 'payments' && (() => {
            const filteredPayments = payments.filter(p => !searchQuery || p.status.includes(searchQuery) || (p.method || '').includes(searchQuery) || String(p.amount).includes(searchQuery));
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المدفوعات</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('payments') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />تسجيل دفعة</Button>} title="تسجيل دفعة جديدة">{(close) => <PaymentForm contracts={contracts} payments={payments} buildings={buildings} onSave={async (data) => { await api('/api/payments', 'POST', data); autoRestore('تسجيل دفعة'); loadData('payments'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
              <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>المبلغ</TableHead><TableHead>تاريخ الاستحقاق</TableHead><TableHead>تاريخ الدفع</TableHead><TableHead>الحالة</TableHead><TableHead>الطريقة</TableHead><TableHead>العقد</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{filteredPayments.map(p => (<TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.amount.toLocaleString('ar')} {CURRENCY}</TableCell>
                  <TableCell>{new Date(p.dueDate).toLocaleDateString('ar')}</TableCell>
                  <TableCell>{p.paidDate ? new Date(p.paidDate).toLocaleDateString('ar') : '-'}</TableCell>
                  <TableCell><Badge className={PAYMENT_STATUS_MAP[p.status]?.color}>{PAYMENT_STATUS_MAP[p.status]?.label || p.status}</Badge></TableCell>
                  <TableCell>{p.method || '-'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{p.contractId?.slice(0, 8)}</TableCell>
                  <TableCell><div className="flex gap-1">
                    {(p.status === 'paid' || p.status === 'partial') && <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند قبض"><Printer size={14} /></Button>} title="سند قبض — إيجار" docHtml={paymentReceiptHtml(p, CURRENCY)} />}
                    {canWriteCheck('payments') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الدفعة">{(close) => <PaymentForm contracts={contracts} payments={payments} buildings={buildings} initial={p} onSave={async (data) => { await api(`/api/payments/${p.id}`, 'PUT', data); autoRestore('تعديل دفعة'); loadData('payments'); }} onClose={close} />}</FormDialog>}
                    {canWriteCheck('payments') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/payments/${p.id}`, 'DELETE'); autoRestore('حذف دفعة'); loadData('payments'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                  </div></TableCell>
                </TableRow>))}</TableBody></Table>
              </div></Card>
              </div>
              {/* Mobile cards */}
              <div className="grid gap-3 md:hidden">
                {filteredPayments.map(p => (
                  <Card key={p.id} className="border-0 shadow-md"><CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-lg text-gray-900">{p.amount.toLocaleString('ar')} {CURRENCY}</span>
                      <Badge className={PAYMENT_STATUS_MAP[p.status]?.color}>{PAYMENT_STATUS_MAP[p.status]?.label || p.status}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="flex items-center gap-1"><Calendar size={13} />استحقاق: {new Date(p.dueDate).toLocaleDateString('ar')}{p.paidDate ? ` — دُفع: ${new Date(p.paidDate).toLocaleDateString('ar')}` : ''}</p>
                      {p.month && <p>عن شهر: {p.month}</p>}
                      <p>الطريقة: {p.method || '-'} — العقد: {p.contractId?.slice(0, 8)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                      {(p.status === 'paid' || p.status === 'partial') && <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند قبض"><Printer size={14} /></Button>} title="سند قبض — إيجار" docHtml={paymentReceiptHtml(p, CURRENCY)} />}
                      {canWriteCheck('payments') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الدفعة">{(close) => <PaymentForm contracts={contracts} payments={payments} buildings={buildings} initial={p} onSave={async (data) => { await api(`/api/payments/${p.id}`, 'PUT', data); autoRestore('تعديل دفعة'); loadData('payments'); }} onClose={close} />}</FormDialog>}
                      {canWriteCheck('payments') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/payments/${p.id}`, 'DELETE'); autoRestore('حذف دفعة'); loadData('payments'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                    </div>
                  </CardContent></Card>
                ))}
              </div>
              {payments.length === 0 && <EmptyState icon={<DollarSign size={48} />} text="لا توجد مدفوعات" />}
            </div>
            );
          })()}

          {/* Maintenance */}
          {section === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">طلبات الصيانة</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('maintenance') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />طلب صيانة</Button>} title="طلب صيانة جديد">{(close) => <MaintenanceForm buildings={buildings} units={units} onSave={async (data) => { await api('/api/maintenance', 'POST', data); autoRestore('طلب صيانة'); loadData('maintenance'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <div className="grid gap-4">
                {maintenance.filter(m => !searchQuery || m.title.includes(searchQuery) || m.status.includes(searchQuery) || m.priority.includes(searchQuery)).map(m => (
                  <Card key={m.id} className="border-0 shadow-lg"><CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2"><Badge className={MAINT_STATUS_MAP[m.status]?.color}>{MAINT_STATUS_MAP[m.status]?.label || m.status}</Badge><Badge className={PRIORITY_MAP[m.priority]?.color}>{PRIORITY_MAP[m.priority]?.label || m.priority}</Badge>{m.unit && <Badge className="bg-purple-100 text-purple-800">وحدة {m.unit.number}{m.unit.building ? ` — ${m.unit.building.name}` : ''}</Badge>}{m.category && m.category !== 'other' && <Badge className="bg-gray-100 text-gray-700">{MAINT_CATEGORIES[m.category] || m.category}</Badge>}</div>
                        <h3 className="font-bold text-gray-900">{m.title}</h3>
                        {m.description && <p className="text-sm text-gray-600 mt-1">{m.description}</p>}
                        {m.estimatedCost != null && <p className="text-sm text-amber-700 mt-1">التكلفة التقديرية: {m.estimatedCost.toLocaleString('ar')} {CURRENCY}</p>}
                        {m.cost && <p className="text-sm text-emerald-700 mt-1">التكلفة الفعلية: {m.cost.toLocaleString('ar')} {CURRENCY}</p>}
                        {/* Maintenance attachments with inline preview */}
                        {(m.attachments && m.attachments.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {m.attachments.map(f => (
                              <span key={f.id} className="inline-flex items-center gap-1">
                                <FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} showThumbnail />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {m.status === 'completed' && m.cost > 0 && <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند صرف — تكلفة الصيانة"><Printer size={14} /></Button>} title="سند صرف — صيانة" docHtml={maintenanceVoucherHtml(m, CURRENCY)} />}
                        {canWriteCheck('maintenance') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل طلب الصيانة">{(close) => <MaintenanceForm buildings={buildings} units={units} initial={m} onSave={async (data) => { await api(`/api/maintenance/${m.id}`, 'PUT', data); autoRestore('تعديل صيانة'); loadData('maintenance'); }} onClose={close} />}</FormDialog>}
                        {canWriteCheck('files') && (
                          <FileUploadButton className="border-orange-200 text-orange-700" icon={<Camera size={14} className="ml-1" />} onPick={async (file) => { try { const saved: any = await uploadFile(file, 'maintenance', { maintenanceId: m.id }); if (saved?.warning) { toast.warning(saved.warning); } else { toast.success('تم رفع الملف'); } loadData('maintenance'); } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل رفع الملف'); } }}>صورة</FileUploadButton>
                        )}
                        {canWriteCheck('maintenance') && m.status !== 'completed' && <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700" onClick={async () => { await api(`/api/maintenance/${m.id}`, 'PUT', { status: 'completed', completedAt: new Date().toISOString() }); autoRestore('إكمال صيانة'); loadData('maintenance'); toast.success('تم إكمال الطلب'); }}><CheckCircle2 size={14} /></Button>}
                        {canWriteCheck('maintenance') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/maintenance/${m.id}`, 'DELETE'); autoRestore('حذف صيانة'); loadData('maintenance'); } }}><Trash2 size={14} /></Button>}
                      </div>
                    </div>
                  </CardContent></Card>
                ))}
                {maintenance.length === 0 && <EmptyState icon={<Wrench size={48} />} text="لا توجد طلبات صيانة" />}
              </div>
            </div>
          )}

          {/* Audit */}
          {section === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">سجل التدقيق</h2>
                <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
              </div>
              <Card className="border-0 shadow-lg overflow-hidden"><div className="h-[600px] overflow-auto"><div className="min-w-[680px]">
                <Table><TableHeader><TableRow className="bg-orange-50 sticky top-0"><TableHead>الوقت</TableHead><TableHead>المستخدم</TableHead><TableHead>الإجراء</TableHead><TableHead>الكيان</TableHead><TableHead>التفاصيل</TableHead></TableRow></TableHeader>
                <TableBody>{auditLogs.filter(l => !searchQuery || (l.user?.name || '').includes(searchQuery) || l.action.includes(searchQuery) || l.entity.includes(searchQuery) || (l.details || '').includes(searchQuery)).map(l => (<TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString('ar')}</TableCell>
                  <TableCell className="text-sm">{l.user?.name || '-'}</TableCell>
                  <TableCell><Badge className="bg-blue-100 text-blue-800 text-xs">{l.action}</Badge></TableCell>
                  <TableCell className="text-sm">{l.entity}</TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-xs truncate">{l.details || '-'}</TableCell>
                </TableRow>))}</TableBody></Table>
              </div></div></Card>
            </div>
          )}

          {/* Restore Points */}
          {section === 'restore' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">نقاط الاستعادة</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {isAdmin && <Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md" onClick={async () => { const name = prompt('اسم نقطة الاستعادة:'); if (name) { await api('/api/restore', 'POST', { name }); loadData('restore'); toast.success('تم إنشاء نقطة الاستعادة'); } }}><Archive size={18} className="ml-2" />إنشاء نقطة استعادة</Button>}
                </div>
              </div>
              <div className="grid gap-4">
                {restorePoints.filter(rp => !searchQuery || rp.name.includes(searchQuery) || (rp.creator?.name || '').includes(searchQuery)).map(rp => (
                  <Card key={rp.id} className="border-0 shadow-lg"><CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div><h3 className="font-bold text-gray-900">{rp.name}</h3><p className="text-sm text-gray-500 mt-1">{new Date(rp.createdAt).toLocaleString('ar')} — {rp.creator?.name}</p>{rp.description && <p className="text-sm text-gray-600 mt-1">{rp.description}</p>}</div>
                      {isAdmin && <Button variant="outline" className="border-orange-200 text-orange-700" onClick={async () => { if (confirm('هل تريد الاستعادة؟ سيتم استبدال البيانات.')) { await api(`/api/restore/${rp.id}`, 'POST'); toast.success('تمت الاستعادة'); loadData('dashboard'); } }}><RefreshCw size={16} className="ml-2" />استعادة</Button>}
                    </div>
                  </CardContent></Card>
                ))}
                {restorePoints.length === 0 && <EmptyState icon={<Archive size={48} />} text="لا توجد نقاط استعادة" />}
              </div>
            </div>
          )}

          {/* Users */}
          {section === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المستخدمون</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {isAdmin && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><UserPlus size={18} className="ml-2" />إضافة مستخدم</Button>} title="إضافة مستخدم جديد">{(close) => <UserForm onSave={async (data) => { await api('/api/users', 'POST', data); loadData('users'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto"><div className="min-w-[680px]">
                <Table>
                <TableHeader><TableRow className="bg-orange-50"><TableHead>الاسم</TableHead><TableHead>اسم المستخدم</TableHead><TableHead>الدور</TableHead><TableHead>الصلاحيات</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{allUsers.filter((u: any) => !searchQuery || (u.name || '').includes(searchQuery) || (u.username || '').includes(searchQuery) || (u.role || '').includes(searchQuery)).map((u: any) => (<TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell><TableCell>{u.username}</TableCell>
                  <TableCell><Badge className="bg-orange-100 text-orange-800">{ROLES_MAP[u.role] || u.role}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[200px]">{u.permissions ? (() => { try { const p = JSON.parse(u.permissions); return Object.entries(p).filter(([,v]) => v === true).map(([k]) => k).join('، ') || 'افتراضي'; } catch { return '-'; } })() : (<span className="text-gray-400">افتراضي</span>)}</TableCell>
                  <TableCell>{u.active ? <Badge className="bg-emerald-100 text-emerald-800">نشط</Badge> : <Badge className="bg-red-100 text-red-800">معطّل</Badge>}</TableCell>
                  <TableCell><div className="flex gap-1">
                    {isAdmin && (<>
                      <Button variant="ghost" size="sm" onClick={async () => { const pw = prompt('كلمة السر الجديدة:'); if (pw) { await api(`/api/users/${u.id}`, 'PATCH', { password: pw }); toast.success('تم تغيير كلمة السر'); } }}><Key size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={async () => { const newRole = prompt('الدور الجديد:', u.role); if (newRole) { await api(`/api/users/${u.id}`, 'PATCH', { role: newRole }); loadData('users'); } }}><Edit3 size={14} /></Button>
                      <FormDialog trigger={<Button variant="ghost" size="sm" title="صلاحيات"><Shield size={14} /></Button>} title={'صلاحيات ' + u.name}>{(close) => <PermissionsEditor currentPerms={u.permissions || '{}'} onSave={async (perms) => { await api(`/api/users/${u.id}`, 'PATCH', { permissions: perms }); loadData('users'); toast.success('تم تحديث الصلاحيات'); }} onClose={close} />}</FormDialog>
                      <Button variant="ghost" size="sm" className={u.active ? 'text-red-500' : 'text-emerald-500'} onClick={async () => { await api(`/api/users/${u.id}`, 'PATCH', { active: !u.active }); loadData('users'); }}>{u.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}</Button>
                    </>)}
                  </div></TableCell>
                </TableRow>))}</TableBody>
              </Table></div></div></Card>
            </div>
          )}

          {/* Transactions */}
          {section === 'transactions' && (() => {
            const filteredTransactions = transactions.filter((t: any) => !searchQuery || (t.category || '').includes(searchQuery) || (t.type || '').includes(searchQuery) || (t.building?.name || '').includes(searchQuery) || String(t.amount).includes(searchQuery));
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الإيرادات والمصروفات</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('transactions') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة حركة</Button>} title="إضافة حركة مالية">{(close) => <TransactionForm buildings={buildings} onSave={async (data) => { await api('/api/transactions', 'POST', data); autoRestore('إضافة حركة مالية'); loadData('transactions'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
              <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>التاريخ</TableHead><TableHead>العمارة</TableHead><TableHead>النوع</TableHead><TableHead>البيان</TableHead><TableHead>المبلغ</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{filteredTransactions.map((t: any) => (<TableRow key={t.id}>
                  <TableCell className="text-sm">{new Date(t.date).toLocaleDateString('ar')}</TableCell>
                  <TableCell className="text-sm">{t.building?.name || '-'}</TableCell>
                  <TableCell><Badge className={t.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>{t.type === 'income' ? 'إيراد' : 'مصروف'}</Badge></TableCell>
                  <TableCell className="text-sm">{t.category || '-'}</TableCell>
                  <TableCell className="font-semibold">{t.amount?.toLocaleString('ar')} {CURRENCY}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند"><Printer size={14} /></Button>} title="سند — حركة مالية" docHtml={transactionVoucherHtml(t, CURRENCY)} />
                    {canWriteCheck('transactions') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الحركة">{(close) => <TransactionForm buildings={buildings} initial={t} onSave={async (data) => { await api(`/api/transactions/${t.id}`, 'PUT', data); autoRestore('تعديل حركة مالية'); loadData('transactions'); }} onClose={close} />}</FormDialog>}
                    {canWriteCheck('transactions') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/transactions/${t.id}`, 'DELETE'); autoRestore('حذف حركة مالية'); loadData('transactions'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                  </div></TableCell>
                </TableRow>))}</TableBody></Table>
              </div></Card>
              </div>
              {/* Mobile cards */}
              <div className="grid gap-3 md:hidden">
                {filteredTransactions.map((t: any) => (
                  <Card key={t.id} className="border-0 shadow-md"><CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>{t.type === 'income' ? '+' : '−'} {t.amount?.toLocaleString('ar')} {CURRENCY}</span>
                      <Badge className={t.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>{t.type === 'income' ? 'إيراد' : 'مصروف'}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="flex items-center gap-1"><Calendar size={13} />{new Date(t.date).toLocaleDateString('ar')}</p>
                      <p>{t.category || '-'}{t.building?.name ? ` — ${t.building.name}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                      <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند"><Printer size={14} /></Button>} title="سند — حركة مالية" docHtml={transactionVoucherHtml(t, CURRENCY)} />
                      {canWriteCheck('transactions') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الحركة">{(close) => <TransactionForm buildings={buildings} initial={t} onSave={async (data) => { await api(`/api/transactions/${t.id}`, 'PUT', data); autoRestore('تعديل حركة مالية'); loadData('transactions'); }} onClose={close} />}</FormDialog>}
                      {canWriteCheck('transactions') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/transactions/${t.id}`, 'DELETE'); autoRestore('حذف حركة مالية'); loadData('transactions'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                    </div>
                  </CardContent></Card>
                ))}
              </div>
              {transactions.length === 0 && <EmptyState icon={<DollarSign size={48} />} text="لا توجد حركات مالية" />}
            </div>
            );
          })()}

          {/* Loans — تصميم متكامل: ملخص + كارت لكل قرض بأقساطه وسنداته */}
          {section === 'loans' && (() => {
            const totalPrincipal = loans.reduce((s: number, l: any) => s + (l.principal || 0), 0);
            const totalPaidPrincipal = loanPayments.reduce((s: number, lp: any) => s + (Number(lp.principal) || 0), 0);
            const totalInterestPaid = loanPayments.reduce((s: number, lp: any) => s + (Number(lp.interest) || 0), 0);
            const totalRemaining = Math.max(0, totalPrincipal - totalPaidPrincipal);
            const filteredLoans = loans.filter((l: any) => !searchQuery || l.name.includes(searchQuery) || String(l.principal).includes(searchQuery));
            const refresh = (action: string) => { autoRestore(action); loadData('loans'); };
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">القروض</h2>
                  <p className="text-sm text-gray-500 mt-0.5">كل قرض بأقساطه وسنداته في مكان واحد</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('loans') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة قرض</Button>} title="إضافة قرض جديد">{(close) => <LoanForm buildings={buildings} onSave={async (data) => { await api('/api/loans', 'POST', data); refresh('إضافة قرض'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* ملخص القروض */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'إجمالي القروض', value: fmtKWD(totalPrincipal), icon: <Briefcase size={16} />, cls: 'bg-purple-50 text-purple-700' },
                  { label: 'المسدد من الأصل', value: fmtKWD(totalPaidPrincipal), icon: <CheckCircle2 size={16} />, cls: 'bg-emerald-50 text-emerald-700' },
                  { label: 'المتبقي', value: fmtKWD(totalRemaining), icon: <AlertTriangle size={16} />, cls: 'bg-red-50 text-red-700' },
                  { label: 'الفوائد المسددة', value: fmtKWD(totalInterestPaid), icon: <Percent size={16} />, cls: 'bg-amber-50 text-amber-700' },
                ].map((s, i) => (
                  <div key={i} className={`p-3.5 rounded-2xl ${s.cls} flex items-center gap-3 shadow-sm`}>
                    <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">{s.icon}</div>
                    <div className="min-w-0"><p className="text-[11px] text-gray-600">{s.label}</p><p className="font-bold text-sm sm:text-lg truncate">{s.value} {CURRENCY}</p></div>
                  </div>
                ))}
              </div>
              {/* كروت القروض */}
              {filteredLoans.map((l: any) => (
                <LoanCard key={l.id} loan={l} buildingName={buildings.find(b => b.id === l.buildingId)?.name} installments={loanPayments.filter((lp: any) => lp.loanId === l.id)} canWrite={canWriteCheck('loans')} buildings={buildings} refresh={refresh} />
              ))}
              {loans.length === 0 && <EmptyState icon={<Briefcase size={48} />} text="لا توجد قروض" />}
            </div>
            );
          })()}

          {/* Accounts */}
          {section === 'accounts' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">شجرة الحسابات</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {isAdmin && <Button variant="outline" className="border-orange-200 text-orange-700" onClick={async () => { if (!confirm('سيتم إنشاء الحسابات الافتراضية غير الموجودة فقط — لن يتم تعديل أو حذف أي حساب قائم. متابعة؟')) return; try { const r = await api<any>('/api/accounts/seed', 'POST'); toast.success(`تم الاستيراد: ${r.created} حساب جديد — ${r.skipped.length} موجود مسبقاً (من إجمالي ${r.total})`); loadData('accounts'); } catch (e: any) { toast.error(e.message); } }}>إنشاء الشجرة الافتراضية</Button>}
                  {canWriteCheck('accounts') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة حساب</Button>} title="إضافة حساب جديد">{(close) => <AccountForm accounts={accounts} onSave={async (data) => { await api('/api/accounts', 'POST', data); loadData('accounts'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>رقم الحساب</TableHead><TableHead>اسم الحساب</TableHead><TableHead>النوع</TableHead><TableHead>التصنيف</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{accounts.filter((a: any) => !searchQuery || (a.code || '').includes(searchQuery) || (a.name || '').includes(searchQuery) || (a.type || '').includes(searchQuery)).map((a: any) => (<TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.code}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell><Badge className="bg-blue-100 text-blue-800">{({ asset: 'أصول', liability: 'التزامات', equity: 'حقوق الملكية', revenue: 'إيرادات', expense: 'مصروفات' } as any)[a.type] || a.type}</Badge></TableCell>
                  <TableCell><Badge className={a.kind === 'group' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}>{a.kind === 'group' ? 'رئيسي' : 'فرعي'}</Badge></TableCell>
                  <TableCell><div className="flex gap-1">
                    {canWriteCheck('accounts') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الحساب">{(close) => <AccountForm accounts={accounts} initial={a} onSave={async (data) => { await api(`/api/accounts/${a.id}`, 'PUT', data); loadData('accounts'); }} onClose={close} />}</FormDialog>}
                    {canWriteCheck('accounts') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/accounts/${a.id}`, 'DELETE'); autoRestore('حذف حساب'); loadData('accounts'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                  </div></TableCell>
                </TableRow>))}</TableBody></Table>
              </div></Card>
              {accounts.length === 0 && <EmptyState icon={<Hash size={48} />} text="لا توجد حسابات" />}
            </div>
          )}

          {/* Journal */}
          {section === 'journal' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">القيود اليومية</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <Button variant="outline" className="border-orange-200 text-orange-700" onClick={() => printHtmlDoc(journalBookDocHtml(journalEntries.filter((j: any) => !searchQuery || (j.description || '').includes(searchQuery) || (j.building?.name || '').includes(searchQuery) || (j.date || '').includes(searchQuery)), CURRENCY), 'دفتر اليومية')}><Printer size={16} className="ml-1" />طباعة دفتر اليومية</Button>
                  {canWriteCheck('journal') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة قيد</Button>} title="إضافة قيد يومي" maxWidth="max-w-lg">{(close) => <JournalForm accounts={accounts} buildings={buildings} onSave={async (data) => { await api('/api/journal', 'POST', data); loadData('journal'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <Card className="border-0 shadow-lg overflow-hidden"><div className="h-[600px] overflow-auto"><div className="min-w-[700px]">
                <Table><TableHeader><TableRow className="bg-orange-50 sticky top-0"><TableHead>التاريخ</TableHead><TableHead>البيان</TableHead><TableHead>العمارة</TableHead><TableHead>القيود</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{journalEntries.filter((j: any) => !searchQuery || (j.description || '').includes(searchQuery) || (j.building?.name || '').includes(searchQuery) || (j.date || '').includes(searchQuery)).map((j: any) => (<TableRow key={j.id}>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(j.date).toLocaleDateString('ar')}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{j.description}</span>
                      {j.source && j.source !== 'manual' && <Badge className="bg-indigo-100 text-indigo-800 shrink-0">{SOURCE_LABELS[j.source] || 'تلقائي'}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{j.building?.name || '-'}</TableCell>
                  <TableCell className="text-xs">
                    <div className="space-y-1">
                      {(j.lines || []).map((line: any, i: number) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span className="text-gray-600"><span className="font-mono text-gray-400 ml-1">{line.accountCode}</span>{line.accountName || line.account?.name || ''}</span>
                          {line.debit > 0 && <Badge className="bg-emerald-100 text-emerald-800">م {line.debit.toLocaleString?.('ar') ?? line.debit}</Badge>}
                          {line.credit > 0 && <Badge className="bg-red-100 text-red-800">د {line.credit.toLocaleString?.('ar') ?? line.credit}</Badge>}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><div className="flex gap-1">
                    <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="عرض وطباعة إذن القيد"><Printer size={14} /></Button>} title="إذن قيد محاسبي" docHtml={journalEntryDocHtml(j, CURRENCY)} />
                    {canWriteCheck('journal') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل القيد"><Edit3 size={14} /></Button>} title="تعديل قيد يومي" maxWidth="max-w-lg">{(close) => <JournalForm accounts={accounts} buildings={buildings} initial={j} onSave={async (data) => { await api(`/api/journal/${j.id}`, 'PUT', data); loadData('journal'); toast.success('تم تعديل القيد'); }} onClose={close} />}</FormDialog>}
                    {canWriteCheck('journal') && j.source === 'manual' && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف القيد نهائيًا؟')) { await api(`/api/journal/${j.id}`, 'DELETE'); loadData('journal'); toast.success('تم حذف القيد'); } }}><Trash2 size={14} /></Button>}
                  </div></TableCell>
                </TableRow>))}</TableBody></Table>
              </div></div></Card>
              {journalEntries.length === 0 && <EmptyState icon={<FileText size={48} />} text="لا توجد قيود يومية" />}
            </div>
          )}

          {/* Trial Balance — ميزان المراجعة */}
          {section === 'trialBalance' && (() => {
            const map = new Map<string, { code: string; name: string; debit: number; credit: number }>();
            for (const e of journalEntries as any[]) {
              for (const l of (e.lines || [])) {
                const code = String(l.accountCode || '?');
                const cur = map.get(code) || { code, name: l.accountName || code, debit: 0, credit: 0 };
                cur.debit += Number(l.debit) || 0;
                cur.credit += Number(l.credit) || 0;
                map.set(code, cur);
              }
            }
            const rows: TBRow[] = [...map.values()].sort((a, b) => a.code.localeCompare(b.code)).map(r => {
              const bal = Math.round((r.debit - r.credit) * 1000) / 1000;
              return { ...r, bd: bal > 0 ? bal : 0, bc: bal < 0 ? -bal : 0 };
            });
            const totals = rows.reduce((s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit, bd: s.bd + r.bd, bc: s.bc + r.bc }), { debit: 0, credit: 0, bd: 0, bc: 0 });
            const balanced = Math.round(totals.debit * 1000) === Math.round(totals.credit * 1000);
            const filtered = rows.filter(r => !searchQuery || r.code.includes(searchQuery) || r.name.includes(searchQuery));
            return (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">ميزان المراجعة</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                    <Badge className={balanced ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>{balanced ? 'متوازن ✓' : 'غير متوازن'}</Badge>
                    <Button variant="outline" className="border-orange-200 text-orange-700" onClick={() => printHtmlDoc(trialBalanceDocHtml(filtered, CURRENCY), 'ميزان المراجعة')}><Printer size={16} className="ml-1" />طباعة</Button>
                  </div>
                </div>
                <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
                  <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>الكود</TableHead><TableHead>الحساب</TableHead><TableHead>مدين</TableHead><TableHead>دائن</TableHead><TableHead>رصيد مدين</TableHead><TableHead>رصيد دائن</TableHead></TableRow></TableHeader>
                  <TableBody>{filtered.map(r => (<TableRow key={r.code}>
                    <TableCell className="font-mono text-sm">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">{r.debit ? r.debit.toLocaleString('ar') : '-'}</TableCell>
                    <TableCell className="text-red-700">{r.credit ? r.credit.toLocaleString('ar') : '-'}</TableCell>
                    <TableCell>{r.bd ? r.bd.toLocaleString('ar') : '-'}</TableCell>
                    <TableCell>{r.bc ? r.bc.toLocaleString('ar') : '-'}</TableCell>
                  </TableRow>))}</TableBody>
                  </Table>
                </div>
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold text-amber-900">
                  <span>إجمالي مدين: {totals.debit.toLocaleString('ar')} {CURRENCY}</span>
                  <span>إجمالي دائن: {totals.credit.toLocaleString('ar')} {CURRENCY}</span>
                  <span>أرصدة مدينة: {totals.bd.toLocaleString('ar')}</span>
                  <span>أرصدة دائنة: {totals.bc.toLocaleString('ar')}</span>
                </div>
                </Card>
                {rows.length === 0 && <EmptyState icon={<Scale size={48} />} text="لا توجد حركات محاسبية بعد — سجّل مدفوعات أو قيودًا أولًا" />}
              </div>
            );
          })()}

          {/* Settings */}
          {section === 'settings' && (
            <div className="space-y-4"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الإعدادات</h2>
              <Card className="border-0 shadow-lg max-w-lg"><CardHeader><CardTitle>تغيير كلمة السر</CardTitle></CardHeader>
                <CardContent><SettingsPasswordForm onSave={async (data) => { await api('/api/auth/password', 'POST', data); toast.success('تم تغيير كلمة السر'); }} /></CardContent>
              </Card>
              <Card className="border-0 shadow-lg max-w-lg"><CardHeader><CardTitle>معلومات الحساب</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p><strong>الاسم:</strong> {user.name}</p><p><strong>اسم المستخدم:</strong> {user.username}</p><p><strong>الدور:</strong> {user.roleName}</p></CardContent>
              </Card>
              {user.role === 'admin' && <StorageMaintenanceCard />}
            </div>
          )}

          {/* Files */}
          {section === 'files' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الملفات والصور</h2>
                <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
              </div>
              <Card className="border-0 shadow-lg overflow-hidden"><div className="h-[600px] overflow-auto"><div className="min-w-[700px]">
                <Table><TableHeader><TableRow className="bg-orange-50 sticky top-0"><TableHead>الملف</TableHead><TableHead>النوع</TableHead><TableHead>الحجم</TableHead><TableHead>التصنيف</TableHead><TableHead>مرتبط بـ</TableHead><TableHead>التاريخ</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{allFiles.map(f => {
                  let linkedTo = '-';
                  if (f.contractId) { const c = contracts.find(x => x.id === f.contractId); linkedTo = c ? `عقد - ${c.tenant?.name || c.id.slice(0, 8)}` : 'عقد'; }
                  else if (f.tenantId) { const t = tenants.find(x => x.id === f.tenantId); linkedTo = t ? `مستأجر - ${t.name}` : 'مستأجر'; }
                  else if (f.maintenanceId) linkedTo = 'صيانة';
                  return { ...f, linkedTo };
                }).filter(f => !searchQuery || f.originalName.includes(searchQuery) || f.category.includes(searchQuery) || (f.linkedTo || '').includes(searchQuery)).map(f => (<TableRow key={f.id}>
                  <TableCell className="flex items-center gap-2"><FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} showThumbnail /><span className="text-sm">{f.originalName}</span></TableCell>
                  <TableCell className="text-xs text-gray-500">{f.mimeType}</TableCell>
                  <TableCell className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</TableCell>
                  <TableCell><Badge className="bg-blue-100 text-blue-800 text-xs">{f.category === 'identity' ? 'مدنية' : f.category === 'contract' ? 'عقد' : f.category === 'maintenance' ? 'صيانة' : f.category}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-500">{f.linkedTo || '-'}</TableCell>
                  <TableCell className="text-xs">{new Date(f.createdAt).toLocaleDateString('ar')}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} />
                    <a href={`/api/files/${f.id}`} target="_blank" className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-50 text-orange-700 hover:bg-orange-100"><Download size={12} />تحميل</a>
                    {canWriteCheck('files') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/files/${f.id}`, 'DELETE'); loadData('files'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                  </div></TableCell>
                </TableRow>))}</TableBody></Table>
              </div></div></Card>
              {allFiles.length === 0 && <EmptyState icon={<FolderOpen size={48} />} text="لا توجد ملفات مرفوعة" />}
            </div>
          )}

          {/* System Health */}
          {section === 'health' && (
            <div className="space-y-4"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">صحة النظام</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[{ icon: <CheckCircle2 size={24} className="text-emerald-600" />, label: 'حالة السيرفر', value: 'يعمل', color: 'from-emerald-500 to-teal-500' },
                  { icon: <CheckCircle2 size={24} className="text-emerald-600" />, label: 'قاعدة البيانات', value: 'متصلة', color: 'from-blue-500 to-indigo-500' },
                  { icon: <CheckCircle2 size={24} className="text-emerald-600" />, label: 'التخزين', value: 'جاهز', color: 'from-purple-500 to-pink-500' },
                  { icon: <Activity size={24} className="text-emerald-600" />, label: 'آخر فحص', value: new Date().toLocaleTimeString('ar'), color: 'from-orange-500 to-amber-500' },
                ].map((stat, i) => (
                  <Card key={i} className="border-0 shadow-lg"><div className={`h-1 bg-gradient-to-l ${stat.color}`} />
                    <CardContent className="p-5"><div className="flex items-center justify-between">
                      <div><p className="text-sm text-gray-500 mb-1">{stat.label}</p><p className="text-xl font-bold text-gray-900">{stat.value}</p></div>
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow`}>{stat.icon}</div>
                    </div></CardContent>
                  </Card>
                ))}
              </div>
              <Card className="border-0 shadow-lg"><CardHeader><CardTitle>معلومات النظام</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl"><span className="text-sm text-gray-700">الإصدار</span><span className="font-bold text-emerald-700">2.1.0</span></div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl"><span className="text-sm text-gray-700">قاعدة البيانات</span><span className="font-bold text-blue-700">PostgreSQL سحابية (Prisma)</span></div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl"><span className="text-sm text-gray-700">التخزين</span><span className="font-bold text-purple-700">سحابي مؤمّن (R2 عند الإعداد)</span></div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl"><span className="text-sm text-gray-700">المباني</span><span className="font-bold text-orange-700">{buildings.length}</span></div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl"><span className="text-sm text-gray-700">العقود النشطة</span><span className="font-bold text-amber-700">{activeContracts}</span></div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl"><span className="text-sm text-gray-700">المستخدمون</span><span className="font-bold text-red-700">{allUsers.length}</span></div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="text-sm text-gray-700">سجلات التدقيق</span><span className="font-bold text-gray-700">{auditLogs.length}</span></div>
                  <div className="flex justify-between items-center p-3 bg-teal-50 rounded-xl"><span className="text-sm text-gray-700">نقاط الاستعادة</span><span className="font-bold text-teal-700">{restorePoints.length}</span></div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg"><CardHeader><CardTitle>نظام الأمان</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /><div><p className="font-semibold text-gray-900">تشفير كلمات السر</p><p className="text-xs text-gray-500">Scrypt مع salt عشوائي لكل مستخدم</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /><div><p className="font-semibold text-gray-900">حماية من هجمات القوة الغاشمة</p><p className="text-xs text-gray-500">قفل 10 دقائق بعد 5 محاولات فاشلة</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /><div><p className="font-semibold text-gray-900">صلاحيات متعددة المستويات</p><p className="text-xs text-gray-500">5 أدوار: مدير، مدير فرعي، محاسب، محصل، مشاهد</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /><div><p className="font-semibold text-gray-900">سجل تدقيق كامل</p><p className="text-xs text-gray-500">تسجيل كل عملية: إنشاء، تعديل، حذف، دخول، رفع ملفات</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /><div><p className="font-semibold text-gray-900">نقاط استعادة</p><p className="text-xs text-gray-500">نسخ كاملة من البيانات مع إمكانية الاسترجاع</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /><div><p className="font-semibold text-gray-900">جلسات آمنة</p><p className="text-xs text-gray-500">HttpOnly cookies + Bearer tokens، تجديد تلقائي</p></div></div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg"><CardHeader><CardTitle>نظام النسخ الاحتياطية</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl"><Archive size={20} className="text-blue-600" /><div><p className="font-semibold text-gray-900">الطبقة 1 — نقاط استعادة فورية</p><p className="text-xs text-gray-500">نسخة كاملة من البيانات في أي وقت مع استرجاع فوري</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl"><Archive size={20} className="text-purple-600" /><div><p className="font-semibold text-gray-900">الطبقة 2 — نسخة قاعدة البيانات</p><p className="text-xs text-gray-500">نسخة دورية من ملف SQLite مشفرة ومقفولة ضد الحذف</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl"><Archive size={20} className="text-amber-600" /><div><p className="font-semibold text-gray-900">الطبقة 3 — نسخ خارجية</p><p className="text-xs text-gray-500">نسخ إلى تخزين خارجي كل 6 ساعات بوضع Compliance</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><Archive size={20} className="text-emerald-600" /><div><p className="font-semibold text-gray-900">الطبقة 4 — الكود على GitHub</p><p className="text-xs text-gray-500">تحكم بالنسخ والتتبع الكامل لكل تغيير</p></div></div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Login Screen
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) { setStoredToken(data.token); onLogin(); } else { setError(data.error || 'فشل'); }
    } catch { setError('خطأ في الاتصال'); } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-3xl shadow-2xl overflow-hidden border border-orange-100">
        <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-6 sm:p-10 text-white flex flex-col justify-between min-h-[420px] sm:min-h-[500px]">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur rounded-full font-bold text-sm mb-6 sm:mb-8"><Building2 size={18} /> PropertyHub</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4">إدارة عقارات<br />بأقل تعقيد</h1>
            <p className="text-white/90 text-base sm:text-lg leading-relaxed max-w-sm">نظام متكامل وآمن لإدارة المباني والوحدات والمستأجرين والعقود</p>
          </div>
          <ul className="space-y-3 mt-8">
            {[{ icon: <Shield size={18} />, text: 'نظام صلاحيات متعدد المستويات' }, { icon: <FileImage size={18} />, text: 'رفع صور العقود والمستندات' }, { icon: <Archive size={18} />, text: 'نقاط استعادة وتدقيق كامل' }, { icon: <Activity size={18} />, text: 'تتبع كل تحديث بالتفصيل' }].map((f, i) => (
              <li key={i} className="flex items-center gap-3 bg-white/12 backdrop-blur px-4 py-3 rounded-xl text-sm font-semibold"><span className="w-7 h-7 bg-white/18 rounded-lg flex items-center justify-center">{f.icon}</span>{f.text}</li>
            ))}
          </ul>
        </div>
        <div className="p-6 sm:p-10 flex items-center justify-center">
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
            <div><h2 className="text-2xl font-bold text-gray-900 mb-1">تسجيل الدخول</h2><p className="text-gray-500">مرحبًا بك، سجّل دخولك للمتابعة</p></div>
            <div><Label className="text-gray-700 font-semibold">اسم المستخدم</Label><Input value={username} onChange={e => setUsername(e.target.value)} className="mt-1 border-orange-200 focus:border-orange-500" required /></div>
            <div><Label className="text-gray-700 font-semibold">كلمة السر</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 border-orange-200 focus:border-orange-500" required /></div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold py-3 text-lg shadow-lg hover:shadow-xl transition-all">{loading ? 'جاري الدخول...' : 'دخول الآن'}</Button>
            {error && <p className="text-red-600 font-semibold text-sm text-center">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

// Setup Screen
function SetupScreen({ onSetup }: { onSetup: () => void }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, name, password }), credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) { setStoredToken(data.token); onSetup(); } else { setError(data.error || 'خطأ'); }
    } catch { setError('خطأ'); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center"><div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white mx-auto mb-4 shadow-lg"><Building2 size={32} /></div><CardTitle className="text-2xl">إعداد النظام</CardTitle><CardDescription>أنشئ حساب المدير الأول</CardDescription></CardHeader>
        <CardContent><form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>الاسم</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><Label>اسم المستخدم</Label><Input value={username} onChange={e => setUsername(e.target.value)} required /></div>
          <div><Label>كلمة السر (8 أحرف على الأقل)</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold py-3">إنشاء الحساب</Button>
          {error && <p className="text-red-600 text-sm text-center font-semibold">{error}</p>}
        </form></CardContent>
      </Card>
    </div>
  );
}

const KUWAIT_CITIES = [
  { value: 'العاصمة', label: 'العاصمة' },
  { value: 'حولي', label: 'حولي' },
  { value: 'الفروانية', label: 'الفروانية' },
  { value: 'الأحمدي', label: 'الأحمدي' },
  { value: 'الجهراء', label: 'الجهراء' },
  { value: 'مبارك الكبير', label: 'مبارك الكبير' },
  { value: 'أم صدير', label: 'أم صدير' },
  { value: 'جليب الشيوخ', label: 'جليب الشيوخ' },
];

// Reusable Form Dialog - handles open/close state and error handling
function FormDialog({ trigger, title, children, maxWidth = 'max-w-md' }: {
  trigger: React.ReactNode;
  title: string;
  children: (close: () => void) => React.ReactNode;
  maxWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={maxWidth}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

// Form Components
function BuildingForm({ onSave, initial, onClose }: { onSave: (data: any) => Promise<void>; initial?: Building; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState(initial?.code || ''); const [name, setName] = useState(initial?.name || ''); const [address, setAddress] = useState(initial?.address || ''); const [city, setCity] = useState(initial?.city || 'العاصمة'); const [floors, setFloors] = useState(String(initial?.floors || '')); const [value, setValue] = useState(String(initial?.value || '0')); const [license, setLicense] = useState(initial?.license || ''); const [notes, setNotes] = useState(initial?.notes || '');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ code, name, address, city, floors: floors ? +floors : null, value: +value, license, notes }); toast.success(initial ? 'تم تعديل المبنى' : 'تم إنشاء المبنى'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>كود العمارة</Label><Input value={code} onChange={e => setCode(e.target.value)} required /></div>
    <div><Label>اسم المبنى</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
    <div><Label>العنوان</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
    <div><Label>المدينة</Label><Select value={city} onValueChange={setCity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KUWAIT_CITIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>عدد الطوابق</Label><Input type="number" value={floors} onChange={e => setFloors(e.target.value)} /></div>
    <div><Label>القيمة الدفترية</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} /></div>
    <div><Label>رقم الترخيص / السجل العقاري</Label><Input value={license} onChange={e => setLicense(e.target.value)} /></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function UnitForm({ buildings, onSave, initial, onClose }: { buildings: Building[]; onSave: (data: any) => Promise<void>; initial?: Unit; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState(initial?.buildingId || ''); const [number, setNumber] = useState(initial?.number || ''); const [floor, setFloor] = useState(String(initial?.floor || '')); const [area, setArea] = useState(String(initial?.area || '')); const [type, setType] = useState(initial?.type || 'apartment'); const [rentAmount, setRentAmount] = useState(String(initial?.rentAmount || '')); const [notes, setNotes] = useState(initial?.notes || '');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ buildingId, number, floor: floor ? +floor : null, area: area ? +area : null, type, rentAmount: rentAmount ? +rentAmount : null, notes }); toast.success(initial ? 'تم تعديل الوحدة' : 'تم إنشاء الوحدة'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>المبنى</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="اختر المبنى" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>رقم الوحدة</Label><Input value={number} onChange={e => setNumber(e.target.value)} required /></div>
    <div><Label>الطابق</Label><Input type="number" value={floor} onChange={e => setFloor(e.target.value)} /></div>
    <div><Label>المساحة (م²)</Label><Input type="number" value={area} onChange={e => setArea(e.target.value)} /></div>
    <div><Label>النوع</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="apartment">شقة</SelectItem><SelectItem value="office">مكتب</SelectItem><SelectItem value="shop">محل</SelectItem><SelectItem value="warehouse">مستودع</SelectItem></SelectContent></Select></div>
    <div><Label>قيمة الإيجار</Label><Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} /></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function TenantForm({ onSave, initial, onClose }: { onSave: (data: any) => Promise<void>; initial?: Tenant; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name || ''); const [phone, setPhone] = useState(initial?.phone || ''); const [email, setEmail] = useState(initial?.email || ''); const [idNumber, setIdNumber] = useState(initial?.idNumber || ''); const [address, setAddress] = useState(initial?.address || ''); const [guarantor, setGuarantor] = useState((initial as any)?.guarantor || ''); const [guarantorPhone, setGuarantorPhone] = useState((initial as any)?.guarantorPhone || ''); const [notes, setNotes] = useState(initial?.notes || '');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ name, phone, email, idNumber, address, guarantor, guarantorPhone, notes }); toast.success(initial ? 'تم تعديل المستأجر' : 'تم إنشاء المستأجر'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>الاسم</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
    <div><Label>الهاتف</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
    <div><Label>البريد</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
    <div><Label>رقم الهوية</Label><Input value={idNumber} onChange={e => setIdNumber(e.target.value)} /></div>
    <div><Label>العنوان</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
    <div><Label>اسم الضامن</Label><Input value={guarantor} onChange={e => setGuarantor(e.target.value)} /></div>
    <div><Label>هاتف الضامن</Label><Input value={guarantorPhone} onChange={e => setGuarantorPhone(e.target.value)} /></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function ContractForm({ units, tenants, buildings, onSave, initial, onClose }: { units: Unit[]; tenants: Tenant[]; buildings: Building[]; onSave: (data: any) => Promise<void>; initial?: Contract; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState(initial?.unit?.buildingId || ''); const [unitId, setUnitId] = useState(initial?.unitId || ''); const [tenantId, setTenantId] = useState(initial?.tenantId || ''); const [startDate, setStartDate] = useState(initial?.startDate ? new Date(initial.startDate).toISOString().slice(0,10) : ''); const [endDate, setEndDate] = useState(initial?.endDate ? new Date(initial.endDate).toISOString().slice(0,10) : ''); const [rentAmount, setRentAmount] = useState(String(initial?.rentAmount || '')); const [deposit, setDeposit] = useState(String(initial?.deposit || '0')); const [paymentDay, setPaymentDay] = useState(String(initial?.paymentDay || '1')); const [notes, setNotes] = useState(initial?.notes || '');
  const [updateDefaultRent, setUpdateDefaultRent] = useState(false);
  const filteredUnits = buildingId ? units.filter(u => u.buildingId === buildingId) : units;
  const selectedUnit = units.find(u => u.id === unitId);
  // عند اختيار وحدة جديدة (إنشاء عقد جديد): تعبئة الإيجار الافتراضي تلقائياً — قيمة العقد قابلة للتعديل
  const handleUnitChange = (id: string) => { setUnitId(id); if (!initial) { const u = units.find(x => x.id === id); if (u?.rentAmount) setRentAmount(String(u.rentAmount)); } };
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ unitId, tenantId, startDate, endDate, rentAmount: +rentAmount, deposit: +deposit, paymentDay: +paymentDay, notes, updateDefaultRent }); toast.success(initial ? 'تم تعديل العقد' : 'تم إنشاء العقد'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>المبنى</Label><Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setUnitId(''); }}><SelectTrigger><SelectValue placeholder="اختر المبنى أولاً" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>الوحدة</Label><Select value={unitId} onValueChange={handleUnitChange}><SelectTrigger><SelectValue placeholder={buildingId ? 'اختر الوحدة' : 'اختر المبنى أولاً'} /></SelectTrigger><SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>وحدة {u.number}{u.status === 'rented' ? ' (مؤجرة)' : ''}{u.rentAmount ? ` — افتراضي ${u.rentAmount}` : ''}</SelectItem>)}</SelectContent></Select></div>
    {selectedUnit?.rentAmount && <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg">الإيجار الافتراضي للوحدة: <b>{selectedUnit.rentAmount} {CURRENCY}</b> — عدّل قيمة العقد المتفق عليها أدناه إن اختلفت، ولن تتأثر القيمة الافتراضية إلا إذا فعّلت الخيار الأخير</p>}
    <div><Label>المستأجر</Label><Select value={tenantId} onValueChange={setTenantId}><SelectTrigger><SelectValue placeholder="اختر المستأجر" /></SelectTrigger><SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>تاريخ البداية</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required /></div><div><Label>تاريخ النهاية</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required /></div></div>
    <div><Label>قيمة الإيجار المتفق عليها ({CURRENCY})</Label><Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} required /></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>التأمين</Label><Input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} /></div><div><Label>يوم الدفع الشهري</Label><Input type="number" min="1" max="28" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} /></div></div>
    {!initial && selectedUnit?.rentAmount && (<div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg"><input type="checkbox" id="updDefaultRent" checked={updateDefaultRent} onChange={e => setUpdateDefaultRent(e.target.checked)} className="w-4 h-4 mt-0.5" /><Label htmlFor="updDefaultRent" className="text-xs cursor-pointer font-normal">تحديث الإيجار الافتراضي للوحدة إلى قيمة العقد ({rentAmount || 0} {CURRENCY}) — لن يتغير أي عقد سابق</Label></div>)}
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function PaymentForm({ contracts, payments, buildings, onSave, initial, onClose }: { contracts: Contract[]; payments: Payment[]; buildings: Building[]; onSave: (data: any) => Promise<void>; initial?: Payment; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState(''); const [contractId, setContractId] = useState(initial?.contractId || ''); const [amount, setAmount] = useState(String(initial?.amount || '')); const [dueDate, setDueDate] = useState(initial?.dueDate ? new Date(initial.dueDate).toISOString().slice(0,10) : ''); const [month, setMonth] = useState(initial?.month || ''); const [method, setMethod] = useState(initial?.method || 'cash'); const [reference, setReference] = useState(initial?.reference || ''); const [notes, setNotes] = useState(initial?.notes || '');
  // اختيار متسلسل: مبنى ← عقد (مفلتر بالمبنى) ← تفاصيل المستأجر والرصيد
  const filteredContracts = buildingId ? contracts.filter(c => c.unit?.buildingId === buildingId) : contracts;
  const selected = contracts.find(c => c.id === contractId);
  const balance = selected ? contractBalance(selected as any, (selected.payments || []) as any) : null;
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ contractId, amount: +amount, dueDate, month, method, reference, notes, status: initial?.status || 'paid', paidDate: initial?.paidDate || new Date().toISOString() }); toast.success(initial ? 'تم تعديل الدفعة' : 'تم تسجيل الدفعة'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>المبنى (فلتر)</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="كل المباني" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>العقد</Label><Select value={contractId} onValueChange={setContractId}><SelectTrigger><SelectValue placeholder="اختر العقد" /></SelectTrigger><SelectContent>{filteredContracts.map(c => <SelectItem key={c.id} value={c.id}>عقد #{c.id.slice(0, 8)} — {c.tenant?.name || 'بدون مستأجر'} — وحدة {c.unit?.number || '?'}</SelectItem>)}</SelectContent></Select></div>
    {selected && balance && (<div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1 text-sm">
      <p className="font-semibold text-gray-800">{selected.tenant?.name} — وحدة {selected.unit?.number}{selected.unit?.building ? ` (${selected.unit.building.name})` : ''}</p>
      <p className="text-gray-600">الإيجار الشهري: <b>{fmtKWD(selected.rentAmount)} {CURRENCY}</b> — مدفوعات مسجلة: {(selected.payments || []).length}</p>
      <p className="text-gray-600">المستحق حتى الآن: <b>{fmtKWD(balance.totalDue)}</b> — المدفوع فعلياً: <b className="text-emerald-700">{fmtKWD(balance.totalPaid)}</b> — <span className={balance.outstanding > 0 ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}>المتبقي: {fmtKWD(balance.outstanding)} {CURRENCY}</span></p>
    </div>)}
    <div><Label>المبلغ ({CURRENCY})</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>عن شهر</Label><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div><div><Label>تاريخ الاستحقاق</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></div></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>طريقة الدفع</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="transfer">تحويل</SelectItem><SelectItem value="check">شيك</SelectItem><SelectItem value="card">بطاقة</SelectItem></SelectContent></Select></div><div><Label>رقم المرجع</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

const MAINT_CATEGORIES: Record<string, string> = {
  plumbing: 'سباكة وتمديدات مياه', electrical: 'كهرباء', ac: 'تكييف وتبريد',
  elevator: 'مصاعد', civil: 'أعمال مدنية ودهانات', cleaning: 'نظافة', other: 'أخرى',
};

function MaintenanceForm({ buildings, units, onSave, initial, onClose }: { buildings: Building[]; units: Unit[]; onSave: (data: any) => Promise<void>; initial?: MaintenanceItem; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState(initial?.unit?.buildingId || ''); const [unitId, setUnitId] = useState(initial?.unitId || ''); const [title, setTitle] = useState(initial?.title || ''); const [description, setDescription] = useState(initial?.description || ''); const [category, setCategory] = useState(initial?.category || 'other'); const [priority, setPriority] = useState(initial?.priority || 'medium'); const [estimatedCost, setEstimatedCost] = useState(String(initial?.estimatedCost ?? '')); const [cost, setCost] = useState(String(initial?.cost || ''));
  // اختيار متسلسل: مبنى ← وحداته فقط — وتصفير الوحدة عند تغيير المبنى
  const filteredUnits = buildingId ? units.filter(u => u.buildingId === buildingId) : units;
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ title, description, unitId: unitId || null, category, priority, estimatedCost: estimatedCost ? +estimatedCost : null, cost: cost ? +cost : null }); toast.success(initial ? 'تم تعديل طلب الصيانة' : 'تم إنشاء طلب الصيانة'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div><Label>المبنى</Label><Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setUnitId(''); }}><SelectTrigger><SelectValue placeholder="اختر المبنى" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>الوحدة</Label><Select value={unitId} onValueChange={setUnitId}><SelectTrigger><SelectValue placeholder={buildingId ? 'اختر الوحدة (اختياري)' : 'اختر المبنى أولاً'} /></SelectTrigger><SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>وحدة {u.number}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div><Label>عنوان الطلب</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
    <div><Label>التصنيف</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MAINT_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>الوصف</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
    <div><Label>الأولوية</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">منخفض</SelectItem><SelectItem value="medium">متوسط</SelectItem><SelectItem value="high">عالي</SelectItem><SelectItem value="urgent">عاجل</SelectItem></SelectContent></Select></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>التكلفة التقديرية ({CURRENCY})</Label><Input type="number" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} /></div><div><Label>التكلفة الفعلية ({CURRENCY})</Label><Input type="number" value={cost} onChange={e => setCost(e.target.value)} /></div></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function UserForm({ onSave, onClose }: { onSave: (data: any) => Promise<void>; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('viewer');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ name, username, password, role }); toast.success('تم إنشاء المستخدم'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>الاسم</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
    <div><Label>اسم المستخدم</Label><Input value={username} onChange={e => setUsername(e.target.value)} required /></div>
    <div><Label>كلمة السر</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
    <div><Label>الدور</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">مدير</SelectItem><SelectItem value="manager">مدير فرعي</SelectItem><SelectItem value="accountant">محاسب</SelectItem><SelectItem value="collector">محصّل</SelectItem><SelectItem value="viewer">مشاهد</SelectItem></SelectContent></Select></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function SettingsPasswordForm({ onSave, onClose }: { onSave: (data: any) => Promise<void>; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState(''); const [newPassword, setNewPassword] = useState('');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ oldPassword, newPassword }); setOldPassword(''); setNewPassword(''); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>كلمة السر الحالية</Label><Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required /></div>
    <div><Label>كلمة السر الجديدة</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'تغيير'}</Button>
  </form>);
}

// كرت إدارة التخزين السحابي — للمدير: فحص R2 مباشرة + نقل ملفات قاعدة البيانات إلى السحابة بضغطة
function StorageMaintenanceCard() {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setStatus(await api<any>('/api/debug/storage')); } catch (e: any) { setStatus({ error: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const dbCount: number = status?.dbFiles?.count ?? 0;
  const dbBytes: number = status?.dbFiles?.totalBytes ?? 0;
  const steps: any[] = status?.steps || [];
  const r2Ok = steps.length > 0 && steps.every((s) => s.ok);
  const firstError = steps.find((s) => !s.ok)?.error;
  const migrate = async () => {
    setBusy(true);
    try {
      const res: any = await api('/api/files/migrate-to-r2', 'POST');
      if (res.failed?.length) toast.warning(`نُقل ${res.migrated?.length || 0} — فشل ${res.failed.length}: ${res.failed[0]?.error || ''}`);
      else toast.success(res.note || 'تم نقل الملفات إلى السحابة');
      await load();
    } catch (e: any) { toast.error(e.message || 'فشل الترحيل'); }
    finally { setBusy(false); }
  };
  return (
    <Card className="border-0 shadow-lg max-w-lg"><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><CloudUpload size={20} className="text-purple-600" />التخزين السحابي (Cloudflare R2)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {status?.error && <p className="text-sm text-red-600">{status.error}</p>}
        {status && !status.error && (<>
          <div className="flex items-center gap-2 text-sm">
            {r2Ok ? <><CheckCircle2 size={16} className="text-emerald-600" /><span>الاتصال بالتخزين السحابي يعمل بشكل صحيح</span></>
              : status.configured === false ? <><AlertTriangle size={16} className="text-amber-600" /><span>متغيرات R2 غير مكتملة في هذا النشر</span></>
              : <><XCircle size={16} className="text-red-600" /><span>مشكلة في التخزين السحابي: {firstError || 'غير معروفة'}</span></>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600"><Archive size={16} /><span>ملفات محفوظة مؤقتًا في قاعدة البيانات: <strong>{dbCount}</strong> ({(dbBytes / 1024).toFixed(0)} KB)</span></div>
          {dbCount > 0 && (r2Ok
            ? <Button type="button" disabled={busy} onClick={migrate} className="w-full bg-gradient-to-l from-purple-500 to-indigo-500 text-white font-bold">{busy ? 'جاري النقل...' : `نقل ${dbCount} ملف إلى السحابة`}</Button>
            : <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">صلّح إعدادات R2 في Vercel أولاً — زر النقل يُفعّل تلقائياً عندما يعمل الاتصال</p>)}
          {dbCount === 0 && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2">قاعدة البيانات خفيفة — كل الملفات على السحابة ✅</p>}
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={busy} className="w-full text-gray-600"><RefreshCw size={14} className="ml-1" />إعادة فحص الحالة</Button>
        </>)}
        {!status && <p className="text-sm text-gray-400">جاري فحص حالة التخزين...</p>}
      </CardContent>
    </Card>
  );
}

function TransactionForm({ buildings, onSave, initial, onClose }: { buildings: Building[]; onSave: (data: any) => Promise<void>; initial?: any; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10)); const [buildingId, setBuildingId] = useState(initial?.buildingId || ''); const [type, setType] = useState(initial?.type || 'income'); const [category, setCategory] = useState(initial?.category || ''); const [amount, setAmount] = useState(String(initial?.amount || ''));
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ date, buildingId: buildingId || null, type, category, amount: +amount }); toast.success(initial ? 'تم تعديل الحركة' : 'تم إنشاء الحركة المالية'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>التاريخ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
    <div><Label>العمارة</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="اختر العمارة (اختياري)" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>النوع</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">إيراد</SelectItem><SelectItem value="expense">مصروف</SelectItem></SelectContent></Select></div>
    <div><Label>البيان</Label><Input value={category} onChange={e => setCategory(e.target.value)} /></div>
    <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function LoanForm({ buildings, onSave, initial, onClose }: { buildings: Building[]; onSave: (data: any) => Promise<void>; initial?: any; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name || ''); const [buildingId, setBuildingId] = useState(initial?.buildingId || ''); const [principal, setPrincipal] = useState(String(initial?.principal || '')); const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10)); const [rate, setRate] = useState(String(initial?.rate || '')); const [months, setMonths] = useState(String(initial?.months || ''));
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ name, buildingId: buildingId || null, principal: +principal, date, rate: +rate, months: +months }); toast.success(initial ? 'تم تعديل القرض' : 'تم إنشاء القرض'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>اسم القرض</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
    <div><Label>العمارة (اختياري)</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="اختر العمارة" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>المبلغ</Label><Input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} required /></div>
    <div><Label>التاريخ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
    <div><Label>نسبة الفائدة %</Label><Input type="number" step="0.1" value={rate} onChange={e => setRate(e.target.value)} required /></div>
    <div><Label>المدة (شهور)</Label><Input type="number" value={months} onChange={e => setMonths(e.target.value)} required /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function AccountForm({ accounts, onSave, initial, onClose }: { accounts: any[]; onSave: (data: any) => Promise<void>; initial?: any; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState(initial?.code || ''); const [name, setName] = useState(initial?.name || ''); const [type, setType] = useState(initial?.type || 'asset'); const [kind, setKind] = useState(initial?.kind || 'post'); const [parentId, setParentId] = useState(initial?.parent || '');
  const groupAccounts = accounts.filter((a: any) => a.kind === 'group');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ code, name, type, kind, parent: parentId || null }); toast.success('تم إنشاء الحساب'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>رقم الحساب</Label><Input value={code} onChange={e => setCode(e.target.value)} required /></div>
    <div><Label>اسم الحساب</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
    <div><Label>النوع</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asset">أصول</SelectItem><SelectItem value="liability">التزامات</SelectItem><SelectItem value="equity">حقوق الملكية</SelectItem><SelectItem value="revenue">إيرادات</SelectItem><SelectItem value="expense">مصروفات</SelectItem></SelectContent></Select></div>
    <div><Label>التصنيف</Label><Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="group">رئيسي</SelectItem><SelectItem value="post">فرعي</SelectItem></SelectContent></Select></div>
    <div><Label>الحساب الأب</Label><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue placeholder="اختر الحساب الأب (اختياري)" /></SelectTrigger><SelectContent>{groupAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent></Select></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function JournalForm({ accounts, buildings, onSave, onClose, initial }: { accounts: any[]; onSave: (data: any) => Promise<void>; buildings: Building[]; onClose?: () => void; initial?: any }) {
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10)); const [description, setDescription] = useState(initial?.description || ''); const [buildingId, setBuildingId] = useState(initial?.buildingId || '');
  const [lines, setLines] = useState<{ accountId: string; debit: string; credit: string }[]>(() => {
    if (initial?.lines?.length) {
      return initial.lines.map((l: any) => ({
        accountId: accounts.find((a: any) => a.id === l.accountId)?.id || accounts.find((a: any) => a.code === l.accountCode)?.id || '',
        debit: l.debit ? String(l.debit) : '',
        credit: l.credit ? String(l.credit) : '',
      }));
    }
    return [{ accountId: '', debit: '', credit: '' }];
  });
  const postAccounts = accounts.filter((a: any) => a.kind === 'post');
  const addLine = () => setLines([...lines, { accountId: '', debit: '', credit: '' }]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: string, value: string) => { const updated = [...lines]; (updated[i] as any)[field] = value; setLines(updated); };
  // مؤشر التوازن: مجموع المدين مقابل الدائن لحظيًا
  const totalDebit = lines.reduce((s, l) => s + (+l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (+l.credit || 0), 0);
  const balanced = totalDebit > 0 && Math.round(totalDebit * 1000) === Math.round(totalCredit * 1000);
  const allAccountsChosen = lines.every(l => l.accountId);
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ date, description, buildingId: buildingId || null, lines: lines.map(l => ({ accountId: l.accountId, debit: l.debit ? +l.debit : 0, credit: l.credit ? +l.credit : 0 })) }); toast.success(initial ? 'تم تعديل القيد' : 'تم إنشاء القيد اليومي'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>التاريخ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
    <div><Label>البيان</Label><Input value={description} onChange={e => setDescription(e.target.value)} required /></div>
    {initial?.source && initial.source !== 'manual' && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">هذا قيد تلقائي مرتبط بعملية مالية ({SOURCE_LABELS[initial.source] || 'تلقائي'}) — التعديل يدويًا ممكن، لكن سيعاد توليده تلقائيًا عند أي تعديل مستقبلي على العملية الأصلية</p>}
    <div><Label>العمارة (اختياري)</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="اختر العمارة" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2">
      <div className="flex items-center justify-between"><Label>القيود</Label><Button type="button" variant="outline" size="sm" onClick={addLine} className="border-orange-200 text-orange-700"><Plus size={14} className="ml-1" />إضافة سطر</Button></div>
      {lines.map((line, i) => (<div key={i} className="flex gap-2 items-end">
        <div className="flex-1"><Label className="text-xs">الحساب</Label><Select value={line.accountId} onValueChange={v => updateLine(i, 'accountId', v)}><SelectTrigger className="h-9"><SelectValue placeholder="حساب" /></SelectTrigger><SelectContent>{postAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-24"><Label className="text-xs">مدين</Label><Input type="number" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} className="h-9" /></div>
        <div className="w-24"><Label className="text-xs">دائن</Label><Input type="number" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} className="h-9" /></div>
        <Button type="button" variant="ghost" size="sm" className="text-red-500 h-9" onClick={() => removeLine(i)}><Trash2 size={14} /></Button>
      </div>))}
    </div>
    <div className={`p-2.5 rounded-xl text-sm flex items-center justify-between ${balanced ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
      <span>مدين: <b>{totalDebit.toLocaleString('ar')}</b> — دائن: <b>{totalCredit.toLocaleString('ar')}</b></span>
      <span className="font-semibold">{balanced ? 'القيد متوازن ✓' : 'غير متوازن بعد'}</span>
    </div>
    <Button type="submit" disabled={saving || !balanced || !allAccountsChosen} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : (!balanced || !allAccountsChosen ? 'أكمل السطور ووازن القيد للحفظ' : 'حفظ')}</Button>
  </form>);
}

// نموذج تسجيل قسط قرض — أصل + فائدة (يولّد قيد سداد تلقائي في المحاسبة)
function LoanPaymentForm({ loanName, onSave, onClose }: { loanName?: string; onSave: (data: any) => Promise<void>; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [notes, setNotes] = useState('');
  const total = (+principal || 0) + (+interest || 0);
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ date, principal: +principal || 0, interest: +interest || 0, notes: notes || null }); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    {loanName && <p className="text-sm text-gray-600 bg-orange-50 rounded-lg p-2.5">القرض: <b>{loanName}</b></p>}
    <div><Label>تاريخ السداد</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>الأصل المسدد ({CURRENCY})</Label><Input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="0" /></div>
      <div><Label>الفائدة المسددة ({CURRENCY})</Label><Input type="number" value={interest} onChange={e => setInterest(e.target.value)} placeholder="0" /></div>
    </div>
    <p className="text-xs text-gray-500">الإجمالي المُسدد من البنك: <b className="text-gray-800">{total.toLocaleString('ar')} {CURRENCY}</b> — سيولّد قيد محاسبي تلقائي (مدين أصل القرض {`+`} الفوائد / دائن البنك)</p>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving || total <= 0} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : (total <= 0 ? 'أدخل مبلغ الأصل أو الفائدة' : 'حفظ القسط')}</Button>
  </form>);
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (<div className="flex flex-col items-center justify-center py-14 px-6 text-center"><div className="mb-4 w-20 h-20 rounded-3xl bg-orange-100/70 text-orange-400 flex items-center justify-center shadow-inner">{icon}</div><p className="text-lg font-semibold text-gray-500">{text}</p></div>);
}

// File Preview Dialog - with inline thumbnail support
function FilePreviewDialog({ fileId, fileName, mimeType, showThumbnail, triggerLabel }: { fileId: string; fileName: string; mimeType: string; showThumbnail?: boolean; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const url = `/api/files/${fileId}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerLabel ? (
          <Button variant="outline" size="sm" className="border-orange-200 text-orange-700" title={fileName}><Eye size={14} className="ml-1" />{triggerLabel}</Button>
        ) : showThumbnail && isImage ? (
          <button type="button" className="relative group cursor-pointer" title={fileName}>
            <img src={url} alt={fileName} className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm group-hover:shadow-md transition" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition flex items-center justify-center"><Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition" /></div>
          </button>
        ) : (
          <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-800 hover:bg-orange-50" title="معاينة"><Eye size={14} /></Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileImage size={18} />{fileName}</DialogTitle></DialogHeader>
        <div className="mt-2 overflow-auto" style={{ maxHeight: '70vh' }}>
          {isImage && <img src={url} alt={fileName} className="max-w-full max-h-[70vh] mx-auto rounded-lg shadow" />}
          {isPdf && <iframe src={url} className="w-full border-0 rounded-lg" style={{ height: '70vh' }} title={fileName} />}
          {!isImage && !isPdf && <div className="text-center py-12 text-gray-500"><FileImage size={48} className="mx-auto mb-3 opacity-50" /><p>لا يمكن معاينة هذا النوع من الملفات</p><a href={url} target="_blank" className="text-orange-600 hover:underline mt-2 inline-block">تحميل الملف</a></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// زر رفع ملفات — يشغّل حوار اختيار الملف مباشرة عبر ref
// (نمط <label> المحتوي <Button> معطّل في المتصفحات: الزر يبتلع الضغطة ولا يفتح قائمة الملفات)
function FileUploadButton({ onPick, icon, className, children }: {
  onPick: (file: File) => void;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = ''; // السماح بإعادة اختيار نفس الملف بعد فشل محتمل
        }}
      />
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => inputRef.current?.click()}>
        {icon}
        {children}
      </Button>
    </>
  );
}

// Inline file attachments display with thumbnails
function FileAttachments({ files, onUpload, canUpload }: { files: FileUpload[]; onUpload?: (file: File) => void; canUpload?: boolean }) {
  if (files.length === 0 && !canUpload) return null;
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {files.map(f => (
        <span key={f.id} className="inline-flex items-center gap-1">
          <FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} showThumbnail />
          <span className="text-xs text-gray-500 max-w-[80px] truncate" title={f.originalName}>{f.originalName}</span>
        </span>
      ))}
      {canUpload && onUpload && (
        <FileUploadButton className="border-orange-200 text-orange-700 text-xs h-7" icon={<Upload size={12} className="ml-1" />} onPick={(file) => onUpload(file)}>رفع</FileUploadButton>
      )}
    </div>
  );
}

// Permissions Editor Component
const PERM_ENTITIES = [
  { key: 'buildings', label: 'المباني' },
  { key: 'units', label: 'الوحدات' },
  { key: 'tenants', label: 'المستأجرين' },
  { key: 'contracts', label: 'العقود' },
  { key: 'payments', label: 'المدفوعات' },
  { key: 'maintenance', label: 'الصيانة' },
  { key: 'files', label: 'الملفات' },
  { key: 'transactions', label: 'الإيرادات والمصروفات' },
  { key: 'loans', label: 'القروض' },
  { key: 'accounts', label: 'الحسابات' },
  { key: 'journal', label: 'القيود' },
  { key: 'users', label: 'المستخدمين' },
  { key: 'restore', label: 'الاستعادة' },
];

function PermissionsEditor({ currentPerms, onSave, onClose }: { currentPerms: string; onSave: (perms: string) => Promise<void>; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean>>(() => { try { return JSON.parse(currentPerms); } catch { return {}; } });
  const toggle = (key: string) => setPerms(p => ({ ...p, [key]: !p[key] }));
  return (<div className="space-y-3">
    <p className="text-sm text-gray-500">حدد الصلاحيات الممنوحة لهذا المستخدم (الصلاحيات الافتراضية للدور تُطبّق إذا لم يتم تحديد)</p>
    <div className="grid grid-cols-2 gap-2">
      {PERM_ENTITIES.map(e => (
        <button key={e.key} type="button" onClick={() => toggle(e.key)} className={`flex items-center gap-2 p-2.5 rounded-xl text-sm transition ${perms[e.key] ? 'bg-emerald-50 border border-emerald-300 text-emerald-800' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
          {perms[e.key] ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-gray-400" />}{e.label}
        </button>
      ))}
    </div>
    <Button disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold" onClick={async () => { setSaving(true); try { await onSave(JSON.stringify(perms)); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }}>{saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}</Button>
  </div>);
}

// محتوى القائمة الجانبية — مشترك بين الديسكتوب ودرج الموبايل
function SidebarContent({ user, section, isAdmin, onNavigate, onLogout }: {
  user: User; section: Section; isAdmin: boolean;
  onNavigate: (s: Section) => void; onLogout: () => void;
}) {
  const navItems: { key: Section; icon: React.ReactNode; label: string; admin?: boolean }[] = [
    { key: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'لوحة التحكم' },
    { key: 'buildings', icon: <Building2 size={20} />, label: 'المباني' },
    { key: 'units', icon: <Home size={20} />, label: 'الوحدات' },
    { key: 'tenants', icon: <Users size={20} />, label: 'المستأجرين' },
    { key: 'contracts', icon: <FileText size={20} />, label: 'العقود' },
    { key: 'payments', icon: <DollarSign size={20} />, label: 'المدفوعات' },
    { key: 'maintenance', icon: <Wrench size={20} />, label: 'الصيانة' },
    { key: 'files', icon: <FolderOpen size={20} />, label: 'الملفات' },
    { key: 'transactions', icon: <DollarSign size={20} />, label: 'الإيرادات والمصروفات' },
    { key: 'loans', icon: <Briefcase size={20} />, label: 'القروض' },
    { key: 'accounts', icon: <Hash size={20} />, label: 'شجرة الحسابات', admin: true },
    { key: 'journal', icon: <FileText size={20} />, label: 'القيود اليومية', admin: true },
    { key: 'trialBalance', icon: <Scale size={20} />, label: 'ميزان المراجعة', admin: true },
    { key: 'audit', icon: <Activity size={20} />, label: 'سجل التدقيق', admin: true },
    { key: 'restore', icon: <Archive size={20} />, label: 'نقاط الاستعادة', admin: true },
    { key: 'health', icon: <Activity size={20} />, label: 'صحة النظام', admin: true },
    { key: 'users', icon: <Shield size={20} />, label: 'المستخدمون', admin: true },
    { key: 'settings', icon: <Settings size={20} />, label: 'الإعدادات' },
  ];
  return (<>
    <div className="p-5 border-b border-orange-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
          <Building2 size={22} className="text-white" />
        </div>
        <div><h1 className="font-bold text-lg text-orange-900">PropertyHub</h1><p className="text-xs text-orange-600">نظام إدارة العقارات</p></div>
      </div>
    </div>
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {navItems.filter(n => !n.admin || isAdmin).map(item => (
        <button key={item.key} onClick={() => onNavigate(item.key)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${section === item.key ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'}`}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </nav>
    <div className="p-4 border-t border-orange-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">{user.name.charAt(0)}</div>
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p><p className="text-xs text-orange-600">{user.roleName}</p></div>
      </div>
      <Button variant="outline" size="sm" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50" onClick={onLogout}><LogOut size={16} className="ml-2" />تسجيل الخروج</Button>
    </div>
  </>);
}

// كارت قرض متكامل: البيانات + شريط السداد + سجل الأقساط + السندات في مكان واحد
function LoanCard({ loan, buildingName, installments, canWrite, buildings, refresh }: {
  loan: any; buildingName?: string; installments: any[]; canWrite: boolean;
  buildings: Building[]; refresh: (action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const principal = Number(loan.principal) || 0;
  const paidPrincipal = installments.reduce((s, lp) => s + (Number(lp.principal) || 0), 0);
  const paidInterest = installments.reduce((s, lp) => s + (Number(lp.interest) || 0), 0);
  const remaining = Math.max(0, principal - paidPrincipal);
  const pct = principal > 0 ? Math.min(100, Math.round((paidPrincipal / principal) * 100)) : 0;
  const done = principal > 0 && remaining <= 0;
  return (
    <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      <div className={`h-1.5 bg-gradient-to-l ${done ? 'from-emerald-500 to-teal-500' : 'from-purple-500 to-violet-500'}`} />
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* رأس الكارت: الاسم + الشارات + الإجراءات */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 bg-gradient-to-br ${done ? 'from-emerald-500 to-teal-500' : 'from-purple-500 to-violet-500'}`}>
              <Briefcase size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{loan.name}</h3>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {buildingName && <Badge className="bg-orange-100 text-orange-800 text-[11px]">{buildingName}</Badge>}
                <Badge className="bg-purple-100 text-purple-800 text-[11px]">فائدة {loan.rate}%</Badge>
                <Badge className="bg-blue-100 text-blue-800 text-[11px]">{loan.months} شهر</Badge>
                <Badge className="bg-gray-100 text-gray-700 text-[11px]">{new Date(loan.date).toLocaleDateString('ar')}</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند استلام القرض"><Printer size={14} /></Button>} title="سند قبض — استلام قرض" docHtml={loanReceiptHtml(loan, CURRENCY)} />
            {canWrite && (<>
              <FormDialog trigger={<Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50" title="تسجيل قسط"><DollarSign size={14} /></Button>} title={`تسجيل قسط — ${loan.name}`}>{(close) => <LoanPaymentForm loanName={loan.name} onSave={async (data) => { await api('/api/loan-payments', 'POST', { ...data, loanId: loan.id }); refresh('قسط قرض'); toast.success('تم تسجيل القسط وتوليد القيد المحاسبي'); }} onClose={close} />}</FormDialog>
              <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل القرض">{(close) => <LoanForm buildings={buildings} initial={loan} onSave={async (data) => { await api(`/api/loans/${loan.id}`, 'PUT', data); refresh('تعديل قرض'); }} onClose={close} />}</FormDialog>
              <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/loans/${loan.id}`, 'DELETE'); refresh('حذف قرض'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>
            </>)}
          </div>
        </div>
        {/* شريط نسبة السداد */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">نسبة سداد الأصل</span>
            <span className={`font-bold ${done ? 'text-emerald-700' : 'text-purple-700'}`}>{pct}%{done && ' — مُسدد بالكامل ✓'}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-l ${done ? 'from-emerald-500 to-teal-500' : 'from-purple-500 to-violet-500'} transition-all duration-500`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        {/* إحصائيات القرض */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-purple-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">أصل القرض</p><p className="text-sm sm:text-base font-bold text-purple-700">{fmtKWD(principal)}</p></div>
          <div className="p-2.5 bg-emerald-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">المسدد من الأصل</p><p className="text-sm sm:text-base font-bold text-emerald-700">{fmtKWD(paidPrincipal)}</p></div>
          <div className="p-2.5 bg-red-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">المتبقي</p><p className="text-sm sm:text-base font-bold text-red-700">{fmtKWD(remaining)}</p></div>
          <div className="p-2.5 bg-amber-50 rounded-xl text-center"><p className="text-[11px] text-gray-600">فوائد مسددة</p><p className="text-sm sm:text-base font-bold text-amber-700">{fmtKWD(paidInterest)}</p></div>
        </div>
        {/* سجل الأقساط + سند صرف لكل قسط */}
        {installments.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-bold text-gray-700 hover:text-purple-700 transition">
              <span className="flex items-center gap-2"><Clock size={15} className="text-purple-600" />سجل الأقساط ({installments.length})</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="mt-2.5 space-y-2">
                {installments.map((lp: any) => (
                  <div key={lp.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{new Date(lp.date).toLocaleDateString('ar')}</p>
                      <p className="text-[11px] text-gray-500">أصل {fmtKWD(lp.principal)} • فوائد {fmtKWD(lp.interest)} • إجمالي <b className="text-gray-700">{fmtKWD((Number(lp.principal) || 0) + (Number(lp.interest) || 0))} {CURRENCY}</b></p>
                    </div>
                    <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50 shrink-0" title="سند صرف — قسط قرض"><Printer size={14} /></Button>} title="سند صرف — قسط قرض" docHtml={loanPaymentVoucherHtml(lp, loan.name, CURRENCY)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
