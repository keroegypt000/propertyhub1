'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { buildingIncomeStats, totalIncomeStats, contractBalance, collectedStats, arrearsOfContracts, effectiveRent, fmtKWD } from '@/lib/calc';
import { SOURCE_LABELS } from '@/lib/accounting';
import {
  VoucherDialog, printHtmlDoc,
  paymentReceiptHtml, loanReceiptHtml, loanPaymentVoucherHtml,
  maintenanceVoucherHtml, transactionVoucherHtml,
  supplierPaymentVoucherHtml, rentInvoiceHtml,
  voucherRegisterDocHtml, RegisterRow,
  journalEntryDocHtml, journalBookDocHtml, trialBalanceDocHtml, TBRow,
  buildingFinancialReportHtml, buildingUnitsDocHtml,
} from '@/components/print-docs';
import {
  Building2, Home, Users, FileText, DollarSign, Wrench, Shield, Clock,
  Upload, Download, Trash2, Edit3, Plus, Search, Eye, Lock, LogOut,
  ChevronDown, ChevronLeft, RefreshCw, AlertTriangle, CheckCircle2,
  XCircle, Calendar, Phone, Mail, MapPin, Hash, Briefcase, Settings,
  Archive, Activity, UserPlus, Key, ToggleLeft, ToggleRight, Info,
  LayoutDashboard, FolderOpen, Camera, FileImage, CloudUpload, Printer, Scale,
  Menu, X, Percent, TrendingUp, Gavel, ArrowRight, Landmark, ReceiptText,
  MousePointerClick, ArrowLeft, History, Truck
} from 'lucide-react';
import { ExcelToolbar } from '@/components/ExcelToolbar';
import { ResetDemoDataCard } from '@/components/ResetDemoDataCard';
import { AnimatedNumber, LiveBadge, UnitsDonutChart, BuildingsBarChart, MonthlyTrendChart } from '@/components/DashboardLive';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableFooter, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

// Types
interface User { id: string; username: string; name: string; role: string; roleName: string; permissions?: string; }
interface Building { id: string; code?: string; name: string; address?: string; city?: string; floors?: number; unitsCount?: number; value?: number; license?: string; notes?: string; units?: Unit[]; transactions?: any[]; createdAt: string; }
interface Unit { id: string; buildingId: string; number: string; floor?: number; area?: number; type?: string; status: string; rentAmount?: number; notes?: string; building?: Building; createdAt: string; }
interface Tenant { id: string; name: string; tenantType?: string; commercialReg?: string; phone?: string; email?: string; idNumber?: string; idType?: string; address?: string; guarantor?: string | null; guarantorPhone?: string | null; notes?: string; uploads?: FileUpload[]; createdAt: string; }
interface Payment { id: string; contractId: string; amount: number; dueDate: string; paidDate?: string; month?: string; status: string; method?: string; reference?: string; notes?: string; invoiceNo?: string | null; receiptNo?: string | null; contract?: Contract; createdAt: string; }
interface MaintenanceItem { id: string; title: string; description?: string; priority: string; status: string; cost?: number; estimatedCost?: number; category?: string; assignedTo?: string; unitId?: string; unit?: Unit; buildingId?: string; building?: Building; attachments?: FileUpload[]; completedAt?: string | null; paymentNo?: string | null; createdAt: string; }
interface Contract { id: string; unitId: string; tenantId: string; startDate: string; endDate: string; rentAmount: number; discount?: number | null; deposit?: number; paymentDay?: number; status: string; terms?: string; notes?: string; number?: string | null; unit?: Unit; tenant?: Tenant; payments?: Payment[]; attachments?: FileUpload[]; createdAt: string; }
interface FileUpload { id: string; filename: string; originalName: string; mimeType: string; size: number; category: string; docType?: string; contractId?: string; tenantId?: string; maintenanceId?: string; buildingId?: string; legalCaseId?: string; createdAt: string; }
interface LegalCase { id: string; title: string; type: string; reference?: string; buildingId?: string; building?: Building; unitId?: string; unit?: Unit; tenantId?: string; tenant?: Tenant; status: string; filedDate?: string; hearingDate?: string; amount?: number; description?: string; notes?: string; attachments?: FileUpload[]; createdAt: string; }
interface AuditEntry { id: string; userId: string; action: string; entity: string; entityId?: string; changes?: string; details?: string; createdAt: string; user?: { id: string; name: string; username: string }; }
interface RestorePoint { id: string; name: string; description?: string; createdBy: string; createdAt: string; creator?: { id: string; name: string; username: string }; }

const CURRENCY = 'د.ك'; // Kuwaiti Dinar

type Section = 'dashboard' | 'buildings' | 'buildingDetail' | 'units' | 'tenants' | 'contracts' | 'payments' | 'suppliers' | 'maintenance' | 'legalCases' | 'files' | 'transactions' | 'loans' | 'loanPayments' | 'voucherRegister' | 'accounts' | 'journal' | 'trialBalance' | 'audit' | 'restore' | 'health' | 'users' | 'settings';

const TENANT_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  individual: { label: 'فرد / عائلة', color: 'bg-teal-100 text-teal-800' },
  company: { label: 'شركة', color: 'bg-indigo-100 text-indigo-800' },
};
const CASE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  municipal: { label: 'مخالفة بلدية', color: 'bg-amber-100 text-amber-800' },
  lawsuit: { label: 'قضية', color: 'bg-purple-100 text-purple-800' },
  other: { label: 'أخرى', color: 'bg-gray-100 text-gray-700' },
};
const CASE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'مفتوحة', color: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'قيد المتابعة', color: 'bg-blue-100 text-blue-800' },
  paid: { label: 'مسددة', color: 'bg-emerald-100 text-emerald-800' },
  closed: { label: 'مغلقة', color: 'bg-gray-100 text-gray-700' },
};
const LEGAL_DOC_TYPES: Record<string, string> = {
  property_deed: 'وثيقة العقار',
  license: 'ترخيص بلدي / سجل عقاري',
  occupancy: 'شهادة إشغال',
  blueprint: 'مخطط العمارة',
  other: 'مستند آخر',
};
const CASH_ACCOUNT_LABEL: Record<string, string> = { cash: 'الصندوق', bank: 'البنك', checks: 'شيكات التحصيل' };

const ROLES_MAP: Record<string, string> = { admin: 'مدير', manager: 'مدير فرعي', accountant: 'محاسب', collector: 'محصّل', viewer: 'مشاهد' };
const UNIT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  available: { label: 'متاحة', color: 'bg-emerald-100 text-emerald-800' },
  rented: { label: 'مؤجرة', color: 'bg-blue-100 text-blue-800' },
  maintenance: { label: 'صيانة', color: 'bg-amber-100 text-amber-800' },
  reserved: { label: 'محجوزة', color: 'bg-purple-100 text-purple-800' },
};
const UNIT_TYPE_LABEL: Record<string, string> = { apartment: 'شقة', studio: 'استوديو', office: 'مكتب', shop: 'محل', warehouse: 'مستودع' };
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
  const [txType, setTxType] = useState<'all' | 'income' | 'expense'>('all');
  const [allFiles, setAllFiles] = useState<FileUpload[]>([]);
  const [legalCases, setLegalCases] = useState<LegalCase[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [tenantStatusFilter, setTenantStatusFilter] = useState<'all' | 'current' | 'former'>('all');
  // فلتر سجل السندات: الكل / قبض / صرف — بحث بالرقم التسلسلي أو الطرف أو البيان
  const [regKindFilter, setRegKindFilter] = useState<'all' | 'قبض' | 'صرف'>('all');
  const [supplierPayFilter, setSupplierPayFilter] = useState('all');
  const [detailBuildingId, setDetailBuildingId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [contractFilter, setContractFilter] = useState('all');
  // وصول سريع من كرت المستأجر إلى عقوده في صفحة العقود (فلتر مستأجر مستمر)
  const [contractTenantId, setContractTenantId] = useState('');
  // وصول سريع من كرت الوحدة إلى عقد الوحدة في صفحة العقود (فلتر وحدة مستمر)
  const [contractUnitId, setContractUnitId] = useState('');
  // وصول سريع من العقد/المستأجر إلى الوحدة نفسها في صفحة الوحدات
  const [unitFocusId, setUnitFocusId] = useState('');
  // ===== فلاتر الصفحات — تُضبط من لوحة التحكم (روابط عميقة) أو من داخل كل صفحة =====
  const [unitStatusFilter, setUnitStatusFilter] = useState('all');       // all | available | rented | maintenance | reserved
  const [unitBuildingFilter, setUnitBuildingFilter] = useState('all');   // all | buildingId
  const [buildingCityFilter, setBuildingCityFilter] = useState('all');   // all | city
  const [contractBuildingFilter, setContractBuildingFilter] = useState('all'); // all | buildingId
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all'); // all | pending | paid | partial | overdue | cancelled
  const [maintStatusFilter, setMaintStatusFilter] = useState('all');     // all | open_active | open | in_progress | completed | cancelled
  const [maintPriorityFilter, setMaintPriorityFilter] = useState('all'); // all | low | medium | high | urgent
  const [tenantTypeFilter, setTenantTypeFilter] = useState('all');       // all | individual | company
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // عدد سجلات كل قسم — يغذي شارات القائمة الجانبية (endpoint خفيف واحد /api/counts)
  const [counts, setCounts] = useState<Record<string, number>>({});
  // التنقل العادي (القائمة الجانبية) يعيد فلاتر القسم الهدف لوضعها الافتراضي
  // الفلاتر العابرة للأقسام القديمة (unitFocusId وcontractTenantId وcontractUnitId وcontractFilter) تبقى كما هي لعدم كسر الروابط السريعة الموجودة
  const go = (s: Section, presetSearch?: string) => {
    setSection(s); setSearchQuery(presetSearch ?? ''); setMobileNavOpen(false);
    if (s === 'units') { setUnitStatusFilter('all'); setUnitBuildingFilter('all'); }
    if (s === 'buildings') setBuildingCityFilter('all');
    if (s === 'contracts') setContractBuildingFilter('all');
    if (s === 'payments') setPaymentStatusFilter('all');
    if (s === 'maintenance') { setMaintStatusFilter('all'); setMaintPriorityFilter('all'); }
    if (s === 'tenants') setTenantTypeFilter('all');
    if (s === 'voucherRegister') setRegKindFilter('all');
  };
  // روابط عميقة من لوحة التحكم — تفتح الصفحة بفلتر جاهز (تُضبط بعد إعادة الضبط في go فتغلبها)
  const goUnits = (status = 'all', buildingId = 'all') => { go('units'); setUnitStatusFilter(status); setUnitBuildingFilter(buildingId); };
  const goMaintenance = (status = 'all') => { go('maintenance'); setMaintStatusFilter(status); };
  const goPayments = (status = 'all') => { go('payments'); setPaymentStatusFilter(status); };
  // فتح صفحة تفاصيل العمارة — النقر على كارت العمارة يفتحها بتبويب النظرة العامة
  const goBuildingDetail = (id: string, tab = 'overview') => { setDetailBuildingId(id); setDetailTab(tab); setSection('buildingDetail'); setSearchQuery(''); setMobileNavOpen(false); };

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

  const refreshCounts = useCallback(async () => {
    try { setCounts(await api<Record<string, number>>('/api/counts')); } catch { /* الأعداد تحسين عرض — فشلها لا يعطل شيء */ }
  }, []);

  const loadData = useCallback(async (s: Section) => {
    try {
      if (s === 'buildings') {
        // تحميل كامل للبيانات التي تعتمد عليها لوحة الإيرادات (متوقع + محصل + مصروفات القيود)
        const [b, u, c, p, j] = await Promise.all([
          api<Building[]>('/api/buildings'), api<Unit[]>('/api/units'),
          api<Contract[]>('/api/contracts'), api<Payment[]>('/api/payments').catch(() => []),
          api('/api/journal').catch(() => []),
        ]);
        setBuildings(b); setUnits(u); setContracts(c); setPayments(p); setJournalEntries(j as any);
      }
      if (s === 'units') { setUnits(await api<Unit[]>('/api/units')); setContracts(await api<Contract[]>('/api/contracts').catch(() => [])); }
      if (s === 'tenants') {
        const [t, c, p, lc] = await Promise.all([
          api<Tenant[]>('/api/tenants'), api<Contract[]>('/api/contracts'),
          api<Payment[]>('/api/payments').catch(() => []), api('/api/legal-cases').catch(() => []),
        ]);
        setTenants(t); setContracts(c); setPayments(p); setLegalCases(lc as any);
      }
      if (s === 'contracts') setContracts(await api<Contract[]>('/api/contracts'));
      if (s === 'payments') { setPayments(await api<Payment[]>('/api/payments')); setContracts(await api<Contract[]>('/api/contracts')); }
      if (s === 'suppliers') {
        const [sp, sPay, b, ac] = await Promise.all([
          api('/api/suppliers'), api('/api/supplier-payments').catch(() => []),
          api('/api/buildings').catch(() => []), api('/api/accounts').catch(() => []),
        ]);
        setSuppliers(sp as any); setSupplierPayments(sPay as any); setBuildings(b as Building[]); setAccounts(ac as any);
      }
      if (s === 'maintenance') setMaintenance(await api<MaintenanceItem[]>('/api/maintenance'));
      if (s === 'files') { setAllFiles(await api<FileUpload[]>('/api/files/all')); setContracts(await api<Contract[]>('/api/contracts')); setTenants(await api<Tenant[]>('/api/tenants')); }
      if (s === 'audit') { const data = await api<{ logs: AuditEntry[] }>('/api/audit?limit=100'); setAuditLogs(data.logs || []); }
      if (s === 'restore') setRestorePoints(await api<RestorePoint[]>('/api/restore'));
      if (s === 'users') setAllUsers(await api('/api/users'));
      if (s === 'transactions') { setTransactions(await api('/api/transactions')); setBuildings(await api('/api/buildings')); setAccounts(await api('/api/accounts')); }
      if (s === 'legalCases') setLegalCases(await api('/api/legal-cases'));
      if (s === 'buildingDetail') {
        const [b, u, c, t, m, tr, jr, ac, fl, p] = await Promise.all([
          api<Building[]>('/api/buildings'), api<Unit[]>('/api/units'), api<Contract[]>('/api/contracts'),
          api<Tenant[]>('/api/tenants'), api<MaintenanceItem[]>('/api/maintenance'), api('/api/transactions'),
          api('/api/journal').catch(() => []), api('/api/accounts').catch(() => []), api<FileUpload[]>('/api/files/all').catch(() => []),
          api<Payment[]>('/api/payments').catch(() => []),
        ]);
        setBuildings(b); setUnits(u); setContracts(c); setTenants(t); setMaintenance(m); setTransactions(tr);
        setJournalEntries(jr); setAccounts(ac); setAllFiles(fl); setPayments(p);
        try { setLegalCases(await api('/api/legal-cases')); } catch {}
      }
      if (s === 'loans') { setLoans(await api('/api/loans')); setLoanPayments(await api('/api/loan-payments')); }
      if (s === 'voucherRegister') {
        // سجل السندات: يجمع سندات القبض والصرف من كل المصادر في جدول واحد
        const [p, tr, lo, lp, sp, m, b] = await Promise.all([
          api<Payment[]>('/api/payments').catch(() => []),
          api('/api/transactions').catch(() => []),
          api('/api/loans').catch(() => []),
          api('/api/loan-payments').catch(() => []),
          api('/api/supplier-payments').catch(() => []),
          api<MaintenanceItem[]>('/api/maintenance').catch(() => []),
          api('/api/buildings').catch(() => []),
        ]);
        setPayments(p); setTransactions(tr as any); setLoans(lo as any); setLoanPayments(lp as any);
        setSupplierPayments(sp as any); setMaintenance(m); setBuildings(b as Building[]);
      }
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
          api('/api/journal').catch(() => []),
        ]);
        const [b, u, t, c, p, m, tr, ac, lo, lp, jr] = results.map((r, i) => {
          if (r.status === 'fulfilled') return r.value;
          console.warn(`Dashboard API ${i} failed:`, r.reason);
          return [];
        });
        setBuildings(b); setUnits(u); setTenants(t); setContracts(c); setPayments(p); setMaintenance(m); setTransactions(tr); setAccounts(ac); setLoans(lo); setLoanPayments(lp); setJournalEntries(jr);
        setLastUpdated(new Date());
      }
      // بعد أي تحميل بيانات: حدّث شارات العدد في القائمة الجانبية (طلب خفيف واحد)
      refreshCounts();
    } catch (e: any) {
      // Re-check auth before logging out - don't immediately logout on data errors
      if (e.message === 'unauthorized') {
        try { await api<User>('/api/auth/me'); } catch { clearStoredToken(); setUser(null); return; }
        toast.error('خطأ في تحميل البيانات');
        return;
      }
      toast.error(e.message);
    }
  }, [refreshCounts]);

  useEffect(() => { if (user) loadData(section); }, [user, section, loadData]);

  // ترقيم السجلات القديمة تلقائيًا مرة واحدة بعد الدخول — يمنح كل سند/عقد/فاتورة قديمة رقمه التسلسلي
  // العملية آمنة وقابلة للتكرار (idempotent) على السيرفر — لا يمس أي سجل له رقم بالفعل
  const backfillDoneRef = useRef(false);
  useEffect(() => {
    if (!user || backfillDoneRef.current) return;
    backfillDoneRef.current = true;
    api<{ total: number }>('/api/numbers/backfill', 'POST', {})
      .then((r) => { if (r.total > 0) { loadData(section); } })
      .catch(() => { backfillDoneRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // البث الحي: تحديث لوحة التحكم تلقائيًا كل 60 ثانية
  useEffect(() => {
    if (user && section === 'dashboard') {
      const t = setInterval(() => { loadData('dashboard'); }, 60000);
      return () => clearInterval(t);
    }
  }, [user, section, loadData]);

  // تفريغ البيانات من الذاكرة بعد مسح البيانات التجريبية
  const clearAllData = () => {
    setBuildings([]); setUnits([]); setTenants([]); setContracts([]); setPayments([]); setMaintenance([]);
    setTransactions([]); setLoans([]); setLoanPayments([]); setAccounts([]); setJournalEntries([]); setAllFiles([]); setLegalCases([]);
    setSuppliers([]); setSupplierPayments([]);
    refreshCounts();
  };

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
  const uploadFile = useCallback(async (file: File, category: string, meta?: { contractId?: string; tenantId?: string; maintenanceId?: string; buildingId?: string; legalCaseId?: string; docType?: string }) => {
    const processed = await compressImage(file);
    if (processed.size > 4 * 1024 * 1024) throw new Error('حجم الملف كبير جداً — الحد الأقصى 4MB. الصور تُضغط تلقائياً، والمستندات الكبيرة قلّل حجمها أولاً');
    const buf = await processed.arrayBuffer();
    const headers: Record<string, string> = { 'X-Filename': encodeURIComponent(processed.name), 'X-Category': category };
    if (meta?.contractId) headers['X-Contract-Id'] = meta.contractId;
    if (meta?.tenantId) headers['X-Tenant-Id'] = meta.tenantId;
    if (meta?.maintenanceId) headers['X-Maintenance-Id'] = meta.maintenanceId;
    if (meta?.buildingId) headers['X-Building-Id'] = meta.buildingId;
    if (meta?.legalCaseId) headers['X-Legal-Case-Id'] = meta.legalCaseId;
    if (meta?.docType) headers['X-Doc-Type'] = meta.docType;
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

  // ===== القوائم المفلترة — مصدر واحد للفلاتر تستهلكه الصفحات ولوحة التحكم معًا =====
  const buildingCities = Array.from(new Set(buildings.map(b => (b.city || '').trim()).filter(Boolean))).sort();
  const filteredBuildings = buildings.filter(b => (buildingCityFilter === 'all' || (b.city || '').trim() === buildingCityFilter) && (!searchQuery || b.name.includes(searchQuery) || (b.code || '').includes(searchQuery) || (b.city || '').includes(searchQuery) || (b.address || '').includes(searchQuery)));
  const filteredUnits = units.filter(u => (!unitFocusId || u.id === unitFocusId) && (unitStatusFilter === 'all' || u.status === unitStatusFilter) && (unitBuildingFilter === 'all' || u.buildingId === unitBuildingFilter) && (!searchQuery || u.number.includes(searchQuery) || (u.building?.name || '').includes(searchQuery) || u.status.includes(searchQuery)));
  const filteredContracts = contracts.filter(c => (contractFilter === 'all' || c.status === contractFilter) && (!contractTenantId || c.tenantId === contractTenantId) && (!contractUnitId || c.unitId === contractUnitId) && (contractBuildingFilter === 'all' || c.unit?.buildingId === contractBuildingFilter) && (!searchQuery || (c.tenant?.name || '').includes(searchQuery) || (c.number || '').includes(searchQuery) || (c.unit?.number || '').includes(searchQuery) || (c.unit?.building?.name || '').includes(searchQuery) || c.status.includes(searchQuery)));
  const filteredPayments = payments.filter(p => (paymentStatusFilter === 'all' || p.status === paymentStatusFilter) && (!searchQuery || p.status.includes(searchQuery) || (p.method || '').includes(searchQuery) || String(p.amount).includes(searchQuery) || (p.receiptNo || '').includes(searchQuery) || (p.invoiceNo || '').includes(searchQuery)));
  const filteredMaintenance = maintenance.filter(m => (maintStatusFilter === 'all' || (maintStatusFilter === 'open_active' ? ['open', 'in_progress'].includes(m.status) : m.status === maintStatusFilter)) && (maintPriorityFilter === 'all' || m.priority === maintPriorityFilter) && (!searchQuery || m.title.includes(searchQuery) || m.status.includes(searchQuery) || m.priority.includes(searchQuery)));
  const filteredTenants = tenants.filter(t => (tenantTypeFilter === 'all' || (t.tenantType || 'individual') === tenantTypeFilter) && (tenantStatusFilter === 'all' || (tenantStatusFilter === 'current') === contracts.some(c => c.tenantId === t.id && ['active', 'renewed'].includes(c.status))) && (!searchQuery || t.name.includes(searchQuery) || (t.phone || '').includes(searchQuery) || (t.idNumber || '').includes(searchQuery)));

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
        <SidebarContent user={user} section={section} isAdmin={isAdmin} onNavigate={go} onLogout={handleLogout} counts={counts} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-screen w-64 bg-white/80 backdrop-blur-xl border-l border-orange-200 shadow-xl flex-col shrink-0">
        <SidebarContent user={user} section={section} isAdmin={isAdmin} onNavigate={go} onLogout={handleLogout} counts={counts} />
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

            // Arrears: مجموع الأرصدة المستحقة فعليًا على العقود النشطة (المستحق حتى اليوم − المدفوع)
            // = نفس منطق contractBalance المعروض في صفحة العقود — يشمل العقود المدفوعة جزئيًا وغير المدفوعة
            const arrearsAmount = contracts
              .filter(c => c.status === 'active' || c.status === 'renewed')
              .reduce((s, c) => s + contractBalance(c as any, (c.payments || []) as any).outstanding, 0);

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

            // Building comparison data: نفس نظام لوحة الإيرادات الجديد لكل عمارة (متوقع/محصل/متأخرات/مصروفات/صافي) + الحركات المسجلة للرسم البياني
            const buildingComparison = buildings.map(b => {
              const bUnits = units.filter(u => u.buildingId === b.id);
              const buIds = new Set(bUnits.map(u => u.id));
              const bc = contracts.filter(c => buIds.has(c.unitId));
              const bcIds = new Set(bc.map(c => c.id));
              const bp = payments.filter(p => bcIds.has(p.contractId));
              const coll = collectedStats(bp as any);
              const bIncome = transactions.filter((t: any) => t.buildingId === b.id && t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
              const bExpense = transactions.filter((t: any) => t.buildingId === b.id && t.type === 'expense').reduce((s: number, t: any) => s + (t.amount || 0), 0);
              const bExpJournal = journalEntries.filter((e: any) => e.buildingId === b.id).reduce((s2: number, e: any) => s2 + (e.lines || []).filter((l: any) => String(l.accountCode).startsWith('5')).reduce((s3: number, l: any) => s3 + (Number(l.debit) || 0), 0), 0);
                const bStats = buildingIncomeStats(units as any, contracts as any, b.id);
              return {
                ...b, unitCount: bUnits.length,
                expectedMonthly: bStats.expectedMonthly,
                contractGross: bStats.contractGrossMonthly,
                contractDiscount: bStats.contractDiscountMonthly,
                contractNet: bStats.contractedMonthly,
                collectedAnnual: coll.annual,
                arrears: arrearsOfContracts(bc as any),
                expenses: bExpJournal,
                netRent: coll.total - bExpJournal,
                income: bIncome, expense: bExpense,
              };
            });

            // Arrears by tenant: لكل عقد نشط — الرصيد المستحق من contractBalance (المستحق حتى اليوم − المدفوع)
            const arrearsByTenant = contracts.filter(c => c.status === 'active' || c.status === 'renewed').map(c => {
              const bal = contractBalance(c as any, (c.payments || []) as any);
              return {
                tenantName: c.tenant?.name || '-',
                unitNumber: c.unit?.number || '-',
                buildingName: c.unit?.building?.name || '-',
                buildingId: c.unit?.buildingId || (c.unit?.building as any)?.id || null,
                rentAmount: c.rentAmount,
                dueMonths: c.rentAmount > 0 ? Math.round((bal.outstanding / c.rentAmount) * 10) / 10 : 0,
                totalDue: bal.totalDue,
                totalPaid: bal.totalPaid,
                arrears: bal.outstanding,
              };
            }).filter(a => a.arrears > 0).sort((a, b) => b.arrears - a.arrears);

            // Expiring contracts: within 30 days or already expired
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const expiringContracts = contracts.filter(c => {
              if (c.status !== 'active' && c.status !== 'expired') return false;
              const end = new Date(c.endDate);
              return end <= thirtyDaysFromNow;
            }).map(c => ({
              ...c,
              buildingId: c.unit?.buildingId || (c.unit?.building as any)?.id || null,
              isExpired: new Date(c.endDate) < now,
            }));

            const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            return (
            <div className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-wrap">
                <div className="flex items-center gap-3 flex-wrap"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">لوحة التحكم</h2><Badge className="bg-orange-100 text-orange-800">{new Date().toLocaleDateString('ar')}</Badge></div>
                <LiveBadge lastUpdated={lastUpdated} onRefresh={() => loadData('dashboard')} />
              </div>

              {/* وصول سريع — إرشاد */}
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                <MousePointerClick size={15} className="text-orange-500 shrink-0" />
                <span><b className="text-orange-700">وصول سريع:</b> اضغط على أي مربع أو رقم أو صف في اللوحة للانتقال مباشرة إلى الشاشة التي يُحسب منها الرقم</span>
              </div>

              {/* KPI Cards — المؤشرات التشغيلية (المالي في لوحة الإيرادات تحته) — كل بطاقة تنقل إلى مصدرها */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {[
                  { icon: <Building2 size={22} />, label: 'عدد العمارات', num: buildingCount, decimals: 0, color: 'from-orange-500 to-amber-500', dest: 'المباني', onClick: () => go('buildings') },
                  { icon: <Home size={22} />, label: 'عدد الوحدات', num: unitCount, decimals: 0, color: 'from-blue-500 to-indigo-500', dest: 'الوحدات', onClick: () => goUnits('all') },
                  { icon: <Home size={22} />, label: 'وحدات شاغرة', num: vacantUnits, decimals: 0, color: 'from-teal-500 to-cyan-500', dest: 'الوحدات الشاغرة', onClick: () => goUnits('available') },
                  { icon: <Activity size={22} />, label: 'نسبة الإشغال', num: occupancyRate, decimals: 0, suffix: '%', color: 'from-emerald-500 to-green-500', dest: 'الوحدات المؤجرة', onClick: () => goUnits('rented') },
                  { icon: <Wrench size={22} />, label: 'صيانة مفتوحة', num: openMaintCount, decimals: 0, color: 'from-amber-500 to-yellow-500', dest: 'طلبات الصيانة المفتوحة', onClick: () => goMaintenance('open_active') },
                  { icon: <Briefcase size={22} />, label: 'رصيد القروض', num: loanBalance, decimals: 2, suffix: ' د.ك', color: 'from-purple-500 to-violet-500', dest: 'القروض', onClick: () => go('loans') },
                ].map((stat, i) => (
                  <Card key={i} onClick={stat.onClick} title={`اضغط للانتقال إلى ${stat.dest}`} className="border-0 shadow-lg overflow-hidden hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer group">
                    <div className={`h-1 bg-gradient-to-l ${stat.color}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0"><p className="text-xs text-gray-500 mb-1 whitespace-nowrap">{stat.label}</p><p className="text-lg sm:text-xl font-bold text-gray-900 truncate"><AnimatedNumber value={stat.num} decimals={stat.decimals} suffix={stat.suffix || ''} /></p></div>
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-md shrink-0`}>{stat.icon}</div>
                          <ArrowLeft size={12} className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white shadow text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* لوحة الإيرادات — نفس نظام صفحة المباني: المتوقع فوق والفعلي والمصروفات والمتأخرات وصافي الإيجار تحته */}
              {(() => {
                const coll = collectedStats(payments as any);
                const dArrears = arrearsAmount;
                const dExpenses = journalEntries.reduce((s2: number, e: any) => s2 + (e.lines || []).filter((l: any) => String(l.accountCode).startsWith('5')).reduce((s3: number, l: any) => s3 + (Number(l.debit) || 0), 0), 0);
                const dNet = coll.total - dExpenses;
                const dExpected = totalIncomeStats(units as any, contracts as any, buildings.map(b => b.id));
                return (
                <Card className="border-0 shadow-lg"><CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3"><DollarSign size={20} className="text-emerald-600" /><h3 className="font-bold text-gray-900">لوحة الإيرادات — كل العمارات مجتمعة</h3></div>
                  <p className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1"><TrendingUp size={13} />إيرادات العقود — قبل الخصم / الخصم / الصافي</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    <button type="button" onClick={() => go('buildings')} title="مجموع إيجار العقود النشطة قبل الخصم — عرض حسب العمارة" className="p-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-center border border-emerald-100 hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">قبل الخصم شهرياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(dExpected.contractGrossMonthly)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">سنوياً: {fmtKWD(dExpected.contractGrossMonthly * 12)} {CURRENCY} — العقود النشطة</p></button>
                    <button type="button" onClick={() => go('buildings')} title="مجموع إيجار العقود النشطة سنوياً قبل الخصم — عرض حسب العمارة" className="p-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-center border border-emerald-100 hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">قبل الخصم سنوياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(dExpected.contractGrossMonthly * 12)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">شهرياً: {fmtKWD(dExpected.contractGrossMonthly)} {CURRENCY} — العقود النشطة</p></button>
                    <button type="button" onClick={() => go('contracts')} title="الانتقال إلى العقود — مصدر إجمالي الخصم" className="p-3 bg-orange-50 hover:bg-orange-100 rounded-xl text-center border border-orange-100 hover:border-orange-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">إجمالي الخصم شهرياً</p><p className="text-lg font-bold text-orange-700">{fmtKWD(dExpected.contractDiscountMonthly)} {CURRENCY}</p><p className="text-[10px] text-orange-600 mt-1 opacity-70">سنوياً: {fmtKWD(dExpected.contractDiscountMonthly * 12)} {CURRENCY} — العقود النشطة</p></button>
                    <button type="button" onClick={() => go('contracts')} title="الانتقال إلى العقود — الإيجار الفعلي الذي يصلك بعد الخصم" className="p-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-center border-2 border-emerald-400 hover:border-emerald-500 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">صافي الربح بعد الخصم شهرياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(dExpected.contractedMonthly)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">سنوياً: {fmtKWD(dExpected.contractedAnnual)} {CURRENCY} — العقود النشطة</p></button>
                    <button type="button" onClick={() => goUnits('all')} title="الانتقال إلى قائمة الوحدات" className="p-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-center border border-blue-100 hover:border-blue-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">جميع الوحدات</p><p className="text-lg font-bold text-blue-700">{unitCount}</p><p className="text-[10px] text-blue-600 mt-1 opacity-70">قائمة الوحدات ↩</p></button>
                    <button type="button" onClick={() => goUnits('rented')} title="الانتقال إلى قائمة الوحدات المؤجرة" className="p-3 bg-teal-50 hover:bg-teal-100 rounded-xl text-center border border-teal-100 hover:border-teal-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">الوحدات المؤجرة</p><p className="text-lg font-bold text-teal-700">{rentedUnits}</p><p className="text-[10px] text-teal-600 mt-1 opacity-70">الوحدات المؤجرة ↩</p></button>
                    <button type="button" onClick={() => goUnits('maintenance')} title="الانتقال إلى قائمة الوحدات تحت الصيانة" className="p-3 bg-amber-50 hover:bg-amber-100 rounded-xl text-center border border-amber-100 hover:border-amber-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">وحدات تحت الصيانة</p><p className="text-lg font-bold text-amber-700">{units.filter(u => u.status === 'maintenance').length}</p><p className="text-[10px] text-amber-600 mt-1 opacity-70">وحدات الصيانة ↩</p></button>
                  </div>
                  <p className="text-[11px] font-bold text-indigo-700 mt-4 mb-2 flex items-center gap-1"><ReceiptText size={13} />الإيرادات الفعلية والمصروفات</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <button type="button" onClick={() => goPayments('paid')} title="الانتقال إلى المدفوعات المسددة — مصدر المحصل" className="p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-center border border-indigo-100 hover:border-indigo-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">المحصل شهرياً</p><p className="text-lg font-bold text-indigo-700">{fmtKWD(coll.monthly)} {CURRENCY}</p><p className="text-[10px] text-indigo-600 mt-1 opacity-70">المدفوعات المسددة ↩</p></button>
                    <button type="button" onClick={() => goPayments('paid')} title="الانتقال إلى المدفوعات المسددة — مصدر المحصل" className="p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-center border border-indigo-100 hover:border-indigo-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">المحصل سنوياً</p><p className="text-lg font-bold text-indigo-700">{fmtKWD(coll.annual)} {CURRENCY}</p><p className="text-[10px] text-indigo-600 mt-1 opacity-70">المدفوعات المسددة ↩</p></button>
                    <button type="button" onClick={() => { setContractFilter('active'); go('contracts'); }} title="الانتقال إلى العقود النشطة — مصدر المتأخرات (رصيد كل عقد)" className="p-3 bg-amber-50 hover:bg-amber-100 rounded-xl text-center border border-amber-100 hover:border-amber-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">المتأخرات (متبقي مستحق)</p><p className={`text-lg font-bold ${dArrears > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtKWD(dArrears)} {CURRENCY}</p><p className="text-[10px] text-amber-600 mt-1 opacity-70">أرصدة العقود النشطة ↩</p></button>
                    <button type="button" onClick={() => go('journal')} title="الانتقال إلى قيود اليومية — مصدر المصروفات (حسابات 5xxx)" className="p-3 bg-red-50 hover:bg-red-100 rounded-xl text-center border border-red-100 hover:border-red-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">المصروفات (قيود)</p><p className="text-lg font-bold text-red-700">{fmtKWD(dExpenses)} {CURRENCY}</p><p className="text-[10px] text-red-600 mt-1 opacity-70">قيود اليومية ↩</p></button>
                    <button type="button" onClick={() => go('trialBalance')} title="الانتقال إلى ميزان المراجعة — تجميع الإيرادات والمصروفات" className="p-3 bg-teal-50 hover:bg-teal-100 rounded-xl text-center border border-teal-100 hover:border-teal-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"><p className="text-[11px] text-gray-600">صافي الإيجار (محصل − مصروفات)</p><p className={`text-lg font-bold ${dNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtKWD(dNet)} {CURRENCY}</p><p className="text-[10px] text-teal-600 mt-1 opacity-70">ميزان المراجعة ↩</p></button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">قبل الخصم = مجموع إيجار العقود النشطة كما هي مكتوبة في العقود • إجمالي الخصم = مجموع الخصومات الشهرية على العقود النشطة • صافي الربح بعد الخصم = قبل الخصم − الخصم — اللي بتلمه فعلاً • المحصل = الدفعات الفعلية المسددة حسب تاريخ الدفع • المتأخرات = المتبقي المستحق غير المحصل على العقود النشطة • المصروفات = مصروفات مسجلة بالقيود المحاسبية • صافي الإيجار = المحصل الكلي − المصروفات — العملة {CURRENCY}</p>
                </CardContent></Card>
                );
              })()}

              {/* الرسوم التفاعلية الحية — Recharts (الحركات المالية المسجلة) — عناوين قابلة للضغط */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="border-0 shadow-lg lg:col-span-2 cursor-pointer hover:shadow-xl transition-shadow" onClick={() => go('transactions')} title="اضغط للانتقال إلى الحركات المالية">
                  <CardHeader className="pb-0"><CardTitle className="text-lg flex items-center gap-2"><TrendingUp size={20} className="text-emerald-600" />حركة الحركات المالية المسجلة — آخر 6 أشهر<span className="text-[11px] font-normal text-emerald-600 mr-auto">فتح الحركات ↩</span></CardTitle></CardHeader>
                  <CardContent><MonthlyTrendChart transactions={transactions} /></CardContent>
                </Card>
                <Card className="border-0 shadow-lg cursor-pointer hover:shadow-xl transition-shadow" onClick={() => goUnits('all')} title="اضغط للانتقال إلى الوحدات">
                  <CardHeader className="pb-0"><CardTitle className="text-lg flex items-center gap-2"><Home size={20} className="text-blue-600" />حالات الوحدات<span className="text-[11px] font-normal text-blue-600 mr-auto">فتح الوحدات ↩</span></CardTitle></CardHeader>
                  <CardContent><UnitsDonutChart units={units} /></CardContent>
                </Card>
              </div>
              <Card className="border-0 shadow-lg cursor-pointer hover:shadow-xl transition-shadow" onClick={() => go('transactions')} title="اضغط للانتقال إلى الحركات المالية">
                <CardHeader className="pb-0"><CardTitle className="text-lg flex items-center gap-2"><Building2 size={20} className="text-orange-600" />الحركات المالية المسجلة لكل عمارة<span className="text-[11px] font-normal text-orange-600 mr-auto">فتح الحركات ↩</span></CardTitle></CardHeader>
                <CardContent><BuildingsBarChart data={buildingComparison.map(b => ({ name: b.name, إيرادات: b.income, مصروفات: b.expense }))} /></CardContent>
              </Card>

              {/* مقارنة العمارات - نفس نظام لوحة الإيرادات */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Building2 size={20} className="text-blue-600" />مقارنة العمارات — قبل الخصم / الخصم / الصافي / محصل / متأخرات / مصروفات / صافي</CardTitle></CardHeader>
                <CardContent>
                  {buildingComparison.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow className="bg-orange-50">
                          <TableHead>الكود</TableHead>
                          <TableHead>العمارة</TableHead>
                          <TableHead>الوحدات</TableHead>
                          <TableHead>قبل الخصم (عقود)</TableHead>
                          <TableHead>الخصم الشهري</TableHead>
                          <TableHead>صافي التعاقدي (بعد الخصم)</TableHead>
                          <TableHead>المحصل سنوياً</TableHead>
                          <TableHead>المتأخرات</TableHead>
                          <TableHead>المصروفات</TableHead>
                          <TableHead>صافي الإيجار</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>{buildingComparison.map(b => (
                          <TableRow key={b.id} onClick={() => goBuildingDetail(b.id)} title="اضغط لفتح صفحة العمارة بالتفاصيل الكاملة" className="cursor-pointer hover:bg-orange-50 transition-colors">
                            <TableCell className="font-mono text-sm">{b.code || b.id.slice(0, 8)}</TableCell>
                            <TableCell className="font-medium">{b.name}</TableCell>
                            <TableCell>{b.unitCount}</TableCell>
                            <TableCell className="text-emerald-700 font-semibold">{fmt(b.contractGross)}</TableCell>
                            <TableCell className="text-orange-700 font-semibold">{fmt(b.contractDiscount)}</TableCell>
                            <TableCell className="text-emerald-700 font-bold">{fmt(b.contractNet)}</TableCell>
                            <TableCell className="text-indigo-700 font-semibold">{fmt(b.collectedAnnual)}</TableCell>
                            <TableCell className={b.arrears > 0 ? 'text-red-700 font-semibold' : 'text-emerald-700'}>{fmt(b.arrears)}</TableCell>
                            <TableCell className="text-red-700 font-semibold">{fmt(b.expenses)}</TableCell>
                            <TableCell className={b.netRent >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{fmt(b.netRent)}</TableCell>
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
                            <TableRow key={i} onClick={() => a.buildingId ? goBuildingDetail(a.buildingId, 'contracts') : go('contracts')} title="اضغط لفتح عقود هذه العمارة — مصدر المتأخرات" className="cursor-pointer hover:bg-red-50 transition-colors">
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
                            <TableRow key={c.id} onClick={() => c.buildingId ? goBuildingDetail(c.buildingId, 'contracts') : go('contracts')} title="اضغط لفتح عقود هذه العمارة" className="cursor-pointer hover:bg-amber-50 transition-colors">
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
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Wrench size={20} className="text-orange-600" />آخر طلبات الصيانة</span><button type="button" onClick={() => go('maintenance')} className="text-xs font-semibold text-orange-600 hover:text-orange-800 hover:underline">عرض الكل ↩</button></CardTitle></CardHeader>
                <CardContent><div className="space-y-2">
                  {maintenance.slice(0, 5).map(m => (
                    <div key={m.id} onClick={() => m.buildingId ? goBuildingDetail(m.buildingId, 'units') : go('maintenance')} title="اضغط لفتح وحدات هذه العمارة" className="flex items-center justify-between p-2 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المباني</h2><PageCount n={filteredBuildings.length} label="عمارة" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="buildings" rows={buildings} canWrite={canWriteCheck('buildings')} onImported={() => { loadData('buildings'); toast.success('تم تحديث قائمة العمارات'); }} />
                  {canWriteCheck('buildings') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة مبنى</Button>} title="إضافة مبنى جديد">{(close) => <BuildingForm onSave={async (data) => { await api('/api/buildings', 'POST', data); autoRestore('إضافة مبنى'); loadData('buildings'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* فلتر المدينة */}
              {buildingCities.length > 0 && (
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={13} />المدينة:</span>
                  <Select value={buildingCityFilter} onValueChange={setBuildingCityFilter}>
                    <SelectTrigger className="h-9 w-[170px] text-xs border-orange-200 bg-white rounded-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المدن ({buildings.length})</SelectItem>
                      {buildingCities.map(city => <SelectItem key={city} value={city}>{city} ({buildings.filter(b => (b.city || '').trim() === city).length})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* لوحة الإيرادات — السطر الأول المتوقع وتحته الإيرادات الفعلية والمصروفات والمتأخرات وصافي الإيجار — كل العمارات مجتمعة */}
              {buildings.length > 0 && (() => {
                const t = totalIncomeStats(units as any, contracts as any, buildings.map(b => b.id));
                const coll = collectedStats(payments as any);
                const arrears = arrearsOfContracts(contracts as any);
                const expenses = (journalEntries as any[]).reduce((s2, e) => s2 + (e.lines || []).filter((l: any) => String(l.accountCode).startsWith('5')).reduce((s3: number, l: any) => s3 + (Number(l.debit) || 0), 0), 0);
                const netRent = coll.total - expenses;
                const allUnitsCount = units.length;
                const rentedCount = units.filter(u => u.status === 'rented').length;
                const maintCount = units.filter(u => u.status === 'maintenance').length;
                return (
                <Card className="border-0 shadow-lg"><CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3"><DollarSign size={20} className="text-emerald-600" /><h3 className="font-bold text-gray-900">لوحة الإيرادات — كل العمارات مجتمعة</h3></div>
                  <p className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1"><TrendingUp size={13} />إيرادات العقود — قبل الخصم / الخصم / الصافي</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    <div className="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100"><p className="text-[11px] text-gray-600">قبل الخصم شهرياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(t.contractGrossMonthly)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">سنوياً: {fmtKWD(t.contractGrossMonthly * 12)} {CURRENCY} — العقود النشطة</p></div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100"><p className="text-[11px] text-gray-600">قبل الخصم سنوياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(t.contractGrossMonthly * 12)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">شهرياً: {fmtKWD(t.contractGrossMonthly)} {CURRENCY} — العقود النشطة</p></div>
                    <div className="p-3 bg-orange-50 rounded-xl text-center border border-orange-100"><p className="text-[11px] text-gray-600">إجمالي الخصم شهرياً</p><p className="text-lg font-bold text-orange-700">{fmtKWD(t.contractDiscountMonthly)} {CURRENCY}</p><p className="text-[10px] text-orange-600 mt-1 opacity-70">سنوياً: {fmtKWD(t.contractDiscountMonthly * 12)} {CURRENCY} — العقود النشطة</p></div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center border-2 border-emerald-400"><p className="text-[11px] text-gray-600">صافي الربح بعد الخصم شهرياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(t.contractedMonthly)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">سنوياً: {fmtKWD(t.contractedAnnual)} {CURRENCY} — العقود النشطة</p></div>
                    <div className="p-3 bg-blue-50 rounded-xl text-center border border-blue-100"><p className="text-[11px] text-gray-600">جميع الوحدات</p><p className="text-lg font-bold text-blue-700">{allUnitsCount}</p></div>
                    <div className="p-3 bg-teal-50 rounded-xl text-center border border-teal-100"><p className="text-[11px] text-gray-600">الوحدات المؤجرة</p><p className="text-lg font-bold text-teal-700">{rentedCount}</p></div>
                    <div className="p-3 bg-amber-50 rounded-xl text-center border border-amber-100"><p className="text-[11px] text-gray-600">وحدات تحت الصيانة</p><p className="text-lg font-bold text-amber-700">{maintCount}</p></div>
                  </div>
                  <p className="text-[11px] font-bold text-indigo-700 mt-4 mb-2 flex items-center gap-1"><ReceiptText size={13} />الإيرادات الفعلية والمصروفات</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="p-3 bg-indigo-50 rounded-xl text-center border border-indigo-100"><p className="text-[11px] text-gray-600">المحصل شهرياً</p><p className="text-lg font-bold text-indigo-700">{fmtKWD(coll.monthly)} {CURRENCY}</p></div>
                    <div className="p-3 bg-indigo-50 rounded-xl text-center border border-indigo-100"><p className="text-[11px] text-gray-600">المحصل سنوياً</p><p className="text-lg font-bold text-indigo-700">{fmtKWD(coll.annual)} {CURRENCY}</p></div>
                    <div className="p-3 bg-amber-50 rounded-xl text-center border border-amber-100"><p className="text-[11px] text-gray-600">المتأخرات (متبقي مستحق)</p><p className={`text-lg font-bold ${arrears > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtKWD(arrears)} {CURRENCY}</p></div>
                    <div className="p-3 bg-red-50 rounded-xl text-center border border-red-100"><p className="text-[11px] text-gray-600">المصروفات (قيود)</p><p className="text-lg font-bold text-red-700">{fmtKWD(expenses)} {CURRENCY}</p></div>
                    <div className="p-3 bg-teal-50 rounded-xl text-center border border-teal-100"><p className="text-[11px] text-gray-600">صافي الإيجار (محصل − مصروفات)</p><p className={`text-lg font-bold ${netRent >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtKWD(netRent)} {CURRENCY}</p></div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">قبل الخصم = مجموع إيجار العقود النشطة لجميع العمارات كما هي مكتوبة • إجمالي الخصم = مجموع الخصومات الشهرية • صافي الربح بعد الخصم = قبل الخصم − الخصم — اللي بتلمه فعلاً • المحصل = الدفعات الفعلية المسددة (نقدية + شيكات شركات مجمّعة) حسب تاريخ الدفع • المتأخرات = المتبقي المستحق غير المحصل على العقود النشطة • المصروفات = مصروفات مسجلة بالقيود المحاسبية • صافي الإيجار = المحصل الكلي − المصروفات — العملة {CURRENCY}</p>
                </CardContent></Card>
                ); })()}
              <div className="grid gap-4">
                {filteredBuildings.map(b => (
                  <Card key={b.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group" onClick={() => goBuildingDetail(b.id)} role="button" aria-label={`فتح صفحة العمارة ${b.name}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white shadow group-hover:scale-105 transition-transform"><Building2 size={24} /></div>
                        <div><h3 className="font-bold text-lg text-gray-900 group-hover:text-orange-700 transition-colors">{b.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            {b.address && <span className="flex items-center gap-1"><MapPin size={14} />{b.address}</span>}
                            {b.city && <span>{b.city}</span>}
                            {b.floors && <span className="flex items-center gap-1"><Hash size={14} />{b.floors} طوابق</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-100 text-orange-800">{units.filter(u => u.buildingId === b.id).length} وحدة</Badge>
                        <Badge className="bg-teal-100 text-teal-800">{units.filter(u => u.buildingId === b.id && u.status === 'rented').length} مؤجرة</Badge>
                        {units.filter(u => u.buildingId === b.id && u.status === 'maintenance').length > 0 && <Badge className="bg-amber-100 text-amber-800">{units.filter(u => u.buildingId === b.id && u.status === 'maintenance').length} صيانة</Badge>}
                        <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={(e) => { e.stopPropagation(); goBuildingDetail(b.id); }}><Eye size={14} className="ml-1" />التفاصيل الكاملة</Button>
                        {canWriteCheck('buildings') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل" onClick={(e) => e.stopPropagation()}><Edit3 size={16} /></Button>} title="تعديل المبنى">{(close) => <BuildingForm initial={b} onSave={async (data) => { await api(`/api/buildings/${b.id}`, 'PUT', data); autoRestore('تعديل مبنى'); loadData('buildings'); }} onClose={close} />}</FormDialog>}
                        {canWriteCheck('buildings') && <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async (e) => { e.stopPropagation(); if (confirm('هل تريد حذف هذا المبنى؟')) { await api(`/api/buildings/${b.id}`, 'DELETE'); autoRestore('حذف مبنى'); loadData('buildings'); toast.success('تم حذف المبنى'); } }}><Trash2 size={16} /></Button>}
                      </div>
                    </div>
                    {(() => {
                      const s = buildingIncomeStats(units as any, contracts as any, b.id);
                      const buIds = new Set(units.filter(u => u.buildingId === b.id).map(u => u.id));
                      const bc = contracts.filter(c => buIds.has(c.unitId));
                      const bcIds = new Set(bc.map(c => c.id));
                      const bp = payments.filter(p => bcIds.has(p.contractId));
                      const coll = collectedStats(bp as any);
                      const arr = arrearsOfContracts(bc as any);
                      const exp = (journalEntries as any[]).filter(e => e.buildingId === b.id).reduce((s2, e) => s2 + (e.lines || []).filter((l: any) => String(l.accountCode).startsWith('5')).reduce((s3: number, l: any) => s3 + (Number(l.debit) || 0), 0), 0);
                      const netRent = coll.total - exp;
                      return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2 mt-4 pt-4 border-t border-gray-100">
                        <div className="p-2 bg-emerald-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">قبل الخصم شهرياً</p><p className="font-bold text-emerald-700 text-sm">{fmtKWD(s.contractGrossMonthly)} {CURRENCY}</p></div>
                        <div className="p-2 bg-emerald-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">قبل الخصم سنوياً</p><p className="font-bold text-emerald-700 text-sm">{fmtKWD(s.contractGrossMonthly * 12)} {CURRENCY}</p></div>
                        <div className="p-2 bg-orange-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">الخصم الشهري</p><p className="font-bold text-orange-700 text-sm">{fmtKWD(s.contractDiscountMonthly)} {CURRENCY}</p></div>
                        <div className="p-2 bg-emerald-50 rounded-lg text-center border border-emerald-200"><p className="text-[11px] text-gray-600">صافي بعد الخصم</p><p className="font-bold text-emerald-700 text-sm">{fmtKWD(s.contractedMonthly)} {CURRENCY}</p></div>
                        <div className="p-2 bg-indigo-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">المحصل شهرياً</p><p className="font-bold text-indigo-700 text-sm">{fmtKWD(coll.monthly)} {CURRENCY}</p></div>
                        <div className="p-2 bg-indigo-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">المحصل سنوياً</p><p className="font-bold text-indigo-700 text-sm">{fmtKWD(coll.annual)} {CURRENCY}</p></div>
                        <div className="p-2 bg-amber-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">المتأخرات</p><p className={`font-bold text-sm ${arr > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtKWD(arr)} {CURRENCY}</p></div>
                        <div className="p-2 bg-red-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">المصروفات</p><p className="font-bold text-red-700 text-sm">{fmtKWD(exp)} {CURRENCY}</p></div>
                        <div className="p-2 bg-teal-50 rounded-lg text-center"><p className="text-[11px] text-gray-600">صافي الإيجار</p><p className={`font-bold text-sm ${netRent >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtKWD(netRent)} {CURRENCY}</p></div>
                      </div>
                      );
                    })()}
                    <p className="text-[11px] text-orange-500 mt-3 flex items-center gap-1"><ArrowRight size={12} className="rotate-180" />اضغط على كارت العمارة لفتح صفحتها الكاملة: الوحدات والمستأجرين، العقود، المستندات القانونية، المالية، والقضايا</p>
                  </CardContent></Card>
                ))}
                {filteredBuildings.length === 0 && (buildings.length === 0 ? <EmptyState icon={<Building2 size={48} />} text="لا توجد مباني مضافة" /> : <EmptyState icon={<Search size={48} />} text="لا توجد مباني مطابقة للفلاتر أو البحث" />)}
              </div>
            </div>
          )}

          {/* Building Detail — صفحة العمارة الكاملة (وحدات + مستأجرين + مستندات + مالية + قضايا) */}
          {section === 'buildingDetail' && detailBuildingId && (
            <BuildingDetailSection
              user={user}
              building={buildings.find(b => b.id === detailBuildingId) || null}
              buildings={buildings}
              units={units as any}
              tenants={tenants as any}
              contracts={contracts as any}
              payments={payments as any}
              maintenance={maintenance as any}
              transactions={transactions as any}
              journalEntries={journalEntries as any}
              accounts={accounts as any}
              allFiles={allFiles}
              legalCases={legalCases}
              tab={detailTab}
              setTab={setDetailTab}
              onBack={() => go('buildings')}
              canWrite={canWriteCheck}
              uploadFile={uploadFile}
              refresh={() => { loadData('buildingDetail'); autoRestore('تحديث بيانات العمارة'); }}
              openCase={(id) => goBuildingDetail(detailBuildingId, 'cases')}
            />
          )}

          {/* Units */}
          {section === 'units' && (() => {
            const focusUnit = unitFocusId ? units.find(u => u.id === unitFocusId) : null;
            // عقد الوحدة النشط — مصدر اسم المستأجر والعقد على كرت الوحدة
            const unitContractsMap = new Map<string, any>();
            for (const c of contracts) {
              if (!['active', 'renewed'].includes(c.status)) continue;
              const prev = unitContractsMap.get(c.unitId);
              if (!prev || new Date(c.startDate).getTime() > new Date(prev.startDate).getTime()) unitContractsMap.set(c.unitId, c);
            }
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الوحدات</h2><PageCount n={filteredUnits.length} label="وحدة" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="units" rows={units} canWrite={canWriteCheck('units')} onImported={() => { loadData('units'); toast.success('تم تحديث قائمة الوحدات'); }} />
                  {canWriteCheck('units') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة وحدة</Button>} title="إضافة وحدة جديدة">{(close) => <UnitForm buildings={buildings} onSave={async (data) => { await api('/api/units', 'POST', data); autoRestore('إضافة وحدة'); loadData('units'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* فلاتر الوحدات: الحالة + العمارة — تُضبط تلقائيًا عند القدوم من لوحة التحكم */}
              <div className="flex gap-2 flex-wrap items-center">
                {[{ k: 'all', l: 'الكل' }, ...Object.entries(UNIT_STATUS_MAP).map(([k, v]) => ({ k, l: v.label }))].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setUnitStatusFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${unitStatusFilter === k ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'}`}>{l}{k === 'all' ? ` (${units.length})` : ` (${units.filter(u => u.status === k).length})`}</button>
                ))}
                <Select value={unitBuildingFilter} onValueChange={setUnitBuildingFilter}>
                  <SelectTrigger className="h-9 w-[160px] text-xs border-orange-200 bg-white rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل العمارات ({units.length} وحدة)</SelectItem>
                    {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({units.filter(u => u.buildingId === b.id).length})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {focusUnit && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Home size={12} />وحدة: {focusUnit.number} — {focusUnit.building?.name || ''}
                  <button type="button" onClick={() => setUnitFocusId('')} title="إلغاء التركيز على الوحدة" className="hover:text-blue-900 font-bold">✕</button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUnits.map(u => {
                  const uc = unitContractsMap.get(u.id);
                  return (
                  <Card key={u.id} className={`border-0 shadow-lg hover:shadow-xl transition-shadow ${uc ? 'ring-1 ring-emerald-100' : 'opacity-95'}`}><CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-gray-900">وحدة {u.number}</h3><Badge className={UNIT_STATUS_MAP[u.status]?.color || 'bg-gray-100'}>{UNIT_STATUS_MAP[u.status]?.label || u.status}</Badge></div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {u.building && <p className="flex items-center gap-1"><Building2 size={14} />{u.building.name}</p>}
                      {u.floor && <p>الطابق: {u.floor}</p>}
                      {u.area && <p>المساحة: {u.area} م²</p>}
                      {u.rentAmount && <p className="font-semibold text-emerald-700">الإيجار: {u.rentAmount.toLocaleString('ar')} {CURRENCY}</p>}
                    </div>
                    {/* المستأجر والعقد — ربط الوحدة بالمستأجر والعقد */}
                    <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/60 p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-[11px] font-bold text-orange-700 flex items-center gap-1"><Users size={12} />المستأجر والعقد</p>
                        {uc && (
                          <button type="button" onClick={() => { setContractUnitId(u.id); setContractTenantId(''); go('contracts'); }} title="فتح عقد هذه الوحدة في صفحة العقود" className="text-[10px] font-semibold text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-0.5 shrink-0">فتح العقد<ArrowRight size={10} className="rotate-180" /></button>
                        )}
                      </div>
                      {uc ? (
                        <div className="bg-white rounded-lg p-2 border border-gray-100">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-1"><Users size={11} className="text-emerald-600" />{uc.tenant?.name || 'مستأجر غير معروف'}</span>
                            <Badge className={`${CONTRACT_STATUS_MAP[uc.status]?.color || 'bg-gray-100'} text-[9px] px-1.5`}>{CONTRACT_STATUS_MAP[uc.status]?.label || uc.status}</Badge>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><Calendar size={9} />{new Date(uc.startDate).toLocaleDateString('ar')} ← {new Date(uc.endDate).toLocaleDateString('ar')}</p>
                          <p className="text-[10px] font-semibold text-emerald-700">{fmtKWD(effectiveRent(uc as any))} {CURRENCY} شهرياً{(uc.discount || 0) > 0 ? <span className="font-normal text-gray-400"> (قبل الخصم {fmtKWD(uc.rentAmount)})</span> : ''}</p>
                          {uc.tenant?.name && (
                            <button type="button" onClick={() => go('tenants', uc.tenant?.name)} title="فتح كرت المستأجر في صفحة المستأجرين" className="mt-1.5 text-[10px] font-semibold text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-0.5">كرت المستأجر<ArrowRight size={10} className="rotate-180" /></button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">لا يوجد عقد نشط — {['available'].includes(u.status) ? 'وحدة شاغرة' : 'مسجلة ' + (UNIT_STATUS_MAP[u.status]?.label || u.status) + ' بدون عقد (أنشئ عقدًا أو صحّح الحالة)'}</p>
                      )}
                    </div>
                    {canWriteCheck('units') && <div className="flex gap-2 mt-3"><FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الوحدة">{(close) => <UnitForm buildings={buildings} initial={u} onSave={async (data) => { await api(`/api/units/${u.id}`, 'PUT', data); autoRestore('تعديل وحدة'); loadData('units'); }} onClose={close} />}</FormDialog><Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/units/${u.id}`, 'DELETE'); autoRestore('حذف وحدة'); loadData('units'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button></div>}
                  </CardContent></Card>
                  );
                })}
                {filteredUnits.length === 0 && (units.length === 0 ? <EmptyState icon={<Home size={48} />} text="لا توجد وحدات مضافة" /> : <EmptyState icon={<Search size={48} />} text="لا توجد وحدات مطابقة للفلاتر أو البحث — جرّب تعديل الفلاتر" />)}
              </div>
            </div>
            );
          })()}

          {/* Tenants */}
          {section === 'tenants' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المستأجرين</h2><PageCount n={filteredTenants.length} label="مستأجر" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="tenants" rows={tenants} canWrite={canWriteCheck('tenants')} onImported={() => { loadData('tenants'); toast.success('تم تحديث قائمة المستأجرين'); }} />
                  {canWriteCheck('tenants') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة مستأجر</Button>} title="إضافة مستأجر جديد">{(close) => <TenantForm onSave={async (data) => { await api('/api/tenants', 'POST', data); autoRestore('إضافة مستأجر'); loadData('tenants'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {[{ k: 'all', l: 'الكل' }, { k: 'current', l: 'مستأجرون حالياً' }, { k: 'former', l: 'مستأجرون سابقون' }].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setTenantStatusFilter(k as any)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${tenantStatusFilter === k ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'}`}>{l}</button>
                ))}
                <span className="text-gray-300">|</span>
                {[{ k: 'all', l: 'كل الأنواع' }, { k: 'individual', l: 'فرد / عائلة' }, { k: 'company', l: 'شركة' }].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setTenantTypeFilter(k as any)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${tenantTypeFilter === k ? 'bg-indigo-500 text-white border-indigo-500 shadow' : 'bg-white text-gray-600 border-indigo-200 hover:bg-indigo-50'}`}>{l}{k === 'all' ? '' : ` (${tenants.filter(t => (t.tenantType || 'individual') === k).length})`}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTenants.map(t => {
                  // عقود المستأجر: النشط أولًا ثم الأحدث — مصدر الوحدة والعقد على الكرت
                  const tContracts = contracts.filter(c => c.tenantId === t.id).sort((a, b) => {
                    const aA = ['active', 'renewed'].includes(a.status) ? 0 : 1;
                    const bA = ['active', 'renewed'].includes(b.status) ? 0 : 1;
                    if (aA !== bA) return aA - bA;
                    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                  });
                  const tActive = tContracts.find(c => ['active', 'renewed'].includes(c.status));
                  return (
                  <Card key={t.id} className={`border-0 shadow-lg hover:shadow-xl transition-shadow ${tActive ? 'ring-1 ring-emerald-100' : 'opacity-95'}`}><CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${t.tenantType === 'company' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.name.charAt(0)}</div>
                      <div><h3 className="font-bold text-gray-900">{t.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge className={`${TENANT_TYPE_LABEL[t.tenantType || 'individual']?.color} text-[10px]`}>{TENANT_TYPE_LABEL[t.tenantType || 'individual']?.label}</Badge>
                          {!tActive && <Badge className="bg-gray-100 text-gray-600 text-[10px]">سابق — لا عقد نشط</Badge>}
                          {t.tenantType === 'company' && t.commercialReg && <span className="text-[10px] text-gray-500">س.ت: {t.commercialReg}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {t.phone && <p className="flex items-center gap-1"><Phone size={14} />{t.phone}</p>}
                      {t.email && <p className="flex items-center gap-1"><Mail size={14} />{t.email}</p>}
                    </div>
                    {/* الوحدة والعقد — يوضح المستأجر ساكن فين وعلى أنهي عقد */}
                    <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/60 p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-[11px] font-bold text-orange-700 flex items-center gap-1"><Home size={12} />الوحدة والعقد</p>
                        {tContracts.length > 0 && (
                          <button type="button" onClick={() => { setContractTenantId(t.id); go('contracts'); }} title="عرض كل عقود هذا المستأجر في صفحة العقود" className="text-[10px] font-semibold text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-0.5 shrink-0">فتح العقود<ArrowRight size={10} className="rotate-180" /></button>
                        )}
                      </div>
                      {tContracts.length === 0 ? (
                        <p className="text-xs text-gray-400">لا يوجد عقد مسجل — المستأجر غير مرتبط بوحدة (أنشئ عقدًا من صفحة العقود)</p>
                      ) : (
                        <div className="space-y-1.5">
                          {tContracts.slice(0, 2).map(c => (
                            <div key={c.id} className="bg-white rounded-lg p-2 border border-gray-100">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {c.unitId ? (
                                  <button type="button" onClick={() => { setUnitFocusId(c.unitId); go('units'); }} title="فتح هذه الوحدة في صفحة الوحدات" className="text-xs font-bold text-gray-800 hover:text-orange-700 flex items-center gap-1"><Home size={11} className="text-teal-500" />وحدة {c.unit?.number || '؟'} — {c.unit?.building?.name || 'بدون عمارة'}</button>
                                ) : (
                                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1"><Home size={11} className="text-teal-500" />وحدة {c.unit?.number || '؟'} — {c.unit?.building?.name || 'بدون عمارة'}</span>
                                )}
                                <Badge className={`${CONTRACT_STATUS_MAP[c.status]?.color || 'bg-gray-100'} text-[9px] px-1.5`}>{CONTRACT_STATUS_MAP[c.status]?.label || c.status}</Badge>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><Calendar size={9} />{new Date(c.startDate).toLocaleDateString('ar')} ← {new Date(c.endDate).toLocaleDateString('ar')}{c.unit?.floor != null ? ` — طابق ${c.unit.floor}` : ''}</p>
                              <p className="text-[10px] font-semibold text-emerald-700">{fmtKWD(effectiveRent(c as any))} {CURRENCY} شهرياً{(c.discount || 0) > 0 ? <span className="font-normal text-gray-400"> (قبل الخصم {fmtKWD(c.rentAmount)})</span> : ''}</p>
                            </div>
                          ))}
                          {tContracts.length > 2 && <p className="text-[10px] text-gray-400">+ {tContracts.length - 2} عقد قديم — في «سجل العميل»</p>}
                        </div>
                      )}
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
                    <TenantHistoryDialog trigger={<Button variant="outline" size="sm" className="w-full mt-2 border-orange-200 text-orange-700 hover:bg-orange-50" title="سجل العميل الكامل: الدفعات والالتزام والعقود والقضايا"><History size={14} className="ml-1" />سجل العميل — الدفعات والالتزام والقضايا</Button>} tenant={t} contracts={contracts as any} payments={payments as any} legalCases={legalCases as any} />
                  </CardContent></Card>
                  );
                })}
                {filteredTenants.length === 0 && (tenants.length === 0 ? <EmptyState icon={<Users size={48} />} text="لا يوجد مستأجرين" /> : <EmptyState icon={<Search size={48} />} text="لا يوجد مستأجرين مطابقين للفلاتر أو البحث" />)}
              </div>
            </div>
          )}

          {/* Contracts */}
          {section === 'contracts' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">العقود</h2><PageCount n={filteredContracts.length} label="عقد" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="contracts" rows={contracts} canWrite={canWriteCheck('contracts')} onImported={() => { loadData('contracts'); toast.success('تم تحديث قائمة العقود'); }} />
                  {canWriteCheck('contracts') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة عقد</Button>} title="إضافة عقد جديد" maxWidth="max-w-lg">{(close) => <ContractForm units={units} tenants={tenants} buildings={buildings} onSave={async (data) => { await api('/api/contracts', 'POST', data); if (data.updateDefaultRent && data.unitId) { await api(`/api/units/${data.unitId}`, 'PUT', { rentAmount: data.rentAmount }); loadData('units'); } autoRestore('إضافة عقد'); loadData('contracts'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {[{ k: 'all', l: 'الكل' }, ...Object.entries(CONTRACT_STATUS_MAP).map(([k, v]) => ({ k, l: v.label }))].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setContractFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${contractFilter === k ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'}`}>{l}{k === 'all' ? ` (${contracts.length})` : ` (${contracts.filter((c: any) => c.status === k).length})`}</button>
                ))}
                {/* فلتر العمارة — يُضبط تلقائيًا عند القدوم من روابط العمارة */}
                <Select value={contractBuildingFilter} onValueChange={setContractBuildingFilter}>
                  <SelectTrigger className="h-8 w-[150px] text-xs border-orange-200 bg-white rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل العمارات</SelectItem>
                    {buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {contractTenantId && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Users size={12} />عقود: {tenants.find(t => t.id === contractTenantId)?.name || 'مستأجر'}
                    <button type="button" onClick={() => setContractTenantId('')} title="إلغاء فلتر المستأجر" className="hover:text-emerald-900 font-bold">✕</button>
                  </span>
                )}
                {contractUnitId && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Home size={12} />وحدة: {units.find(u => u.id === contractUnitId)?.number || '—'}
                    <button type="button" onClick={() => setContractUnitId('')} title="إلغاء فلتر الوحدة" className="hover:text-blue-900 font-bold">✕</button>
                  </span>
                )}
              </div>
              <div className="grid gap-4">
                {filteredContracts.map(c => (
                  <Card key={c.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow"><CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap"><Badge className={CONTRACT_STATUS_MAP[c.status]?.color || 'bg-gray-100'}>{CONTRACT_STATUS_MAP[c.status]?.label || c.status}</Badge>{c.number && <Badge className="bg-slate-800 text-white font-bold tabular-nums" title="الرقم التسلسلي للعقد في السجل">عقد {c.number}</Badge>}<span className="text-sm text-gray-500">عقد بدأ في {c.startDate ? new Date(c.startDate).toLocaleDateString('ar-EG') : '-'}</span></div>
                        <div className="space-y-1 text-sm">
                          {c.unit && <p className="flex items-center gap-1"><Home size={14} className="text-gray-400" />وحدة {c.unit.number} - {c.unit.building?.name}</p>}
                          {c.tenant && <p className="flex items-center gap-1"><Users size={14} className="text-gray-400" />{c.tenant.name}</p>}
                          {/* القفز السريع: من العقد إلى الوحدة والمستأجر */}
                          <div className="flex gap-2 pt-1">
                            {c.unit && <button type="button" onClick={() => { setUnitFocusId(c.unitId); go('units'); }} title="فتح هذه الوحدة في صفحة الوحدات" className="text-[10px] font-semibold text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-0.5">الوحدة<ArrowRight size={10} className="rotate-180" /></button>}
                            {c.tenant && <button type="button" onClick={() => go('tenants', c.tenant?.name)} title="فتح كرت المستأجر في صفحة المستأجرين" className="text-[10px] font-semibold text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-0.5">المستأجر<ArrowRight size={10} className="rotate-180" /></button>}
                          </div>
                          <p className="flex items-center gap-1"><Calendar size={14} className="text-gray-400" />{new Date(c.startDate).toLocaleDateString('ar')} - {new Date(c.endDate).toLocaleDateString('ar')}</p>
                          <p className="font-semibold text-emerald-700">الإيجار: {effectiveRent(c as any).toLocaleString('ar')} {CURRENCY} شهرياً{(c.discount || 0) > 0 ? <span className="text-xs font-normal text-gray-500"> (قبل الخصم {c.rentAmount.toLocaleString('ar')} — خصم {(c.discount || 0).toLocaleString('ar')})</span> : null}</p>
                          <p className="text-xs text-gray-500">سنوياً: {fmtKWD(effectiveRent(c as any) * 12)} {CURRENCY}{(c.discount || 0) > 0 ? ` (قبل الخصم ${fmtKWD(c.rentAmount * 12)} ${CURRENCY})` : ''}</p>
                          {(() => { try { const bal = contractBalance(c as any, (c.payments || []) as any); if (bal.totalDue <= 0) return null; return (<p className={`text-sm font-semibold ${bal.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>المستحق: {fmtKWD(bal.totalDue)} — المدفوع: {fmtKWD(bal.totalPaid)} — المتبقي: {fmtKWD(bal.outstanding)} {CURRENCY}</p>); } catch { return null; } })()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        {(() => { const list = c.attachments || []; const last = list[list.length - 1]; return last ? <FilePreviewDialog fileId={last.id} fileName={last.originalName} mimeType={last.mimeType} triggerLabel="عرض العقد" /> : null; })()}
                        {canWriteCheck('contracts') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل العقد" maxWidth="max-w-lg">{(close) => <ContractForm units={units} tenants={tenants} buildings={buildings} initial={c} onSave={async (data) => { await api(`/api/contracts/${c.id}`, 'PUT', data); if (data.updateDefaultRent && data.unitId) { await api(`/api/units/${data.unitId}`, 'PUT', { rentAmount: data.rentAmount }); loadData('units'); } autoRestore('تعديل عقد'); loadData('contracts'); }} onClose={close} />}</FormDialog>}
                        {['active', 'renewed'].includes(c.status) && canWriteCheck('contracts') && (<FormDialog trigger={<Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50" title="إخلاء فوري وإنهاء العقد — خروج مبكر أو نهاية المدة، مع تسوية المستحقات وتحرير الوحدة"><LogOut size={14} /></Button>} title={`إخلاء فوري وإنهاء العقد — وحدة ${c.unit?.number || '؟'}`}>{(close) => <EvictContractForm contract={c} onSave={async (data) => { const r = await api<any>(`/api/contracts/${c.id}/evict`, 'POST', data); autoRestore('إخلاء عقد'); loadData('payments'); return r; }} onClose={close} />}</FormDialog>)}
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
                {filteredContracts.length === 0 && (contracts.length === 0 ? <EmptyState icon={<FileText size={48} />} text="لا توجد عقود" /> : <EmptyState icon={<Search size={48} />} text="لا توجد عقود مطابقة للفلاتر أو البحث" />)}
              </div>
            </div>
          )}

          {/* Payments */}
          {section === 'payments' && (() => {
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المدفوعات</h2><PageCount n={filteredPayments.length} label="دفعة" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="payments" rows={payments} canWrite={canWriteCheck('payments')} onImported={() => { loadData('payments'); toast.success('تم تحديث المدفوعات'); }} />
                  {canWriteCheck('payments') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />تسجيل دفعة</Button>} title="تسجيل دفعة جديدة">{(close) => <PaymentForm contracts={contracts} payments={payments} buildings={buildings} onSave={async (data) => { const r: any = await api('/api/payments', 'POST', data); if (r?.entryWarning) toast.warning(r.entryWarning); autoRestore('تسجيل دفعة'); loadData('payments'); }} onClose={close} />}</FormDialog>)}
                  {canWriteCheck('payments') && (<FormDialog trigger={<Button variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50" title="حدد عدة عملاء وسجل دفعاتهم مرة واحدة"><Users size={16} className="ml-1" />تسجيل دفعات متعددة</Button>} title="تسجيل دفعات متعددة — تحصيل جماعي" maxWidth="max-w-3xl">{(close) => <MultiPaymentForm contracts={contracts} buildings={buildings} onSave={async (data) => { const r: any = await api('/api/payments/multi', 'POST', data); toast.success(`تم تسجيل ${r.count} دفعة بإجمالي ${fmtKWD(r.totalAmount)} ${CURRENCY} مع توليد القيود${r.partialCount ? ` — منها ${r.partialCount} جزئية` : ''}`); if (r.entryWarnings?.length) toast.warning(`تنبيه محاسبي: ${r.entryWarnings[0]}`); autoRestore('تسجيل دفعات متعددة'); loadData('payments'); }} onClose={close} />}</FormDialog>)}
                  {canWriteCheck('payments') && (<FormDialog trigger={<Button variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50" title="شيك واحد للعمارة كاملة يوزع على عقود الشركات"><Landmark size={16} className="ml-1" />تحصيل شيك شركة (مجمّع)</Button>} title="تحصيل شيك شركة — عمارة كاملة" maxWidth="max-w-lg">{(close) => <CompanyCheckForm buildings={buildings} contracts={contracts as any} onSave={async (data) => { const r: any = await api('/api/payments/bulk', 'POST', data); toast.success(`تم توزيع ${r.totalAmount} ${CURRENCY} على ${r.paymentsCount} عقد شركة في ${r.buildingName} مع توليد القيود`); autoRestore('تحصيل شيك شركة مجمّع'); loadData('payments'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* فلتر حالة الدفعات — يُضبط تلقائيًا عند القدوم من لوحة التحكم (المحصل → مدفوع) */}
              <div className="flex gap-2 flex-wrap items-center">
                {[{ k: 'all', l: 'الكل' }, ...Object.entries(PAYMENT_STATUS_MAP).map(([k, v]) => ({ k, l: v.label }))].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setPaymentStatusFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${paymentStatusFilter === k ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'}`}>{l}{k === 'all' ? ` (${payments.length})` : ` (${payments.filter(p => p.status === k).length})`}</button>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
              <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>الفاتورة</TableHead><TableHead>السند</TableHead><TableHead>المبلغ</TableHead><TableHead>تاريخ الاستحقاق</TableHead><TableHead>تاريخ الدفع</TableHead><TableHead>الحالة</TableHead><TableHead>الطريقة</TableHead><TableHead>العقد</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{filteredPayments.map(p => (<TableRow key={p.id}>
                  <TableCell className="text-xs font-bold text-amber-700 tabular-nums">{p.invoiceNo || '-'}</TableCell>
                  <TableCell className="text-xs font-bold text-emerald-700 tabular-nums">{p.receiptNo || (p.status === 'paid' || p.status === 'partial' ? '-' : '—')}</TableCell>
                  <TableCell className="font-semibold">{p.amount.toLocaleString('ar')} {CURRENCY}</TableCell>
                  <TableCell>{new Date(p.dueDate).toLocaleDateString('ar')}</TableCell>
                  <TableCell>{p.paidDate ? new Date(p.paidDate).toLocaleDateString('ar') : '-'}</TableCell>
                  <TableCell><Badge className={PAYMENT_STATUS_MAP[p.status]?.color}>{PAYMENT_STATUS_MAP[p.status]?.label || p.status}</Badge></TableCell>
                  <TableCell>{p.method || '-'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{p.contract ? (p.contract.number ? `عقد ${p.contract.number} — وحدة ${p.contract.unit?.number || '?'}` : `وحدة ${p.contract.unit?.number || p.contractId?.slice(0, 8)}`) : (p.contractId?.slice(0, 8) || '-')}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50" title="طباعة فاتورة الإيجار (ف)"><FileText size={14} /></Button>} title={`فاتورة إيجار ${p.invoiceNo || ''}`} docHtml={rentInvoiceHtml(p, CURRENCY)} />
                    {(p.status === 'paid' || p.status === 'partial') && <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title={`سند القبض ${p.receiptNo || ''}`}><Printer size={14} /></Button>} title={`سند قبض ${p.receiptNo || ''} — إيجار`} docHtml={paymentReceiptHtml(p, CURRENCY)} />}
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
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                      {p.invoiceNo && <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 tabular-nums">فاتورة {p.invoiceNo}</span>}
                      {p.receiptNo && <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 tabular-nums">سند قبض {p.receiptNo}</span>}
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="flex items-center gap-1"><Calendar size={13} />استحقاق: {new Date(p.dueDate).toLocaleDateString('ar')}{p.paidDate ? ` — دُفع: ${new Date(p.paidDate).toLocaleDateString('ar')}` : ''}</p>
                      {p.month && <p>عن شهر: {p.month}</p>}
                      <p>الطريقة: {p.method || '-'} — العقد: {p.contract?.number || p.contractId?.slice(0, 8)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                      <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50" title="طباعة فاتورة الإيجار (ف)"><FileText size={14} /></Button>} title={`فاتورة إيجار ${p.invoiceNo || ''}`} docHtml={rentInvoiceHtml(p, CURRENCY)} />
                      {(p.status === 'paid' || p.status === 'partial') && <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title={`سند القبض ${p.receiptNo || ''}`}><Printer size={14} /></Button>} title={`سند قبض ${p.receiptNo || ''} — إيجار`} docHtml={paymentReceiptHtml(p, CURRENCY)} />}
                      {canWriteCheck('payments') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الدفعة">{(close) => <PaymentForm contracts={contracts} payments={payments} buildings={buildings} initial={p} onSave={async (data) => { await api(`/api/payments/${p.id}`, 'PUT', data); autoRestore('تعديل دفعة'); loadData('payments'); }} onClose={close} />}</FormDialog>}
                      {canWriteCheck('payments') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف؟')) { await api(`/api/payments/${p.id}`, 'DELETE'); autoRestore('حذف دفعة'); loadData('payments'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                    </div>
                  </CardContent></Card>
                ))}
              </div>
              {filteredPayments.length === 0 && (payments.length === 0 ? <EmptyState icon={<DollarSign size={48} />} text="لا توجد مدفوعات" /> : <EmptyState icon={<Search size={48} />} text="لا توجد دفعات مطابقة للفلتر أو البحث" />)}
            </div>
            );
          })()}

          {/* Vouchers Register — سجل السندات الموحد: كل سندات القبض والصرف مرقمة تسلسليًا في مكان واحد */}
          {section === 'voucherRegister' && (() => {
            // تجميع كل السندات من المصادر المختلفة في صفوف موحدة
            const rows: RegisterRow[] = [];
            for (const p of payments) {
              if (p.receiptNo && ['paid', 'partial'].includes(p.status)) {
                const c = p.contract || ({} as any);
                rows.push({
                  docNo: p.receiptNo, kind: 'قبض', date: p.paidDate || p.dueDate, source: 'تحصيل إيجار',
                  party: c.tenant?.name || '-', about: `إيجار${p.month ? ` شهر ${p.month}` : ''}${c.unit?.number ? ` — وحدة ${c.unit.number}` : ''}${c.unit?.building?.name ? ` — ${c.unit.building.name}` : ''}`,
                  amount: Number(p.amount) || 0, method: p.method,
                });
              }
            }
            for (const t of transactions as any[]) {
              if (t.voucherNo) {
                rows.push({
                  docNo: t.voucherNo, kind: t.type === 'income' ? 'قبض' : 'صرف', date: t.date, source: 'حركة مالية',
                  party: t.building?.name || 'الإدارة', about: t.category || '', amount: Number(t.amount) || 0,
                  method: t.cashAccount === 'bank' ? 'transfer' : 'cash',
                });
              }
            }
            for (const l of loans as any[]) {
              if (l.receiptNo) rows.push({ docNo: l.receiptNo, kind: 'قبض', date: l.date, source: 'قرض — استلام', party: l.name, about: `استلام قرض${l.months ? ` — ${l.months} شهر` : ''}`, amount: Number(l.principal) || 0, method: 'transfer' });
            }
            for (const lp of loanPayments as any[]) {
              if (lp.paymentNo) rows.push({ docNo: lp.paymentNo, kind: 'صرف', date: lp.date, source: 'قرض — قسط', party: lp.loan?.name || '-', about: 'سداد قسط قرض', amount: (Number(lp.principal) || 0) + (Number(lp.interest) || 0), method: 'transfer' });
            }
            for (const m of maintenance as MaintenanceItem[]) {
              if (m.paymentNo) rows.push({ docNo: m.paymentNo, kind: 'صرف', date: m.completedAt || m.createdAt, source: 'صيانة', party: m.assignedTo || 'جهة التنفيذ', about: `صيانة: ${m.title}${m.unit?.number ? ` — وحدة ${m.unit.number}` : ''}`, amount: Number(m.cost) || 0, method: 'cash' });
            }
            for (const sp of supplierPayments as any[]) {
              if (sp.paymentNo) rows.push({ docNo: sp.paymentNo, kind: 'صرف', date: sp.date, source: 'مورد / مقاول', party: sp.supplier?.name || '-', about: sp.description || 'دفعة مورد', amount: Number(sp.amount) || 0, method: sp.method });
            }
            const kindSorted = (a: RegisterRow, b: RegisterRow) => {
              const na = parseInt(String(a.docNo).split('-')[1] || '0', 10);
              const nb = parseInt(String(b.docNo).split('-')[1] || '0', 10);
              return na - nb;
            };
            const receiptRows = rows.filter(r => r.kind === 'قبض').sort(kindSorted);
            const spendRows = rows.filter(r => r.kind === 'صرف').sort(kindSorted);
            const shown = regKindFilter === 'all' ? rows : (regKindFilter === 'قبض' ? receiptRows : spendRows);
            const filtered = shown.filter(r => !searchQuery || r.docNo.includes(searchQuery) || (r.party || '').includes(searchQuery) || (r.about || '').includes(searchQuery) || (r.source || '').includes(searchQuery));
            // كشف الفجوات: أرقام متوقعة بين أول وآخر سند لا يوجد لها سجل → سند ضائع أو ملغى
            const gapsOf = (list: RegisterRow[]) => {
              const nums = list.map(r => parseInt(String(r.docNo).split('-')[1] || '0', 10)).filter(n => n > 0).sort((a, b) => a - b);
              if (!nums.length) return [] as number[];
              const set = new Set(nums);
              const missing: number[] = [];
              for (let i = nums[0]; i <= nums[nums.length - 1]; i++) if (!set.has(i)) missing.push(i);
              return missing;
            };
            const receiptGaps = gapsOf(receiptRows);
            const spendGaps = gapsOf(spendRows);
            const totalReceipts = receiptRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const totalSpend = spendRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const METHOD_AR: Record<string, string> = { cash: 'نقدي', transfer: 'تحويل', check: 'شيك', card: 'بطاقة' };
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">سجل السندات</h2><PageCount n={filtered.length} label="سند" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث برقم السند أو الطرف..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-56 border-orange-200 focus:border-orange-500" /></div>
                  <VoucherDialog trigger={<Button variant="outline" className="border-orange-200 text-orange-700"><Printer size={15} className="ml-1" />طباعة السجل</Button>} title="سجل السندات — كشف تسلسلي" docHtml={voucherRegisterDocHtml({ rows, currency: CURRENCY })} />
                </div>
              </div>
              <p className="text-xs text-gray-500">كل سند له رقم تسلسلي محفوظ في النظام: القبض <b>ق-####</b> والصرف <b>ص-####</b> — أي فجوة في التسلسل تعني سندًا ضائعًا أو ملغى ويجب مراجعته فورًا</p>
              {/* تنبيهات الفجوات — قلب الطلب: لو سند ضاع يبان */}
              {(receiptGaps.length > 0 || spendGaps.length > 0) && (
                <Card className="border-0 shadow-lg border-r-4 border-r-red-500 bg-red-50/70"><CardContent className="p-4 space-y-2">
                  <p className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={16} />فجوات في تسلسل السندات — سندات مفقودة أو ملغاة</p>
                  <div className="flex flex-wrap gap-2">
                    {receiptGaps.length > 0 && <span className="text-xs font-bold text-red-800 bg-white border border-red-200 rounded-full px-3 py-1.5">قبض: {receiptGaps.map(n => `ق-${String(n).padStart(4, '0')}`).join('، ')}</span>}
                    {spendGaps.length > 0 && <span className="text-xs font-bold text-red-800 bg-white border border-red-200 rounded-full px-3 py-1.5">صرف: {spendGaps.map(n => `ص-${String(n).padStart(4, '0')}`).join('، ')}</span>}
                  </div>
                  <p className="text-[11px] text-gray-500">راجع السندات الورقية المطابقة لهذه الأرقام — إن كانت ناقصة فالسند ضاع ويجب توثيق الاستبدال، وإن كانت ملغاة فسجّل ذلك في ملاحظات العملية.</p>
                </CardContent></Card>
              )}
              {/* ملخص: عدد كل نوع + الإجماليات */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-emerald-600"><TrendingUp size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">سندات القبض (ق)</p><p className="font-bold text-sm sm:text-lg text-emerald-700 truncate">{receiptRows.length} — {fmtKWD(totalReceipts)} {CURRENCY}</p></div></div>
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-red-600"><ReceiptText size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">سندات الصرف (ص)</p><p className="font-bold text-sm sm:text-lg text-red-700 truncate">{spendRows.length} — {fmtKWD(totalSpend)} {CURRENCY}</p></div></div>
                <div className={`p-3.5 rounded-2xl border flex items-center gap-3 shadow-sm ${(totalReceipts - totalSpend) >= 0 ? 'bg-teal-50 border-teal-100' : 'bg-orange-50 border-orange-100'}`}><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-teal-600"><DollarSign size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">الصافي (قبض − صرف)</p><p className={`font-bold text-sm sm:text-lg truncate ${(totalReceipts - totalSpend) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtKWD(totalReceipts - totalSpend)} {CURRENCY}</p></div></div>
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-blue-600"><Hash size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">إجمالي السندات</p><p className="font-bold text-sm sm:text-lg text-blue-700">{rows.length}</p></div></div>
              </div>
              {/* فلتر النوع */}
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { k: 'all', l: `الكل (${rows.length})` },
                  { k: 'قبض', l: `سندات القبض (${receiptRows.length})` },
                  { k: 'صرف', l: `سندات الصرف (${spendRows.length})` },
                ] as const).map(f => (
                  <button key={f.k} onClick={() => setRegKindFilter(f.k as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${regKindFilter === f.k ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white text-gray-600 border border-orange-100 hover:bg-orange-50'}`}>
                    {f.l}
                  </button>
                ))}
              </div>
              {/* جدول السندات الموحد — مرتب بالرقم التسلسلي */}
              <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>رقم السند</TableHead><TableHead>النوع</TableHead><TableHead>التاريخ</TableHead><TableHead>المصدر</TableHead><TableHead>الطرف</TableHead><TableHead>البيان</TableHead><TableHead>الطريقة</TableHead><TableHead>المبلغ</TableHead></TableRow></TableHeader>
                <TableBody>{filtered.map(r => (<TableRow key={`${r.kind}-${r.docNo}`}>
                  <TableCell><span className={`font-bold tabular-nums ${r.kind === 'قبض' ? 'text-emerald-700' : 'text-red-700'}`}>{r.docNo}</span></TableCell>
                  <TableCell><Badge className={r.kind === 'قبض' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>سند {r.kind}</Badge></TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(r.date).toLocaleDateString('ar')}</TableCell>
                  <TableCell className="text-xs text-gray-600">{r.source}</TableCell>
                  <TableCell className="text-sm font-semibold">{r.party}</TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-56 truncate">{r.about}</TableCell>
                  <TableCell className="text-xs">{METHOD_AR[r.method || ''] || r.method || 'نقدي'}</TableCell>
                  <TableCell className={`font-bold tabular-nums ${r.kind === 'قبض' ? 'text-emerald-700' : 'text-red-700'}`}>{r.amount.toLocaleString('ar')} {CURRENCY}</TableCell>
                </TableRow>))}</TableBody>
                {filtered.length > 0 && (
                  <TableFooter><TableRow className="bg-amber-50">
                    <TableCell colSpan={7} className="font-bold">الإجمالي المعروض — {filtered.length} سند</TableCell>
                    <TableCell className={`font-bold tabular-nums ${regKindFilter === 'صرف' ? 'text-red-700' : 'text-emerald-700'}`}>{filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0).toLocaleString('ar')} {CURRENCY}</TableCell>
                  </TableRow></TableFooter>
                )}
                </Table>
              </div></Card>
              {filtered.length === 0 && (rows.length === 0 ? <EmptyState icon={<ReceiptText size={48} />} text="لا توجد سندات بعد — سجل أول تحصيل أو حركة مالية وسيُرقم تلقائيًا" /> : <EmptyState icon={<Search size={48} />} text="لا توجد سندات مطابقة للفلتر أو البحث" />)}
            </div>
            );
          })()}

          {/* Suppliers & Contractors — الموردين والمقاولين */}
          {section === 'suppliers' && (() => {
            const totalPaid = supplierPayments.reduce((s, p) => s + (p.amount || 0), 0);
            const filteredSuppliers = suppliers.filter(x => !searchQuery || x.name.includes(searchQuery) || (x.phone || '').includes(searchQuery) || (x.specialty || '').includes(searchQuery));
            const filteredPayments = supplierPayments.filter(p => supplierPayFilter === 'all' || p.supplierId === supplierPayFilter);
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الموردين والمقاولين</h2><PageCount n={suppliers.length} label="مورد / مقاول" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {canWriteCheck('suppliers') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة مورد / مقاول</Button>} title="إضافة مورد أو مقاول جديد">{(close) => <SupplierForm onSave={async (data) => { await api('/api/suppliers', 'POST', data); autoRestore('إضافة مورد'); loadData('suppliers'); }} onClose={close} />}</FormDialog>)}
                  {canWriteCheck('suppliers') && suppliers.length > 0 && (<FormDialog trigger={<Button variant="outline" className="border-amber-300 text-amber-700 bg-amber-50" title="سجل دفعة لمقاول أو مورد بقيود محاسبية"><Truck size={16} className="ml-1" />تسجيل دفعة مورد</Button>} title="تسجيل دفعة لمورد / مقاول">{(close) => <SupplierPaymentForm suppliers={suppliers} buildings={buildings} accounts={accounts as any} onSave={async (data) => { const r: any = await api('/api/supplier-payments', 'POST', data); if (r?.entryWarning) toast.warning(r.entryWarning); autoRestore('دفعة مورد'); loadData('suppliers'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* ملخص سريع */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-0 shadow-md"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{suppliers.length}</p><p className="text-xs text-gray-500">مورد / مقاول</p></CardContent></Card>
                <Card className="border-0 shadow-md"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-700">{fmtKWD(totalPaid)} {CURRENCY}</p><p className="text-xs text-gray-500">إجمالي المدفوع لهم</p></CardContent></Card>
                <Card className="border-0 shadow-md"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{supplierPayments.length}</p><p className="text-xs text-gray-500">دفعة مسجلة</p></CardContent></Card>
              </div>
              {/* كروت الموردين */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map(s => {
                  const sPays = s.payments || [];
                  const sTotal = sPays.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                  return (
                  <Card key={s.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow"><CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${s.type === 'contractor' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>{s.name.charAt(0)}</div>
                      <div className="min-w-0"><h3 className="font-bold text-gray-900 truncate">{s.name}</h3>
                        <Badge className={`${SUPPLIER_TYPE_LABEL[s.type]?.color} text-[10px] mt-0.5`}>{SUPPLIER_TYPE_LABEL[s.type]?.label || s.type}</Badge>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {s.phone && <p className="flex items-center gap-1"><Phone size={13} />{s.phone}</p>}
                      {s.specialty && <p className="flex items-center gap-1"><Wrench size={13} />{s.specialty}</p>}
                      {s.notes && <p className="text-xs text-gray-400 line-clamp-2">{s.notes}</p>}
                    </div>
                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-2.5 flex items-center justify-between">
                      <div><p className="text-[11px] text-gray-500">إجمالي المدفوع له</p><p className="font-bold text-amber-700">{fmtKWD(sTotal)} {CURRENCY}</p></div>
                      <p className="text-[11px] text-gray-500">{sPays.length} دفعة</p>
                    </div>
                    {canWriteCheck('suppliers') && <div className="flex gap-1 mt-3">
                      <FormDialog trigger={<Button variant="outline" size="sm" className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50" title="تسجيل دفعة لهذا المورد"><DollarSign size={14} className="ml-1" />تسجيل دفعة</Button>} title={`تسجيل دفعة — ${s.name}`}>{(close) => <SupplierPaymentForm suppliers={suppliers} buildings={buildings} accounts={accounts as any} initialSupplierId={s.id} onSave={async (data) => { const r: any = await api('/api/supplier-payments', 'POST', data); if (r?.entryWarning) toast.warning(r.entryWarning); autoRestore('دفعة مورد'); loadData('suppliers'); }} onClose={close} />}</FormDialog>
                      <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل المورد">{(close) => <SupplierForm initial={s} onSave={async (data) => { await api(`/api/suppliers/${s.id}`, 'PUT', data); autoRestore('تعديل مورد'); loadData('suppliers'); }} onClose={close} />}</FormDialog>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => { if (confirm(`حذف «${s.name}»؟ هتتحذف معه كل دفعاته (${sPays.length}) وقيودها المحاسبية — مفيش رجوع غير من نقاط الاستعادة.`)) { await api(`/api/suppliers/${s.id}`, 'DELETE'); autoRestore('حذف مورد'); loadData('suppliers'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>
                    </div>}
                  </CardContent></Card>
                  );
                })}
                {filteredSuppliers.length === 0 && <div className="md:col-span-2 lg:col-span-3"><EmptyState icon={<Truck size={48} />} text="لا يوجد موردين أو مقاولين — أضف أول واحد من الزر البرتقالي" /></div>}
              </div>
              {/* سجل دفعات الموردين */}
              {supplierPayments.length > 0 && (
                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-bold text-gray-800 text-sm">سجل دفعات الموردين والمقاولين</p>
                    <Select value={supplierPayFilter} onValueChange={setSupplierPayFilter}><SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الموردين</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="overflow-x-auto">
                    <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>رقم السند</TableHead><TableHead>المورد</TableHead><TableHead>التاريخ</TableHead><TableHead>المبلغ</TableHead><TableHead>البيان</TableHead><TableHead>العمارة</TableHead><TableHead>الطريقة</TableHead>{canWriteCheck('suppliers') && <TableHead>إجراءات</TableHead>}</TableRow></TableHeader>
                    <TableBody>{filteredPayments.map(p => (<TableRow key={p.id}>
                      <TableCell className="text-xs font-bold text-red-700 tabular-nums">{p.paymentNo || '-'}</TableCell>
                      <TableCell className="font-semibold text-xs">{p.supplier?.name || '-'}</TableCell>
                      <TableCell className="text-xs">{p.date ? new Date(p.date).toLocaleDateString('ar') : '-'}</TableCell>
                      <TableCell className="font-bold text-amber-700">{p.amount.toLocaleString('ar')} {CURRENCY}</TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-48 truncate">{p.description || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-500">{buildings.find(b => b.id === p.buildingId)?.name || '-'}</TableCell>
                      <TableCell className="text-xs">{({ cash: 'نقدي', transfer: 'تحويل', check: 'شيك', card: 'بطاقة' } as any)[p.method] || p.method}</TableCell>
                      {canWriteCheck('suppliers') && <TableCell><div className="flex gap-1">
                        <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title={`سند الصرف ${p.paymentNo || ''}`}><Printer size={14} /></Button>} title={`سند صرف ${p.paymentNo || ''} — مورد`} docHtml={supplierPaymentVoucherHtml(p, CURRENCY)} />
                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={async () => { if (confirm('حذف الدفعة؟ هيتحذف قيدها المحاسبي كمان.')) { await api(`/api/supplier-payments/${p.id}`, 'DELETE'); autoRestore('حذف دفعة مورد'); loadData('suppliers'); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>
                      </div></TableCell>}
                    </TableRow>))}</TableBody></Table>
                  </div>
                </Card>
              )}
            </div>
            );
          })()}

          {/* Maintenance */}
          {section === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">طلبات الصيانة</h2><PageCount n={filteredMaintenance.length} label="طلب" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="maintenance" rows={maintenance} canWrite={canWriteCheck('maintenance')} onImported={() => { loadData('maintenance'); toast.success('تم تحديث طلبات الصيانة'); }} />
                  {canWriteCheck('maintenance') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />طلب صيانة</Button>} title="طلب صيانة جديد">{(close) => <MaintenanceForm buildings={buildings} units={units} onSave={async (data) => { await api('/api/maintenance', 'POST', data); autoRestore('طلب صيانة'); loadData('maintenance'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* فلاتر الصيانة: الحالة + الأولوية — تُضبط تلقائيًا عند القدوم من لوحة التحكم (صيانة مفتوحة → مفتوحة الآن) */}
              <div className="flex gap-2 flex-wrap items-center">
                {[{ k: 'all', l: 'الكل' }, { k: 'open_active', l: 'مفتوحة الآن' }, ...Object.entries(MAINT_STATUS_MAP).map(([k, v]) => ({ k, l: v.label }))].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setMaintStatusFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${maintStatusFilter === k ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'}`}>{l}{k === 'all' ? ` (${maintenance.length})` : (k === 'open_active' ? ` (${maintenance.filter(m => ['open', 'in_progress'].includes(m.status)).length})` : ` (${maintenance.filter(m => m.status === k).length})`)}</button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs text-gray-500">الأولوية:</span>
                {[{ k: 'all', l: 'الكل' }, ...Object.entries(PRIORITY_MAP).map(([k, v]) => ({ k, l: v.label }))].map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setMaintPriorityFilter(k)} className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${maintPriorityFilter === k ? 'bg-amber-500 text-white border-amber-500 shadow' : 'bg-white text-gray-600 border-amber-200 hover:bg-amber-50'}`}>{l}{k === 'all' ? '' : ` (${maintenance.filter(m => m.priority === k).length})`}</button>
                ))}
              </div>
              <div className="grid gap-4">
                {filteredMaintenance.map(m => (
                  <Card key={m.id} className="border-0 shadow-lg"><CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap"><Badge className={MAINT_STATUS_MAP[m.status]?.color}>{MAINT_STATUS_MAP[m.status]?.label || m.status}</Badge><Badge className={PRIORITY_MAP[m.priority]?.color}>{PRIORITY_MAP[m.priority]?.label || m.priority}</Badge>{m.unit && <Badge className="bg-purple-100 text-purple-800">وحدة {m.unit.number}{m.unit.building ? ` — ${m.unit.building.name}` : ''}</Badge>}{!m.unit && (m.building ? <Badge className="bg-orange-100 text-orange-800">صيانة العمارة بكاملها — {m.building.name}</Badge> : (m.buildingId && <Badge className="bg-orange-100 text-orange-800">صيانة العمارة بكاملها</Badge>))}{m.category && m.category !== 'other' && <Badge className="bg-gray-100 text-gray-700">{MAINT_CATEGORIES[m.category] || m.category}</Badge>}</div>
                        <h3 className="font-bold text-gray-900">{m.title}</h3>
                        {m.paymentNo && <Badge className="bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold tabular-nums mt-1" title="الرقم التسلسلي لسند صرف تكلفة الصيانة">سند صرف {m.paymentNo}</Badge>}
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
                        {m.status === 'completed' && (m.cost || 0) > 0 && <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title={`سند صرف التكلفة ${m.paymentNo || ''}`}><Printer size={14} /></Button>} title={`سند صرف ${m.paymentNo || ''} — صيانة`} docHtml={maintenanceVoucherHtml(m, CURRENCY)} />}
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
                {filteredMaintenance.length === 0 && (maintenance.length === 0 ? <EmptyState icon={<Wrench size={48} />} text="لا توجد طلبات صيانة" /> : <EmptyState icon={<Search size={48} />} text="لا توجد طلبات مطابقة للفلاتر أو البحث" />)}
              </div>
            </div>
          )}

          {/* Legal Cases — المخالفات البلدية والقضايا */}
          {section === 'legalCases' && (
            <LegalCasesSection
              cases={legalCases}
              buildings={buildings}
              units={units as any}
              tenants={tenants as any}
              canWrite={canWriteCheck}
              uploadFile={uploadFile}
              refresh={() => { loadData('legalCases'); autoRestore('تحديث القضايا'); }}
              openBuilding={(id) => goBuildingDetail(id)}
            />
          )}

          {/* Audit */}
          {section === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">سجل التدقيق</h2><PageCount n={auditLogs.length} label="حركة" />
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">نقاط الاستعادة</h2><PageCount n={restorePoints.length} label="نقطة" />
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">المستخدمون</h2><PageCount n={allUsers.length} label="مستخدم" />
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
            const txIncome = transactions.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
            const txExpense = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + (t.amount || 0), 0);
            const txNet = txIncome - txExpense;
            const filteredTransactions = transactions.filter((t: any) => (txType === 'all' || t.type === txType) && (!searchQuery || (t.category || '').includes(searchQuery) || (t.type || '').includes(searchQuery) || (t.building?.name || '').includes(searchQuery) || String(t.amount).includes(searchQuery) || (t.voucherNo || '').includes(searchQuery)));
            return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الإيرادات والمصروفات</h2><PageCount n={transactions.length} label="حركة" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="transactions" rows={transactions} canWrite={canWriteCheck('transactions')} onImported={() => { loadData('transactions'); toast.success('تم تحديث الحركات المالية'); }} />
                  {canWriteCheck('transactions') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة حركة</Button>} title="إضافة حركة مالية">{(close) => <TransactionForm buildings={buildings} accounts={accounts as any} onSave={async (data) => { const r: any = await api('/api/transactions', 'POST', data); if (r?.entryWarning) toast.warning(r.entryWarning); else if (r?.distributed) toast.success(`تم توزيع المصروف على ${r.count} عمارة وتوليد قيد لكل عمارة`); else toast.success('تم الحفظ وتوليد القيد المزدوج (مدين ودائن)'); autoRestore('إضافة حركة مالية'); loadData('transactions'); }} onClose={close} />}</FormDialog>)}
                  {isAdmin && <Button variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50" title="توليد القيود المزدوجة للحركات القديمة المسجلة قبل ربط الحركات بالمحاسبة — تشغيل واحد يكفي" onClick={async () => { if (!confirm('سيتم توليد قيد محاسبي لكل حركة مالية لا قيد لها (لن يتكرر أي قيد قائم). متابعة؟')) return; try { const r: any = await api('/api/transactions/sync-journal', 'POST', {}); toast.success(`تمت المزامنة: ${r.synced} قيد جديد من أصل ${r.total} حركة${r.failedCount ? ` — تعذر على ${r.failedCount}` : ''}`); } catch (e: any) { toast.error(e.message); } }}><RefreshCw size={15} className="ml-1" />مزامنة قيود الحركات القديمة</Button>}
                </div>
              </div>
              {/* ملخص الحركات المالية — الإيرادات والمصروفات والصافي */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-emerald-600"><TrendingUp size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">إجمالي الإيرادات المسجلة</p><p className="font-bold text-sm sm:text-lg text-emerald-700 truncate">{fmtKWD(txIncome)} {CURRENCY}</p></div></div>
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-red-600"><ReceiptText size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">إجمالي المصروفات المسجلة</p><p className="font-bold text-sm sm:text-lg text-red-700 truncate">{fmtKWD(txExpense)} {CURRENCY}</p></div></div>
                <div className={`p-3.5 rounded-2xl border flex items-center gap-3 shadow-sm ${txNet >= 0 ? 'bg-teal-50 border-teal-100' : 'bg-orange-50 border-orange-100'}`}><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-teal-600"><DollarSign size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">الصافي (إيرادات − مصروفات)</p><p className={`font-bold text-sm sm:text-lg truncate ${txNet >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtKWD(txNet)} {CURRENCY}</p></div></div>
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-3 shadow-sm"><div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0 text-blue-600"><Hash size={18} /></div><div className="min-w-0"><p className="text-[11px] text-gray-600">عدد الحركات</p><p className="font-bold text-sm sm:text-lg text-blue-700">{transactions.length}</p></div></div>
              </div>
              <p className="text-[11px] text-gray-400 -mt-2">هذه الصفحة للحركات المالية المسجلة (مصروفات تشغيل، إيرادات أخرى، حصص إدارية) — أما إيجارات التحصيل من المستأجرين فتجدها في صفحة «المدفوعات» وفي لوحة الإيرادات</p>
              {/* فلتر النوع */}
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { k: 'all', l: `الكل (${transactions.length})` },
                  { k: 'income', l: `إيرادات (${transactions.filter((t: any) => t.type === 'income').length})` },
                  { k: 'expense', l: `مصروفات (${transactions.filter((t: any) => t.type === 'expense').length})` },
                ] as const).map(f => (
                  <button key={f.k} onClick={() => setTxType(f.k as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${txType === f.k ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white text-gray-600 border border-orange-100 hover:bg-orange-50'}`}>
                    {f.l}
                  </button>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
              <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-orange-50"><TableHead>رقم السند</TableHead><TableHead>التاريخ</TableHead><TableHead>العمارة</TableHead><TableHead>النوع</TableHead><TableHead>البيان</TableHead><TableHead>المبلغ</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>{filteredTransactions.map((t: any) => (<TableRow key={t.id}>
                  <TableCell><span className={`text-xs font-bold tabular-nums ${t.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>{t.voucherNo || '-'}</span></TableCell>
                  <TableCell className="text-sm">{new Date(t.date).toLocaleDateString('ar')}</TableCell>
                  <TableCell className="text-sm">{t.building?.name || '-'}</TableCell>
                  <TableCell><Badge className={t.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>{t.type === 'income' ? 'إيراد' : 'مصروف'}</Badge></TableCell>
                  <TableCell className="text-sm">{t.category || '-'}</TableCell>
                  <TableCell className="font-semibold">{t.amount?.toLocaleString('ar')} {CURRENCY}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند"><Printer size={14} /></Button>} title="سند — حركة مالية" docHtml={transactionVoucherHtml(t, CURRENCY)} />
                    {canWriteCheck('transactions') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الحركة">{(close) => <TransactionForm buildings={buildings} accounts={accounts as any} initial={t} onSave={async (data) => { const r: any = await api(`/api/transactions/${t.id}`, 'PUT', data); if (r?.entryWarning) toast.warning(r.entryWarning); else toast.success('تم التعديل وتحديث القيد المزدوج'); autoRestore('تعديل حركة مالية'); loadData('transactions'); }} onClose={close} />}</FormDialog>}
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
                    {t.voucherNo && <span className={`inline-block text-[11px] font-bold tabular-nums rounded-full px-2 py-0.5 border ${t.type === 'income' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>سند {t.voucherNo}</span>}
                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="flex items-center gap-1"><Calendar size={13} />{new Date(t.date).toLocaleDateString('ar')}</p>
                      <p>{t.category || '-'}{t.building?.name ? ` — ${t.building.name}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                      <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50" title="سند"><Printer size={14} /></Button>} title="سند — حركة مالية" docHtml={transactionVoucherHtml(t, CURRENCY)} />
                      {canWriteCheck('transactions') && <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل الحركة">{(close) => <TransactionForm buildings={buildings} accounts={accounts as any} initial={t} onSave={async (data) => { const r: any = await api(`/api/transactions/${t.id}`, 'PUT', data); if (r?.entryWarning) toast.warning(r.entryWarning); else toast.success('تم التعديل وتحديث القيد المزدوج'); autoRestore('تعديل حركة مالية'); loadData('transactions'); }} onClose={close} />}</FormDialog>}
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
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">القروض</h2><PageCount n={loans.length} label="قرض" />
                  <p className="text-sm text-gray-500 mt-0.5">كل قرض بأقساطه وسنداته في مكان واحد</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="loans" rows={loans} canWrite={canWriteCheck('loans')} onImported={() => { loadData('loans'); toast.success('تم تحديث قائمة القروض'); }} />
                  {canWriteCheck('loans') && (<FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />إضافة قرض</Button>} title="إضافة قرض جديد">{(close) => <LoanForm buildings={buildings} onSave={async (data) => { await api('/api/loans', 'POST', data); refresh('إضافة قرض'); }} onClose={close} />}</FormDialog>)}
                </div>
              </div>
              {/* ملخص القروض */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {[
                  { label: 'إجمالي القروض (الأصل)', value: `${fmtKWD(totalPrincipal)} ${CURRENCY}`, icon: <Briefcase size={16} />, cls: 'bg-purple-50 text-purple-700' },
                  { label: 'المسدد من الأصل', value: `${fmtKWD(totalPaidPrincipal)} ${CURRENCY}`, icon: <CheckCircle2 size={16} />, cls: 'bg-emerald-50 text-emerald-700' },
                  { label: 'المتبقي (رصيد القروض)', value: `${fmtKWD(totalRemaining)} ${CURRENCY}`, icon: <AlertTriangle size={16} />, cls: 'bg-red-50 text-red-700' },
                  { label: 'الفوائد المسددة', value: `${fmtKWD(totalInterestPaid)} ${CURRENCY}`, icon: <Percent size={16} />, cls: 'bg-amber-50 text-amber-700' },
                  { label: 'إجمالي المسدد (أصل + فوائد)', value: `${fmtKWD(totalPaidPrincipal + totalInterestPaid)} ${CURRENCY}`, icon: <DollarSign size={16} />, cls: 'bg-teal-50 text-teal-700' },
                  { label: 'نسبة سداد الأصل', value: `${totalPrincipal > 0 ? Math.min(100, Math.round((totalPaidPrincipal / totalPrincipal) * 100)) : 0}%`, icon: <Activity size={16} />, cls: 'bg-blue-50 text-blue-700' },
                ].map((s, i) => (
                  <div key={i} className={`p-3.5 rounded-2xl ${s.cls} flex items-center gap-3 shadow-sm`}>
                    <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">{s.icon}</div>
                    <div className="min-w-0"><p className="text-[11px] text-gray-600">{s.label}</p><p className="font-bold text-sm sm:text-lg truncate">{s.value}</p></div>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">شجرة الحسابات</h2><PageCount n={accounts.length} label="حساب" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  {isAdmin && <Button variant="outline" className="border-orange-200 text-orange-700" onClick={async () => { if (!confirm('سيتم إنشاء الحسابات الافتراضية غير الموجودة فقط — لن يتم تعديل أو حذف أي حساب قائم. متابعة؟')) return; try { const r = await api<any>('/api/accounts/seed', 'POST'); toast.success(`تم الاستيراد: ${r.created} حساب جديد — ${r.skipped.length} موجود مسبقاً (من إجمالي ${r.total})`); loadData('accounts'); } catch (e: any) { toast.error(e.message); } }}>إنشاء الشجرة الافتراضية</Button>}
                  <ExcelToolbar entity="accounts" rows={accounts} canWrite={canWriteCheck('accounts')} onImported={() => { loadData('accounts'); toast.success('تم تحديث شجرة الحسابات'); }} />
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">القيود اليومية</h2><PageCount n={journalEntries.length} label="قيد" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9 w-full sm:w-48 border-orange-200 focus:border-orange-500" /></div>
                  <ExcelToolbar entity="journal" rows={journalEntries} canWrite={false} importEnabled={false} onImported={() => {}} />
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">ميزان المراجعة</h2><PageCount n={filtered.length} label="حساب" />
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
              {user.role === 'admin' && <ResetDemoDataCard onDone={clearAllData} />}
            </div>
          )}

          {/* Files */}
          {section === 'files' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl sm:text-2xl font-bold text-gray-900">الملفات والصور</h2><PageCount n={allFiles.length} label="ملف" />
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

// ============ سجل العميل — كل تفاصيل العميل: الدفعات والالتزام والعقود والقضايا ============
function TenantHistoryDialog({ trigger, tenant, contracts, payments, legalCases }: {
  trigger: React.ReactNode;
  tenant: Tenant;
  contracts: Contract[];
  payments: Payment[];
  legalCases: any[];
}) {
  // عقود العميل — الأحدث أولاً
  const tContracts = contracts.filter(c => c.tenantId === tenant.id).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const tContractIds = new Set(tContracts.map(c => c.id));
  const tPayments = payments.filter(p => tContractIds.has(p.contractId));
  const tCases = legalCases.filter((lc: any) => lc.tenantId === tenant.id);
  const openCases = tCases.filter((lc: any) => lc.status === 'open' || lc.status === 'in_progress');

  // الملخص المالي والالتزام — نفس منطق صفحة العقود (contractBalance)
  let totalDue = 0, totalPaid = 0, outstanding = 0;
  for (const c of tContracts) {
    try {
      const bal = contractBalance(c as any, (c.payments || []) as any);
      totalDue += bal.totalDue; totalPaid += bal.totalPaid; outstanding += bal.outstanding;
    } catch {}
  }
  const commitmentPct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 100;
  const verdict = outstanding <= 0
    ? { label: 'ملتزم بالكامل', color: 'bg-emerald-100 text-emerald-800', ring: 'border-emerald-200' }
    : commitmentPct >= 80
      ? { label: 'التزام جيد — عليه متأخر', color: 'bg-amber-100 text-amber-800', ring: 'border-amber-200' }
      : { label: 'متأخر عن السداد', color: 'bg-red-100 text-red-800', ring: 'border-red-200' };

  // انتظام الدفع: كل دفعة — هل دُفعت في موعدها؟
  const paidRows = tPayments.filter(p => p.status === 'paid' || p.status === 'partial').map(p => {
    const due = p.dueDate ? new Date(p.dueDate) : null;
    const paid = p.paidDate ? new Date(p.paidDate) : null;
    let punctuality: { label: string; cls: string };
    if (!paid || !due) punctuality = { label: '—', cls: 'text-gray-400' };
    else {
      const diffDays = Math.round((paid.getTime() - due.getTime()) / 86400000);
      if (diffDays <= 0) punctuality = { label: diffDays === 0 ? 'في الموعد ✓' : `قبل الموعد بـ ${Math.abs(diffDays)} يوم ✓`, cls: 'text-emerald-700 font-semibold' };
      else punctuality = { label: `متأخر ${diffDays} يوم`, cls: 'text-red-700 font-semibold' };
    }
    const c = tContracts.find(x => x.id === p.contractId);
    return { ...p, punctuality, unitNumber: c?.unit?.number || '-', buildingName: c?.unit?.building?.name || '-' };
  }).sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || ''));
  const lateCount = paidRows.filter(r => r.punctuality.label.includes('متأخر')).length;

  // كل عقود العميل مع الأرصدة — النشط والمنتهي (الالتزام التاريخي)
  const openBalances = tContracts.map(c => {
    try {
      const bal = contractBalance(c as any, (c.payments || []) as any);
      return { c, bal };
    } catch { return null; }
  }).filter(Boolean) as { c: Contract; bal: { totalDue: number; totalPaid: number; outstanding: number } }[];

  const CASE_TYPE: Record<string, { label: string; color: string }> = {
    municipal: { label: 'مخالفة بلدية', color: 'bg-amber-100 text-amber-800' },
    lawsuit: { label: 'قضية', color: 'bg-red-100 text-red-800' },
    other: { label: 'أخرى', color: 'bg-gray-100 text-gray-700' },
  };
  const CASE_STATUS: Record<string, { label: string; color: string }> = {
    open: { label: 'مفتوحة', color: 'bg-red-100 text-red-800' },
    in_progress: { label: 'جارية', color: 'bg-amber-100 text-amber-800' },
    paid: { label: 'مسددة', color: 'bg-emerald-100 text-emerald-800' },
    closed: { label: 'مغلقة', color: 'bg-gray-100 text-gray-700' },
  };
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const d = (s?: string | null) => s ? new Date(s).toLocaleDateString('ar-EG') : '-';

  return (
    <FormDialog trigger={trigger} title={`سجل العميل — ${tenant.name}`} maxWidth="max-w-4xl">
      {() => (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pl-1">
          {/* بيانات العميل */}
          <div className={`bg-gray-50 rounded-xl p-3 border ${verdict.ring} text-sm space-y-1`}>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${TENANT_TYPE_LABEL[tenant.tenantType || 'individual']?.color} text-[10px]`}>{TENANT_TYPE_LABEL[tenant.tenantType || 'individual']?.label}</Badge>
              {tenant.tenantType === 'company' && tenant.commercialReg && <span className="text-gray-500">س.ت: {tenant.commercialReg}</span>}
              {tenant.idNumber && <span className="text-gray-500">{tenant.idType === 'passport' ? 'جواز سفر' : 'هوية'}: {tenant.idNumber}</span>}
              {tenant.phone && <span className="flex items-center gap-1 text-gray-600"><Phone size={12} />{tenant.phone}</span>}
              {tenant.email && <span className="flex items-center gap-1 text-gray-600"><Mail size={12} />{tenant.email}</span>}
            </div>
            {tenant.address && <p className="text-gray-500 text-xs flex items-center gap-1"><MapPin size={12} />{tenant.address}</p>}
            {tenant.guarantor && <p className="text-gray-500 text-xs flex items-center gap-1"><UserPlus size={12} />الضامن: {tenant.guarantor}{tenant.guarantorPhone ? ` — ${tenant.guarantorPhone}` : ''}</p>}
          </div>

          {/* ملخص الالتزام المالي */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <p className="text-xs font-bold text-gray-700 flex items-center gap-1"><DollarSign size={13} />ملخص الحساب والالتزام</p>
              <Badge className={verdict.color}>{verdict.label}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-emerald-50 rounded-lg text-center border border-emerald-100"><p className="text-[10px] text-gray-600">المستحق حتى اليوم</p><p className="text-base font-bold text-emerald-700">{fmt(totalDue)} {CURRENCY}</p></div>
              <div className="p-2.5 bg-indigo-50 rounded-lg text-center border border-indigo-100"><p className="text-[10px] text-gray-600">المدفوع</p><p className="text-base font-bold text-indigo-700">{fmt(totalPaid)} {CURRENCY}</p></div>
              <div className="p-2.5 bg-red-50 rounded-lg text-center border border-red-100"><p className="text-[10px] text-gray-600">المتبقي (المتأخرات)</p><p className={`text-base font-bold ${outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(outstanding)} {CURRENCY}</p></div>
              <div className="p-2.5 bg-teal-50 rounded-lg text-center border border-teal-100"><p className="text-[10px] text-gray-600">نسبة الالتزام</p><p className="text-base font-bold text-teal-700">{commitmentPct}%</p></div>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              {tContracts.length > 0 ? `${tContracts.length} عقد — ` : 'لا توجد عقود — '}
              {paidRows.length} دفعة مسجلة{paidRows.length > 0 ? (lateCount > 0 ? ` — دفع متأخر في ${lateCount} مرة` : ' — لم يتأخر في أي دفعة ✓') : ''}
              {tCases.length > 0 ? ` — ${tCases.length} قضية/مخالفة (${openCases.length} مفتوحة)` : ' — لا توجد قضايا ✓'}
            </p>
          </div>

          {/* سجل الدفعات — دفع امتا وكام والتزم ولا لا */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><ReceiptText size={13} />سجل الدفعات — دفع امتى وكام</p>
            {paidRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <Table>
                  <TableHeader><TableRow className="bg-orange-50"><TableHead>تاريخ الدفع</TableHead><TableHead>المبلغ</TableHead><TableHead>عن شهر</TableHead><TableHead>العمارة / الوحدة</TableHead><TableHead>الطريقة</TableHead><TableHead>المرجع</TableHead><TableHead>الالتزام</TableHead></TableRow></TableHeader>
                  <TableBody>{paidRows.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm whitespace-nowrap">{d(p.paidDate)}</TableCell>
                      <TableCell className="font-bold text-sm whitespace-nowrap">{fmt(p.amount)} {CURRENCY}</TableCell>
                      <TableCell className="text-sm">{p.month || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-600">{p.buildingName} — {p.unitNumber}</TableCell>
                      <TableCell className="text-sm">{p.method === 'cash' ? 'نقدي' : p.method === 'check' ? 'شيك' : p.method === 'transfer' ? 'تحويل' : p.method || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-500">{p.reference || '-'}</TableCell>
                      <TableCell className={`text-xs ${p.punctuality.cls}`}><span title={p.status === 'partial' ? 'دفع جزئي' : ''}>{p.punctuality.label}{p.status === 'partial' ? ' (جزئي)' : ''}</span></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">لم يسجل أي دفعة بعد{outstanding > 0 ? ` — عليه ${fmt(outstanding)} ${CURRENCY} مستحقة` : ''}</p>
            )}
          </div>

          {/* العقود — كل العقود مع الأرصدة والحالة */}
          {openBalances.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><FileText size={13} />العقود — الإيجار والالتزام (الحالية والمنتهية)</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <Table>
                  <TableHeader><TableRow className="bg-blue-50"><TableHead>الوحدة</TableHead><TableHead>العمارة</TableHead><TableHead>الإيجار شهرياً</TableHead><TableHead>الفترة</TableHead><TableHead>الحالة</TableHead><TableHead>المستحق</TableHead><TableHead>المدفوع</TableHead><TableHead>المتبقي</TableHead></TableRow></TableHeader>
                  <TableBody>{openBalances.map(({ c, bal }) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm font-medium">{c.unit?.number || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-600">{c.unit?.building?.name || '-'}</TableCell>
                      <TableCell className="text-sm">{fmt(effectiveRent(c as any))} {CURRENCY}{(c.discount || 0) > 0 ? <span className="text-[10px] text-gray-500 block">قبل الخصم {fmt(c.rentAmount)} — خصم {fmt(c.discount || 0)} شهرياً</span> : null}</TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">{d(c.startDate)} → {d(c.endDate)}</TableCell>
                      <TableCell><Badge className={`${CONTRACT_STATUS_MAP[c.status]?.color || 'bg-gray-100'} text-[10px]`}>{CONTRACT_STATUS_MAP[c.status]?.label || c.status}</Badge></TableCell>
                      <TableCell className="text-sm text-emerald-700">{fmt(bal.totalDue)}</TableCell>
                      <TableCell className="text-sm text-indigo-700">{fmt(bal.totalPaid)}</TableCell>
                      <TableCell className={`text-sm font-bold ${bal.outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(bal.outstanding)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* القضايا والمخالفات */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Gavel size={13} />القضايا والمخالفات على العميل</p>
            {tCases.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <Table>
                  <TableHeader><TableRow className="bg-red-50"><TableHead>النوع</TableHead><TableHead>العنوان</TableHead><TableHead>الرقم</TableHead><TableHead>الحالة</TableHead><TableHead>تاريخ التقديم</TableHead><TableHead>الجلسة القادمة</TableHead><TableHead>المبلغ</TableHead></TableRow></TableHeader>
                  <TableBody>{tCases.map((lc: any) => (
                    <TableRow key={lc.id}>
                      <TableCell><Badge className={`${CASE_TYPE[lc.type]?.color || 'bg-gray-100'} text-[10px]`}>{CASE_TYPE[lc.type]?.label || lc.type}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{lc.title}</TableCell>
                      <TableCell className="text-xs text-gray-500">{lc.reference || '-'}</TableCell>
                      <TableCell><Badge className={`${CASE_STATUS[lc.status]?.color || 'bg-gray-100'} text-[10px]`}>{CASE_STATUS[lc.status]?.label || lc.status}</Badge></TableCell>
                      <TableCell className="text-sm">{d(lc.filedDate)}</TableCell>
                      <TableCell className={`text-sm ${(lc.hearingDate && new Date(lc.hearingDate) <= new Date(Date.now() + 14 * 86400000)) ? 'text-red-700 font-bold' : ''}`}>{d(lc.hearingDate)}</TableCell>
                      <TableCell className="text-sm">{lc.amount ? `${fmt(lc.amount)} ${CURRENCY}` : '-'}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-emerald-700 text-center py-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center gap-1"><CheckCircle2 size={14} />لا توجد قضايا أو مخالفات على العميل</p>
            )}
          </div>
        </div>
      )}
    </FormDialog>
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
  const [buildingId, setBuildingId] = useState(initial?.buildingId || ''); const [number, setNumber] = useState(initial?.number || ''); const [floor, setFloor] = useState(String(initial?.floor || '')); const [area, setArea] = useState(String(initial?.area || '')); const [type, setType] = useState(initial?.type || 'apartment'); const [status, setStatus] = useState(initial?.status || 'available'); const [rentAmount, setRentAmount] = useState(String(initial?.rentAmount || '')); const [notes, setNotes] = useState(initial?.notes || '');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ buildingId, number, floor: floor ? +floor : null, area: area ? +area : null, type, status, rentAmount: rentAmount ? +rentAmount : null, notes }); toast.success(initial ? 'تم تعديل الوحدة' : 'تم إنشاء الوحدة'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>المبنى</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="اختر المبنى" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>رقم الوحدة</Label><Input value={number} onChange={e => setNumber(e.target.value)} required /></div>
    <div><Label>الطابق</Label><Input type="number" value={floor} onChange={e => setFloor(e.target.value)} /></div>
    <div><Label>المساحة (م²)</Label><Input type="number" value={area} onChange={e => setArea(e.target.value)} /></div>
    <div><Label>النوع</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(UNIT_TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>حالة الوحدة</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(UNIT_STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-gray-400 mt-1">مؤجرة تعني إن الوحدة مستأجرة فعليًا — إنشاء عقد نشط يجعلها مؤجرة تلقائيًا</p></div>
    <div><Label>قيمة الإيجار</Label><Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} /></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function TenantForm({ onSave, initial, onClose }: { onSave: (data: any) => Promise<void>; initial?: Tenant; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [tenantType, setTenantType] = useState(initial?.tenantType || 'individual'); const [commercialReg, setCommercialReg] = useState(initial?.commercialReg || ''); const [name, setName] = useState(initial?.name || ''); const [phone, setPhone] = useState(initial?.phone || ''); const [email, setEmail] = useState(initial?.email || ''); const [idNumber, setIdNumber] = useState(initial?.idNumber || ''); const [address, setAddress] = useState(initial?.address || ''); const [guarantor, setGuarantor] = useState((initial as any)?.guarantor || ''); const [guarantorPhone, setGuarantorPhone] = useState((initial as any)?.guarantorPhone || ''); const [notes, setNotes] = useState(initial?.notes || '');
  const isCompany = tenantType === 'company';
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ name, tenantType, commercialReg: isCompany ? commercialReg : null, phone, email, idNumber, idType: isCompany ? 'commercial' : (initial?.idType || 'national'), address, guarantor: isCompany ? '' : guarantor, guarantorPhone: isCompany ? '' : guarantorPhone, notes }); toast.success(initial ? 'تم تعديل المستأجر' : 'تم إنشاء المستأجر'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>نوع المستأجر</Label><div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setTenantType('individual')} className={`p-3 rounded-xl border-2 text-sm font-semibold transition ${!isCompany ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-500 hover:border-teal-200'}`}><Users size={18} className="mx-auto mb-1" />فرد / عائلة<small className="block text-[10px] font-normal mt-1">التحصيل كل مستأجر بروحه</small></button>
      <button type="button" onClick={() => setTenantType('company')} className={`p-3 rounded-xl border-2 text-sm font-semibold transition ${isCompany ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 text-gray-500 hover:border-indigo-200'}`}><Briefcase size={18} className="mx-auto mb-1" />شركة<small className="block text-[10px] font-normal mt-1">التحصيل بشيك مجمّع للعمارة</small></button>
    </div></div>
    <div><Label>{isCompany ? 'اسم الشركة' : 'الاسم'}</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
    {isCompany && <div><Label>رقم السجل التجاري</Label><Input value={commercialReg} onChange={e => setCommercialReg(e.target.value)} placeholder="اختياري" /></div>}
    <div><Label>الهاتف</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
    <div><Label>البريد</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
    <div><Label>{isCompany ? 'رقم الترخيص / التسجيل' : 'رقم الهوية'}</Label><Input value={idNumber} onChange={e => setIdNumber(e.target.value)} /></div>
    <div><Label>العنوان</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
    {!isCompany && (<><div><Label>اسم الضامن</Label><Input value={guarantor} onChange={e => setGuarantor(e.target.value)} /></div>
    <div><Label>هاتف الضامن</Label><Input value={guarantorPhone} onChange={e => setGuarantorPhone(e.target.value)} /></div></>)}
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function ContractForm({ units, tenants, buildings, onSave, initial, onClose }: { units: Unit[]; tenants: Tenant[]; buildings: Building[]; onSave: (data: any) => Promise<void>; initial?: Contract; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState(initial?.unit?.buildingId || ''); const [unitId, setUnitId] = useState(initial?.unitId || ''); const [tenantId, setTenantId] = useState(initial?.tenantId || ''); const [startDate, setStartDate] = useState(initial?.startDate ? new Date(initial.startDate).toISOString().slice(0,10) : ''); const [endDate, setEndDate] = useState(initial?.endDate ? new Date(initial.endDate).toISOString().slice(0,10) : ''); const [rentAmount, setRentAmount] = useState(String(initial?.rentAmount || '')); const [discount, setDiscount] = useState(String((initial as any)?.discount || 0)); const [deposit, setDeposit] = useState(String(initial?.deposit || '0')); const [paymentDay, setPaymentDay] = useState(String(initial?.paymentDay || '1')); const [notes, setNotes] = useState(initial?.notes || '');
  const [updateDefaultRent, setUpdateDefaultRent] = useState(false);
  const filteredUnits = buildingId ? units.filter(u => u.buildingId === buildingId) : units;
  const selectedUnit = units.find(u => u.id === unitId);
  const rentNum = parseFloat(rentAmount) || 0;
  const discNum = parseFloat(discount) || 0;
  const effRent = Math.max(0, rentNum - discNum);
  // عند اختيار وحدة جديدة (إنشاء عقد جديد): تعبئة الإيجار الافتراضي تلقائياً — قيمة العقد قابلة للتعديل
  const handleUnitChange = (id: string) => { setUnitId(id); if (!initial) { const u = units.find(x => x.id === id); if (u?.rentAmount) setRentAmount(String(u.rentAmount)); } };
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ unitId, tenantId, startDate, endDate, rentAmount: +rentAmount, discount: +discount || 0, deposit: +deposit, paymentDay: +paymentDay, notes, updateDefaultRent }); toast.success(initial ? 'تم تعديل العقد' : 'تم إنشاء العقد'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>المبنى</Label><Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setUnitId(''); }}><SelectTrigger><SelectValue placeholder="اختر المبنى أولاً" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>الوحدة</Label><Select value={unitId} onValueChange={handleUnitChange}><SelectTrigger><SelectValue placeholder={buildingId ? 'اختر الوحدة' : 'اختر المبنى أولاً'} /></SelectTrigger><SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>وحدة {u.number}{u.status === 'rented' ? ' (مؤجرة)' : ''}{u.rentAmount ? ` — افتراضي ${u.rentAmount}` : ''}</SelectItem>)}</SelectContent></Select></div>
    {selectedUnit?.rentAmount && <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg">الإيجار الافتراضي للوحدة: <b>{selectedUnit.rentAmount} {CURRENCY}</b> — عدّل قيمة العقد المتفق عليها أدناه إن اختلفت، ولن تتأثر القيمة الافتراضية إلا إذا فعّلت الخيار الأخير</p>}
    <div><Label>المستأجر</Label><Select value={tenantId} onValueChange={setTenantId}><SelectTrigger><SelectValue placeholder="اختر المستأجر" /></SelectTrigger><SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {TENANT_TYPE_LABEL[t.tenantType || 'individual']?.label}</SelectItem>)}</SelectContent></Select></div>
    {tenants.find(t => t.id === tenantId)?.tenantType === 'company' && <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 p-2 rounded-lg">مستأجر شركة — التحصيل عادةً بشيك مجمّع للعمارة كاملة (زر «تحصيل شيك شركة» في صفحة المدفوعات)</p>}
    <div className="grid grid-cols-2 gap-3"><div><Label>تاريخ البداية</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required /></div><div><Label>تاريخ النهاية</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required /></div></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>الإيجار الشهري قبل الخصم ({CURRENCY})</Label><Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} required /></div><div><Label>الخصم الشهري ({CURRENCY})</Label><Input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></div></div>
    {rentNum > 0 && (<div className={`rounded-xl border p-3 space-y-2 ${discNum > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className="text-xs font-bold text-gray-700">بيان قيمة الإيجار — يوضح للعميل</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[10px] text-gray-500">القيمة السنوية قبل الخصم</p><p className="font-bold text-gray-800">{fmtKWD(rentNum * 12)} {CURRENCY}</p></div>
        <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[10px] text-gray-500">القيمة السنوية بعد الخصم</p><p className="font-bold text-emerald-700">{fmtKWD(effRent * 12)} {CURRENCY}</p></div>
        <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[10px] text-gray-500">القيمة الشهرية بعد الخصم</p><p className="font-bold text-emerald-700">{fmtKWD(effRent)} {CURRENCY}</p></div>
        <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[10px] text-gray-500">قيمة الخصم</p><p className="font-bold text-red-600">{discNum > 0 ? `${fmtKWD(discNum)} شهرياً — ${fmtKWD(discNum * 12)} سنوياً` : 'بدون خصم'}</p></div>
      </div>
      {discNum >= rentNum && <p className="text-[11px] text-red-700 font-semibold">تنبيه: الخصم يساوي أو يزيد عن الإيجار — الإيجار الفعلي سيصبح صفراً</p>}
    </div>)}
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
    <div><Label>العقد</Label><Select value={contractId} onValueChange={setContractId}><SelectTrigger><SelectValue placeholder="اختر العقد" /></SelectTrigger><SelectContent>{filteredContracts.map(c => <SelectItem key={c.id} value={c.id}>{c.startDate ? new Date(c.startDate).toLocaleDateString('ar-EG') : 'عقد'} — {c.tenant?.name || 'بدون مستأجر'} — وحدة {c.unit?.number || '?'}</SelectItem>)}</SelectContent></Select></div>
    {selected?.tenant?.tenantType === 'company' && (
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-900">
        <p className="font-bold flex items-center gap-2"><Landmark size={15} />هذا مستأجر شركة</p>
        <p className="text-xs mt-1">التحصيل مع الشركات عادةً بشيك أو تحويل واحد للعمارة كاملة يوزع على كل العقود — استخدم زر «تحصيل شيك شركة (مجمّع)» في أعلى الصفحة، أو سجّل هنا دفعة جزئية على هذا العقد وحده</p>
      </div>
    )}
    {selected && balance && (<div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1 text-sm">
      <p className="font-semibold text-gray-800">{selected.tenant?.name} — وحدة {selected.unit?.number}{selected.unit?.building ? ` (${selected.unit.building.name})` : ''}</p>
      <p className="text-gray-600">الإيجار الشهري: <b>{fmtKWD(effectiveRent(selected as any))} {CURRENCY}</b>{(selected.discount || 0) > 0 ? <span className="text-amber-700"> (قبل الخصم {fmtKWD(selected.rentAmount)} — خصم {fmtKWD(selected.discount)} — سجّل الدفعات بالقيمة بعد الخصم)</span> : ''} — مدفوعات مسجلة: {(selected.payments || []).length}</p>
      <p className="text-gray-600">المستحق حتى الآن: <b>{fmtKWD(balance.totalDue)}</b> — المدفوع فعلياً: <b className="text-emerald-700">{fmtKWD(balance.totalPaid)}</b> — <span className={balance.outstanding > 0 ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}>المتبقي: {fmtKWD(balance.outstanding)} {CURRENCY}</span></p>
    </div>)}
    <div><Label>المبلغ ({CURRENCY})</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>عن شهر</Label><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div><div><Label>تاريخ الاستحقاق</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></div></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>طريقة الدفع</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="transfer">تحويل</SelectItem><SelectItem value="check">شيك</SelectItem><SelectItem value="card">بطاقة</SelectItem></SelectContent></Select></div><div><Label>رقم المرجع</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

// ============ تسجيل دفعات متعددة — تحصيل جماعي لعدة عملاء في عملية واحدة ============
// بدل تسجيل دفعة لكل مستأجر على حدة: حدد العملاء المسددين، المبلغ يُعبأ تلقائيًا بالمتبقي لكل واحد
// (قابل للتعديل — أقل من الإيجار = جزئية)، وتاريخ/وسيلة دفع/مرجع مشتركة، وكل دفعة تولّد قيدها المحاسبي
function MultiPaymentForm({ contracts, buildings, onSave, onClose }: { contracts: Contract[]; buildings: Building[]; onSave: (data: any) => Promise<void>; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  // المحددون: { معرف العقد: المبلغ } — نص لإدخال حر، والفراغ يعني «لم يُدخل مبلغ بعد»
  const [selected, setSelected] = useState<Record<string, string>>({});

  // العقود المؤهلة: النشطة فقط — مرتبة بالعمارة ثم رقم الوحدة (ترتيب التحصيل الميداني)
  const withBal = contracts
    .filter(c => c.status === 'active' || c.status === 'renewed')
    .map(c => ({ c, bal: contractBalance(c as any, (c.payments || []) as any, new Date(date)) }))
    .sort((a, b) => (a.c.unit?.building?.name || '').localeCompare(b.c.unit?.building?.name || '', 'ar') || String(a.c.unit?.number || '').localeCompare(String(b.c.unit?.number || ''), 'ar', { numeric: true }));
  const shown = withBal.filter(({ c }) =>
    (!buildingId || c.unit?.buildingId === buildingId) &&
    (!search || (c.tenant?.name || '').includes(search) || String(c.unit?.number || '').includes(search)));

  const toggle = (id: string, outstanding: number) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id] !== undefined) delete next[id];
      else next[id] = outstanding > 0 ? String(outstanding) : '';
      return next;
    });
  };
  // تحديد الكل: كل ظاهر له متبقٍ يُعبأ بالمتبقي — المسددون بالكامل لا يُحددون
  const selectAll = () => {
    const next: Record<string, string> = { ...selected };
    shown.forEach(({ c, bal }) => { if (bal.outstanding > 0) next[c.id] = String(bal.outstanding); });
    setSelected(next);
  };
  const clearAll = () => setSelected({});
  const entries = Object.entries(selected).map(([cid, amt]) => ({ cid, amount: +amt || 0 })).filter(e => e.amount > 0);
  const total = Math.round(entries.reduce((s, e) => s + e.amount, 0) * 1000) / 1000;

  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ items: entries.map(en => ({ contractId: en.cid, amount: en.amount, month: month || null })), date, method, reference, notes }); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-900">
      <p className="font-bold flex items-center gap-2"><Users size={15} />تحصيل جماعي — عدة عملاء في عملية واحدة</p>
      <p className="text-xs mt-1">حدد كل عميل سدد اليوم ويُعبأ مبلغه تلقائيًا بالمتبقي عليه (عدّله لو دفع جزء)، والتاريخ والوسيلة والمرجع مشتركة للكل. كل دفعة تولّد قيدها المحاسبي على عمارتها.</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>العمارة (فلتر)</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="كل المباني" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>بحث باسم العميل أو الوحدة</Label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="مثال: أحمد أو 12" /></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>تاريخ الدفع (للجميع)</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
      <div><Label>عن شهر (للجميع — اختياري)</Label><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>طريقة الدفع</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">نقدي</SelectItem><SelectItem value="transfer">تحويل</SelectItem><SelectItem value="check">شيك</SelectItem><SelectItem value="card">بطاقة</SelectItem></SelectContent></Select></div>
      <div><Label>رقم المرجع / سند</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="اختياري" /></div>
    </div>
    {withBal.length === 0 ? (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">لا توجد عقود نشطة — سجّل عقودًا أولًا أو استخدم «تسجيل دفعة» العادية</p>
    ) : (
      <div className="border border-orange-100 rounded-xl overflow-hidden">
        <div className="bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900 flex items-center justify-between gap-2 flex-wrap">
          <span>العقود النشطة ({shown.length}{buildingId || search ? ` من ${withBal.length}` : ''}) — إجمالي المتبقي: {fmtKWD(shown.reduce((s, x) => s + x.bal.outstanding, 0))} {CURRENCY}</span>
          <span className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={selectAll}>تحديد الكل بالمتبقي</Button>
            <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px] border-gray-300 text-gray-600" onClick={clearAll}>مسح التحديد</Button>
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
          {shown.map(({ c, bal }) => {
            const sel = selected[c.id] !== undefined;
            return (<div key={c.id} className={`px-3 py-2 flex items-center gap-2 ${sel ? 'bg-emerald-50/60' : ''}`}>
              <input type="checkbox" className="w-4 h-4 shrink-0 accent-emerald-600" checked={sel} onChange={() => toggle(c.id, bal.outstanding)} aria-label={`تحديد ${c.tenant?.name || 'عميل'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {c.tenant?.name || 'بدون مستأجر'}
                  {c.tenant?.tenantType === 'company' && <span className="mr-1 text-[10px] bg-indigo-100 text-indigo-800 rounded px-1 py-0.5">شركة</span>}
                  <span className="font-normal text-gray-400"> — وحدة {c.unit?.number || '?'} • {c.unit?.building?.name || '-'}</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  إيجار بعد الخصم {fmtKWD(effectiveRent(c as any))} {CURRENCY} — متبقٍ <b className={bal.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmtKWD(bal.outstanding)}</b> {CURRENCY}
                  {bal.outstanding <= 0 && sel && <span className="text-amber-700"> — مسدد بالكامل (أدخل مبلغًا لتسجيله دفعة مقدمة)</span>}
                </p>
              </div>
              {sel && (
                <div className="flex items-center gap-1 shrink-0">
                  <Input type="number" step="0.001" min="0" value={selected[c.id]} onChange={e => setSelected(prev => ({ ...prev, [c.id]: e.target.value }))} className="w-24 h-8 text-xs" placeholder="المبلغ" required />
                  {bal.outstanding > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] text-emerald-700 hover:bg-emerald-100" onClick={() => setSelected(prev => ({ ...prev, [c.id]: String(bal.outstanding) }))}>المتبقي</Button>}
                </div>
              )}
            </div>);
          })}
          {shown.length === 0 && <p className="px-3 py-4 text-xs text-gray-500 text-center">لا نتائج مطابقة للفلتر أو البحث</p>}
        </div>
      </div>
    )}
    {entries.length > 0 && (
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between text-sm">
        <span className="font-bold text-gray-800">سيتم تسجيل {entries.length} دفعة{month ? ` عن شهر ${month}` : ''}</span>
        <span className="font-bold text-emerald-700">الإجمالي: {fmtKWD(total)} {CURRENCY}</span>
      </div>
    )}
    <div><Label>ملاحظات (تُوثق على كل دفعة)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving || entries.length === 0} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري حفظ الدفعات...' : entries.length > 0 ? `حفظ ${entries.length} دفعة — إجمالي ${fmtKWD(total)} ${CURRENCY}` : 'حدد عميلًا واحدًا على الأقل'}</Button>
  </form>);
}

// ============ الموردين والمقاولين — إضافة/تعديل مورد + تسجيل دفعات عليه بقيود محاسبية ============
const SUPPLIER_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  contractor: { label: 'مقاول', color: 'bg-amber-100 text-amber-800' },
  supplier: { label: 'مورد', color: 'bg-teal-100 text-teal-800' },
};

function SupplierForm({ onSave, initial, onClose }: { onSave: (data: any) => Promise<void>; initial?: any; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'contractor');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [specialty, setSpecialty] = useState(initial?.specialty || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ name, type, phone, specialty, notes }); toast.success(initial ? 'تم تعديل بيانات المورد' : 'تم إضافة المورد'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-900">
      <p className="font-bold flex items-center gap-2"><Truck size={14} />{initial ? 'تعديل بيانات' : 'إضافة'} {type === 'contractor' ? 'مقاول' : 'مورد'}</p>
      <p className="mt-1">سجّل المقاولين والموردين اللي بيشتغلوا في عماراتك، وبعدين سجّل لهم الدفعات من زر «تسجيل دفعة» — كل دفعة تولّد قيد مصروف على عمارتها.</p>
    </div>
    <div><Label>الاسم *</Label><Input value={name} onChange={e => setName(e.target.value)} required placeholder="مثال: مؤسسة النور للمقاولات" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>النوع</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contractor">مقاول (يشتغل بالتنفيذ)</SelectItem><SelectItem value="supplier">مورد (يوفر مواد)</SelectItem></SelectContent></Select></div>
      <div><Label>الهاتف</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="اختياري" /></div>
    </div>
    <div><Label>التخصص / الشغلانة</Label><Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="مثال: سباكة — كهرباء — مصاعد — تشطيبات" /></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="اتفاقيات — أرقام عقود — أي تفاصيل" /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

function SupplierPaymentForm({ suppliers, buildings, accounts, initialSupplierId, onSave, onClose }: {
  suppliers: any[]; buildings: Building[]; accounts: any[]; initialSupplierId?: string;
  onSave: (data: any) => Promise<void>; onClose?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState(initialSupplierId || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [method, setMethod] = useState('cash');
  const [accountCode, setAccountCode] = useState('5206');
  const expenseAccounts = (accounts || []).filter((a: any) => a.kind === 'post' && String(a.code).startsWith('5'));
  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ supplierId, amount: +amount, date, description, buildingId: buildingId || null, method, accountCode }); toast.success('تم تسجيل دفعة المورد وتوليد القيد المحاسبي'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>المورد / المقاول *</Label><Select value={supplierId} onValueChange={setSupplierId} required><SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {SUPPLIER_TYPE_LABEL[s.type]?.label || s.type}</SelectItem>)}</SelectContent></Select></div>
    {selectedSupplier && <p className="text-xs text-gray-500">إجمالي المدفوع له حتى الآن: <b className="text-amber-700">{fmtKWD((selectedSupplier.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0))} {CURRENCY}</b> على {(selectedSupplier.payments || []).length} دفعة</p>}
    <div className="grid grid-cols-2 gap-3">
      <div><Label>المبلغ ({CURRENCY}) *</Label><Input type="number" step="0.001" min="0" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
      <div><Label>تاريخ الدفع</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
    </div>
    <div><Label>البيان — على أي شغلانة / توريد</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="مثال: دفعة ثانية — أعمال سباكة الطابق الثاني" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>العمارة (لتحميل المصروف عليها)</Label><Select value={buildingId} onValueChange={setBuildingId}><SelectTrigger><SelectValue placeholder="بدون ربط بعمارة" /></SelectTrigger><SelectContent><SelectItem value="no-building">بدون ربط بعمارة</SelectItem>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>طريقة الدفع</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">نقدي — من الصندوق</SelectItem><SelectItem value="transfer">تحويل — من البنك</SelectItem><SelectItem value="check">شيك</SelectItem><SelectItem value="card">بطاقة</SelectItem></SelectContent></Select></div>
    </div>
    <div><Label>حساب المصروف (من شجرة الحسابات)</Label><Select value={accountCode} onValueChange={setAccountCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{expenseAccounts.map((a: any) => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}</SelectContent></Select></div>
    <p className="text-[11px] text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-2">القيد المولّد تلقائيًا: مدين {accountCode} (حساب المصروف) / دائن {method === 'transfer' ? '1102 البنك' : method === 'check' ? '1105 شيكات' : '1101 الصندوق'} — يظهر في ميزان المراجعة وتقرير العمارة{buildingId && buildings.find(b => b.id === buildingId) ? ` «${buildings.find(b => b.id === buildingId)!.name}»` : ''}</p>
    <Button type="submit" disabled={saving || !supplierId} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ الدفعة'}</Button>
  </form>);
}

// ============ إخلاء فوري وإنهاء العقد — يدعم الخروج المبكر قبل نهاية العقد مع التسوية المالية ============
// الإخلاء مش حذف: العقد يتحول لحالة «إخلاء» بتاريخ الإخلاء، الوحدة تقل متاحة، والدفعات والقيود بتفضل كلها محفوظة
// الخروج المبكر: الرصيد يتحسب حتى تاريخ الإخلاء + غرامة اختيارية + تسوية (تحصيل فوري / إعفاء / لاحقًا)
function EvictContractForm({ contract, onSave, onClose }: { contract: Contract; onSave: (data: any) => Promise<any>; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [vacatedDate, setVacatedDate] = useState(new Date().toISOString().slice(0, 10));
  const [refund, setRefund] = useState('');
  const [penalty, setPenalty] = useState('');
  const [settlement, setSettlement] = useState<'collect' | 'waive' | 'none'>('collect');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const end = contract.endDate ? new Date(contract.endDate) : null;
  const vd = new Date(vacatedDate);
  const isEarly = !!end && vd < end; // خروج مبكر قبل نهاية العقد
  const monthsLeft = end && isEarly ? Math.max(0, (end.getFullYear() - vd.getFullYear()) * 12 + (end.getMonth() - vd.getMonth())) : 0;
  const monthsLeftTxt = monthsLeft === 1 ? 'شهر واحد' : monthsLeft === 2 ? 'شهرين' : monthsLeft > 2 ? `${monthsLeft} أشهر` : '';

  // الرصيد حتى تاريخ الإخلاء (وليس حتى نهاية العقد) — يتحرك مباشرة مع تغيير التاريخ
  const bal = (() => { try { return contractBalance(contract as any, (contract.payments || []) as any, vd); } catch { return null; } })();
  const penaltyN = isEarly && penalty !== '' ? Math.max(0, +penalty || 0) : 0;
  const settleTotal = bal ? Math.round((bal.outstanding + penaltyN) * 1000) / 1000 : 0;
  const hasDue = settleTotal > 0.0005;

  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try {
    const res = await onSave({
      vacatedDate,
      refund: refund !== '' ? +refund : undefined,
      penalty: penaltyN,
      settlement: hasDue ? settlement : 'none',
      method,
      notes,
    });
    const msg = res?.settlementPayment
      ? `تم الإخلاء وتحصيل تسوية ${fmtKWD(res.settleAmount)} ${CURRENCY} — العقد منتهي والوحدة رجعت متاحة`
      : (hasDue && settlement === 'waive')
      ? 'تم الإخلاء — وُثّق إعفاء المستأجر من المتبقي في ملاحظات العقد'
      : 'تم إخلاء الوحدة — العقد منتهي والمستأجر محفوظ في سجله';
    toast.success(msg); onClose?.();
  } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-900 space-y-1">
      <p className="font-bold flex items-center gap-2"><LogOut size={14} />إخلاء فوري وإنهاء العقد</p>
      <p>الوحدة {contract.unit?.number || '؟'} — {contract.unit?.building?.name || '-'} — المستأجر: {contract.tenant?.name || '-'}</p>
      <p>هحصل الآتي: العقد يتحول لحالة «إخلاء» ويتوثق تاريخ الإخلاء، والوحدة ترجع «متاحة» لتأجيرها لمستأجر جديد بعقد جديد، وكل دفعات وسجل المستأجر القديم يفضل محفوظ بالكامل في «سجل العميل».</p>
    </div>
    <div className={`rounded-xl border p-2.5 text-xs font-bold flex items-center gap-2 ${isEarly ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
      {isEarly
        ? <><AlertTriangle size={14} />خروج مبكر: تاريخ الإخلاء قبل نهاية العقد{monthsLeftTxt ? ` بـ ${monthsLeftTxt}` : ''} — الحساب سيُقفل حتى تاريخ الإخلاء وليس حتى نهاية العقد</>
        : <><CheckCircle2 size={14} />إنهاء عند/بعد نهاية مدة العقد — إقفال طبيعي للحساب</>}
    </div>
    {bal && <p className="text-sm text-gray-700">رصيد العقد حتى تاريخ الإخلاء — المستحق: <b>{fmtKWD(bal.totalDue)}</b> — المدفوع: <b className="text-emerald-700">{fmtKWD(bal.totalPaid)}</b> — المتبقي: <b className={bal.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmtKWD(bal.outstanding)} {CURRENCY}</b></p>}
    <div className="grid grid-cols-2 gap-3">
      <div><Label>تاريخ الإخلاء *</Label><Input type="date" value={vacatedDate} onChange={e => setVacatedDate(e.target.value)} required /></div>
      <div><Label>مردود التأمين ({CURRENCY})</Label><Input type="number" step="0.001" min="0" value={refund} onChange={e => setRefund(e.target.value)} placeholder={contract.deposit ? `التأمين المسجل: ${fmtKWD(contract.deposit)}` : 'اختياري'} /></div>
    </div>
    {isEarly && <div><Label>غرامة الإنهاء المبكر ({CURRENCY}) — اختياري</Label><Input type="number" step="0.001" min="0" value={penalty} onChange={e => setPenalty(e.target.value)} placeholder="حسب الاتفاق في العقد — اتركه فارغًا لبدون غرامة" /></div>}
    {hasDue ? (
      <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2.5">
        <p className="text-sm font-bold text-red-800">مستحق عند الإخلاء: {fmtKWD(settleTotal)} {CURRENCY}{penaltyN > 0 ? ` (متبقي ${fmtKWD(bal!.outstanding)} + غرامة إنهاء مبكر ${fmtKWD(penaltyN)})` : ''}</p>
        <div className="space-y-1.5">
          {([
            { v: 'collect', t: `تحصيل ${fmtKWD(settleTotal)} ${CURRENCY} الآن مع الإخلاء — دفعة تسوية بقيد محاسبي`, I: ReceiptText },
            { v: 'waive', t: `إعفاء المستأجر من ${fmtKWD(settleTotal)} ${CURRENCY} — يُوثَّق في ملاحظات العقد`, I: CheckCircle2 },
            { v: 'none', t: 'بدون تسوية الآن — المتبقي يفضل مسجلًا على المستأجر', I: Clock },
          ] as const).map(o => (
            <label key={o.v} className={`flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer transition ${settlement === o.v ? 'border-emerald-400 bg-emerald-50 text-emerald-900 font-bold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
              <input type="radio" name="evict-settlement" checked={settlement === o.v} onChange={() => setSettlement(o.v)} className="accent-emerald-600" />
              <o.I size={13} className="shrink-0" />{o.t}
            </label>
          ))}
        </div>
        {settlement === 'collect' && (
          <div><Label>وسيلة تحصيل التسوية</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="cash">نقدي — الصندوق</SelectItem>
            <SelectItem value="transfer">تحويل بنكي</SelectItem>
            <SelectItem value="check">شيك</SelectItem>
            <SelectItem value="card">بطاقة</SelectItem>
          </SelectContent></Select></div>
        )}
      </div>
    ) : (
      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 font-bold flex items-center gap-2"><CheckCircle2 size={14} />الحساب مسدّد بالكامل حتى تاريخ الإخلاء — لا مستحقات على المستأجر (يبقى مردود التأمين إن وجد)</p>
    )}
    <div><Label>ملاحظات الإخلاء (حالة الشقة — سبب الخروج)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثال: الشقة بحالة جيدة — خروج مبكر لسفر المستأجر" /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-amber-500 to-orange-500 text-white font-bold">
      {saving ? 'جاري الحفظ...' : hasDue && settlement === 'collect' ? `تأكيد الإخلاء وتحصيل ${fmtKWD(settleTotal)} ${CURRENCY}` : 'تأكيد الإخلاء وإنهاء العقد'}
    </Button>
  </form>);
}

const MAINT_CATEGORIES: Record<string, string> = {
  plumbing: 'سباكة وتمديدات مياه', electrical: 'كهرباء', ac: 'تكييف وتبريد',
  elevator: 'مصاعد', civil: 'أعمال مدنية ودهانات', cleaning: 'نظافة', other: 'أخرى',
};

function MaintenanceForm({ buildings, units, onSave, initial, onClose }: { buildings: Building[]; units: Unit[]; onSave: (data: any) => Promise<void>; initial?: MaintenanceItem; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState(initial?.unit?.buildingId || initial?.buildingId || ''); const [unitId, setUnitId] = useState(initial?.unitId || ''); const [title, setTitle] = useState(initial?.title || ''); const [description, setDescription] = useState(initial?.description || ''); const [category, setCategory] = useState(initial?.category || 'other'); const [priority, setPriority] = useState(initial?.priority || 'medium'); const [estimatedCost, setEstimatedCost] = useState(String(initial?.estimatedCost ?? '')); const [cost, setCost] = useState(String(initial?.cost || '')); const [status, setStatus] = useState(initial?.status || 'open');
  // اختيار متسلسل: مبنى ← وحداته فقط — وتصفير الوحدة عند تغيير المبنى
  const filteredUnits = buildingId ? units.filter(u => u.buildingId === buildingId) : units;
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ title, description, unitId: unitId || null, buildingId: buildingId || null, category, priority, estimatedCost: estimatedCost ? +estimatedCost : null, cost: cost ? +cost : null, status: initial ? status : 'open', completedAt: status === 'completed' ? (initial?.completedAt || new Date().toISOString()) : null }); toast.success(initial ? 'تم تعديل طلب الصيانة' : 'تم إنشاء طلب الصيانة'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div><Label>المبنى</Label><Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setUnitId(''); }}><SelectTrigger><SelectValue placeholder="اختر المبنى" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>الوحدة (اتركها فارغة للعقار كامله)</Label><Select value={unitId || 'no-unit'} onValueChange={(v) => setUnitId(v === 'no-unit' ? '' : v)}><SelectTrigger><SelectValue placeholder={buildingId ? 'صيانة العمارة بكاملها' : 'اختر المبنى أولاً'} /></SelectTrigger><SelectContent><SelectItem value="no-unit">🏢 صيانة العمارة بكاملها</SelectItem>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>وحدة {u.number}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg p-2.5">لو الصيانة على العمارة كلها (ساكن، مصعد، واجهة…) اترك الوحدة على «صيانة العمارة بكاملها» — المصروف يُسجل على العمارة ويظهر في تقريرها المحاسبي</p>
    <div><Label>عنوان الطلب</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
    <div><Label>التصنيف</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MAINT_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>الوصف</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
    <div><Label>الأولوية</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">منخفض</SelectItem><SelectItem value="medium">متوسط</SelectItem><SelectItem value="high">عالي</SelectItem><SelectItem value="urgent">عاجل</SelectItem></SelectContent></Select></div>
    {initial && (<div><Label>حالة الطلب</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">مفتوح</SelectItem><SelectItem value="in_progress">جاري التنفيذ</SelectItem><SelectItem value="completed">مكتمل (يُسجل المصروف)</SelectItem><SelectItem value="cancelled">ملغي</SelectItem></SelectContent></Select>{status === 'completed' && !cost && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mt-1">الطلب مكتمل — تأكد من إدخال «التكلفة الفعلية» حتى يظهر المصروف في القيود وتقارير العمارة</p>}</div>)}
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

function TransactionForm({ buildings, accounts, onSave, initial, onClose }: { buildings: Building[]; accounts?: any[]; onSave: (data: any) => Promise<void>; initial?: any; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10)); const [buildingId, setBuildingId] = useState(initial?.buildingId || ''); const [type, setType] = useState(initial?.type || 'income'); const [category, setCategory] = useState(initial?.category || ''); const [amount, setAmount] = useState(String(initial?.amount || ''));
  const [account, setAccount] = useState(initial?.account || ''); const [cashAccount, setCashAccount] = useState(initial?.cashAccount || 'cash');
  // المصروف الإداري المشترك — يوزع على كل العمارات تلقائيًا (رواتب محاسب/سكرتارية وغيرها)
  const [distribute, setDistribute] = useState(false); const [distributeMode, setDistributeMode] = useState('equal');
  const isExpense = type === 'expense';
  // حسابات الفرعي المتاحة حسب نوع الحركة: إيرادات (4xx) أو مصروفات (5xx)
  const postAccounts = (accounts || []).filter((a: any) => a.kind === 'post');
  const accountOptions = postAccounts.filter((a: any) => isExpense ? String(a.code).startsWith('5') : String(a.code).startsWith('4'));
  const accountCode = account || (isExpense ? '5206' : '4101');
  const selectedAccountName = accountOptions.find((a: any) => a.code === accountCode)?.name;
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ date, buildingId: distribute ? null : (buildingId || null), type, category, amount: +amount, account: accountCode, cashAccount, distribute: distribute ? { mode: distributeMode } : null }); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div><Label>التاريخ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
      <div><Label>النوع</Label><Select value={type} onValueChange={(v) => { setType(v); setAccount(''); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">إيراد</SelectItem><SelectItem value="expense">مصروف</SelectItem></SelectContent></Select></div>
    </div>
    <div><Label>البيان</Label><Input value={category} onChange={e => setCategory(e.target.value)} required placeholder={isExpense ? 'مثال: راتب المحاسب — ديسمبر' : 'مثال: بيع خردوات قديمة'} /></div>
    <div><Label>الحساب المحاسبي (من شجرة الحسابات)</Label><Select value={account} onValueChange={setAccount}><SelectTrigger><SelectValue placeholder={selectedAccountName ? `${accountCode} — ${selectedAccountName}` : (isExpense ? 'افتراضي: 5206 مصروفات متنوعة' : 'افتراضي: 4101 إيراد إيجار سكني')} /></SelectTrigger><SelectContent>{accountOptions.map((a: any) => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>{isExpense ? 'الدفع من' : 'الاستلام في'}</Label><Select value={cashAccount} onValueChange={setCashAccount}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">الصندوق (نقدية)</SelectItem><SelectItem value="bank">البنك (تحويل)</SelectItem><SelectItem value="checks">شيكات برسم التحصيل</SelectItem></SelectContent></Select></div>
    <div><Label>العمارة</Label><Select value={buildingId} onValueChange={setBuildingId} disabled={distribute}><SelectTrigger><SelectValue placeholder={distribute ? 'توزيع على كل العمارات' : 'اختر العمارة (اختياري)'} /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>المبلغ ({CURRENCY})</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
    {isExpense && (
      <div className="space-y-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <input type="checkbox" id="distributeOverhead" checked={distribute} onChange={e => setDistribute(e.target.checked)} className="w-4 h-4 mt-0.5" />
          <Label htmlFor="distributeOverhead" className="text-xs cursor-pointer font-normal text-indigo-950">مصروف إداري مشترك على كل العمارات (مثل: راتب المحاسب والسكرتارية) — يُقسم تلقائيًا على العمارات ويولّد قيدًا مزدوجًا لكل عمارة يظهر في تقريرها</Label>
        </div>
        {distribute && (
          <div><Label className="text-xs">طريقة التوزيع</Label><Select value={distributeMode} onValueChange={setDistributeMode}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="equal">بالتساوي على العمارات</SelectItem><SelectItem value="rent">بنسبة الإيجار المتوقع لكل عمارة</SelectItem></SelectContent></Select></div>
        )}
      </div>
    )}
    <p className="text-xs text-gray-500">سيُولد تلقائيًا قيد محاسبي مزدوج (مدين ودائن) مرتبط بالعمارة — يظهر في دفتر اليومية وميزان المراجعة وتقرير العمارة</p>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ وتوليد القيد...' : 'حفظ'}</Button>
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

/** شارة عدد سجلات الصفحة — تجيب سؤال «كم سجل عندي هنا؟» بجانب عنوان كل صفحة */
function PageCount({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold whitespace-nowrap" title={`إجمالي ${label} المسجلة في النظام`}>
      <span className="w-2 h-2 rounded-full bg-orange-400" />{n} {label}
    </span>
  );
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

// =============================================================
// صفحة العمارة الكاملة — تفتح بالضغط على كارت العمارة
// تبويبات: نظرة عامة | الوحدات والمستأجرين | العقود | المستندات القانونية | المالية | القضايا
// =============================================================
function BuildingDetailSection({ user, building, buildings, units, tenants, contracts, payments, maintenance, transactions, journalEntries, accounts, allFiles, legalCases, tab, setTab, onBack, canWrite, uploadFile, refresh, openCase }: {
  user: User; building: Building | null; buildings: Building[];
  units: Unit[]; tenants: Tenant[]; contracts: Contract[]; payments: Payment[];
  maintenance: MaintenanceItem[]; transactions: any[]; journalEntries: any[]; accounts: any[];
  allFiles: FileUpload[]; legalCases: LegalCase[];
  tab: string; setTab: (t: string) => void;
  onBack: () => void; canWrite: (e: string) => boolean;
  uploadFile: (file: File, category: string, meta?: any) => Promise<any>;
  refresh: () => void; openCase: (id: string) => void;
}) {
  if (!building) return (<div className="space-y-4"><Button variant="outline" onClick={onBack} className="border-orange-200 text-orange-700"><ArrowRight size={16} />عودة للمباني</Button><EmptyState icon={<Building2 size={48} />} text="لم يتم العثور على العمارة" /></div>);

  const bUnits = units.filter(u => u.buildingId === building.id);
  const bUnitIds = new Set(bUnits.map(u => u.id));
  const bContracts = contracts.filter(c => bUnitIds.has(c.unitId));
  const bContractIds = new Set(bContracts.map(c => c.id));
  const bPayments = payments.filter(p => bContractIds.has(p.contractId));
  const activeContracts = bContracts.filter(c => c.status === 'active' || c.status === 'renewed');
  // صفوف جدول الوحدات — نفس الحسابات للديسكتوب والموبايل ومستند الطباعة
  const unitRows = bUnits.map(u => {
    const act = activeContracts.filter(c => c.unitId === u.id).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
    const bal = act ? contractBalance(act as any, (act.payments || []) as any) : null;
    return { u, act, bal };
  });
  const sumDefaultRent = bUnits.reduce((s, u) => s + (u.rentAmount || 0), 0);
  const sumActualRent = unitRows.reduce((s, r) => s + (r.act ? effectiveRent(r.act as any) : 0), 0);
  const sumOutstanding = unitRows.reduce((s, r) => s + (r.bal ? Math.max(0, r.bal.outstanding) : 0), 0);
  const bMaintenance = maintenance.filter(m => m.unit?.buildingId === building.id || m.buildingId === building.id);
  const bTransactions = transactions.filter((t: any) => t.buildingId === building.id);
  const bEntries = journalEntries.filter((e: any) => e.buildingId === building.id);
  const bCases = legalCases.filter(c => c.buildingId === building.id);
  const bFiles = allFiles.filter(f => f.buildingId === building.id);

  // أرصدة العمارة المحاسبية من القيود (كل القيود مرتبطة بbuildingId)
  const accTypeMap = new Map(accounts.map((a: any) => [a.code, a.type]));
  let incomeTotal = 0, expenseTotal = 0;
  for (const e of bEntries) {
    for (const l of (e.lines || [])) {
      const t = accTypeMap.get(String(l.accountCode));
      if (t === 'revenue') incomeTotal += Number(l.credit) || 0;
      if (t === 'expense') expenseTotal += Number(l.debit) || 0;
    }
  }
  const net = Math.round((incomeTotal - expenseTotal) * 1000) / 1000;
  const stats = buildingIncomeStats(units as any, contracts as any, building.id);

  // تقرير العمارة المالي القابل للطباعة — يجمع كل مصادر العمارة
  const reportIncome: { label: string; amount: number; detail?: string }[] = [
    { label: 'إيجارات محصلة (تحصيل الوحدات والشركات)', amount: bEntries.flatMap((e: any) => e.lines || []).filter((l: any) => String(l.accountCode).startsWith('4')).reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0), detail: 'من القيود المحاسبية' },
    { label: 'إيرادات أخرى مسجلة', amount: bTransactions.filter((t: any) => t.type === 'income' && t.account && !String(t.account).startsWith('4')).reduce((s: number, t: any) => s + (t.amount || 0), 0) },
  ];
  const maintExpense = bMaintenance.filter(m => m.status === 'completed').reduce((s, m) => s + (m.cost || 0), 0);
  const otherExpense = bTransactions.filter((t: any) => t.type === 'expense' && t.account && String(t.account) !== '5101').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const reportExpenses: { label: string; amount: number; detail?: string }[] = [
    { label: 'صيانة الوحدات والعمارة', amount: maintExpense, detail: `${bMaintenance.filter(m => m.status === 'completed').length} طلب مكتمل` },
    { label: 'غرامات وقضايا مسددة', amount: bCases.filter(c => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0) },
    { label: 'مصروفات وحصص إدارية موزعة', amount: otherExpense },
  ];

  const TABS = [
    { key: 'overview', label: 'نظرة عامة', icon: <Building2 size={16} /> },
    { key: 'units', label: 'الوحدات والمستأجرين', icon: <Home size={16} /> },
    { key: 'contracts', label: 'العقود', icon: <FileText size={16} /> },
    { key: 'legal', label: 'المستندات القانونية', icon: <FolderOpen size={16} /> },
    { key: 'finance', label: 'المالية', icon: <DollarSign size={16} /> },
    { key: 'cases', label: 'القضايا والمخالفات', icon: <Gavel size={16} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={onBack} className="border-orange-200 text-orange-700"><ArrowRight size={14} className="ml-1" />المباني</Button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white shadow"><Building2 size={20} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{building.name}</h2>
          <p className="text-xs text-gray-500">{building.code} {building.address ? `— ${building.address}` : ''}{building.city ? ` — ${building.city}` : ''}</p>
        </div>
        {canWrite('buildings') && <FormDialog trigger={<Button variant="outline" size="sm" className="border-orange-200 text-orange-700"><Edit3 size={14} className="ml-1" />تعديل</Button>} title="تعديل المبنى">{(close) => <BuildingForm initial={building} onSave={async (data) => { await api(`/api/buildings/${building.id}`, 'PUT', data); refresh(); }} onClose={close} />}</FormDialog>}
      </div>

      {/* شريط التبويبات */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${tab === t.key ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md' : 'bg-white text-gray-600 border border-orange-100 hover:bg-orange-50'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ===== نظرة عامة ===== */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* لوحة إيرادات العمارة — السطر الأول المتوقع وتحته الفعلي والمصروفات والمتأخرات وصافي الإيجار (نفس تخطيط صفحة المباني) */}
          {(() => {
            const coll = collectedStats(bPayments as any);
            const maintCount = bUnits.filter(u => u.status === 'maintenance').length;
            const arrears = arrearsOfContracts(bContracts as any);
            const expenses = bEntries.reduce((s2: number, e: any) => s2 + (e.lines || []).filter((l: any) => String(l.accountCode).startsWith('5')).reduce((s3: number, l: any) => s3 + (Number(l.debit) || 0), 0), 0);
            const netRent = coll.total - expenses;
            return (
            <Card className="border-0 shadow-lg"><CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3"><DollarSign size={20} className="text-emerald-600" /><h3 className="font-bold text-gray-900">لوحة الإيرادات — {building.name}</h3></div>
              <p className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1"><TrendingUp size={13} />إيرادات العقود — قبل الخصم / الخصم / الصافي</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100"><p className="text-[11px] text-gray-600">قبل الخصم شهرياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(stats.contractGrossMonthly)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">سنوياً: {fmtKWD(stats.contractGrossMonthly * 12)} {CURRENCY} — العقود النشطة</p></div>
                <div className="p-3 bg-emerald-50 rounded-xl text-center border border-emerald-100"><p className="text-[11px] text-gray-600">قبل الخصم سنوياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(stats.contractGrossMonthly * 12)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">شهرياً: {fmtKWD(stats.contractGrossMonthly)} {CURRENCY} — العقود النشطة</p></div>
                <div className="p-3 bg-orange-50 rounded-xl text-center border border-orange-100"><p className="text-[11px] text-gray-600">إجمالي الخصم شهرياً</p><p className="text-lg font-bold text-orange-700">{fmtKWD(stats.contractDiscountMonthly)} {CURRENCY}</p><p className="text-[10px] text-orange-600 mt-1 opacity-70">سنوياً: {fmtKWD(stats.contractDiscountMonthly * 12)} {CURRENCY}</p></div>
                <div className="p-3 bg-emerald-50 rounded-xl text-center border-2 border-emerald-400"><p className="text-[11px] text-gray-600">صافي الربح بعد الخصم شهرياً</p><p className="text-lg font-bold text-emerald-700">{fmtKWD(stats.contractedMonthly)} {CURRENCY}</p><p className="text-[10px] text-emerald-600 mt-1 opacity-70">سنوياً: {fmtKWD(stats.contractedAnnual)} {CURRENCY}</p></div>
                <div className="p-3 bg-blue-50 rounded-xl text-center border border-blue-100"><p className="text-[11px] text-gray-600">جميع الوحدات</p><p className="text-lg font-bold text-blue-700">{bUnits.length}</p></div>
                <div className="p-3 bg-teal-50 rounded-xl text-center border border-teal-100"><p className="text-[11px] text-gray-600">الوحدات المؤجرة</p><p className="text-lg font-bold text-teal-700">{bUnits.filter(u => u.status === 'rented').length}</p></div>
                <div className="p-3 bg-amber-50 rounded-xl text-center border border-amber-100"><p className="text-[11px] text-gray-600">وحدات تحت الصيانة</p><p className="text-lg font-bold text-amber-700">{maintCount}</p></div>
              </div>
              <p className="text-[11px] font-bold text-indigo-700 mt-4 mb-2 flex items-center gap-1"><ReceiptText size={13} />الإيرادات الفعلية والمصروفات</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl text-center border border-indigo-100"><p className="text-[11px] text-gray-600">المحصل شهرياً</p><p className="text-lg font-bold text-indigo-700">{fmtKWD(coll.monthly)} {CURRENCY}</p></div>
                <div className="p-3 bg-indigo-50 rounded-xl text-center border border-indigo-100"><p className="text-[11px] text-gray-600">المحصل سنوياً</p><p className="text-lg font-bold text-indigo-700">{fmtKWD(coll.annual)} {CURRENCY}</p></div>
                <div className="p-3 bg-amber-50 rounded-xl text-center border border-amber-100"><p className="text-[11px] text-gray-600">المتأخرات (متبقي مستحق)</p><p className={`text-lg font-bold ${arrears > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtKWD(arrears)} {CURRENCY}</p></div>
                <div className="p-3 bg-red-50 rounded-xl text-center border border-red-100"><p className="text-[11px] text-gray-600">المصروفات (قيود)</p><p className="text-lg font-bold text-red-700">{fmtKWD(expenses)} {CURRENCY}</p></div>
                <div className="p-3 bg-teal-50 rounded-xl text-center border border-teal-100"><p className="text-[11px] text-gray-600">صافي الإيجار (محصل − مصروفات)</p><p className={`text-lg font-bold ${netRent >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtKWD(netRent)} {CURRENCY}</p></div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">قبل الخصم = مجموع إيجار عقود هذه العمارة النشطة كما هي مكتوبة • إجمالي الخصم = مجموع الخصومات الشهرية عليها • صافي الربح بعد الخصم = قبل الخصم − الخصم — اللي بتلمه من العمارة دي فعلاً • المحصل = دفعات هذه العمارة المسددة فعلاً حسب تاريخ الدفع • المتأخرات = المتبقي المستحق غير المحصل على عقودها النشطة • المصروفات = مصروفاتها المسجلة بالقيود المحاسبية • صافي الإيجار = المحصل الكلي − المصروفات — العملة {CURRENCY}</p>
            </CardContent></Card>
            );
          })()}
          <Card className="border-0 shadow-lg"><CardContent className="p-5">
            <h3 className="font-bold text-gray-900 mb-3">بيانات العمارة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ['كود العمارة', building.code], ['العنوان', building.address || '-'], ['المدينة', building.city || '-'],
                ['عدد الطوابق', building.floors || '-'], ['عدد الوحدات الفعلي', String(bUnits.length)],
                ['القيمة الدفترية', building.value ? `${fmtKWD(building.value)} ${CURRENCY}` : '-'],
                ['الترخيص / السجل العقاري', building.license || '-'],
                ['نسبة الإشغال', `${bUnits.length ? Math.round((bUnits.filter(u => u.status === 'rented').length / bUnits.length) * 100) : 0}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-dotted border-gray-100 py-1.5"><span className="text-gray-500">{k}</span><span className="font-semibold text-gray-800 text-left">{v}</span></div>
              ))}
            </div>
            {building.notes && <p className="text-sm text-gray-600 bg-orange-50 rounded-xl p-3 mt-3">{building.notes}</p>}
          </CardContent></Card>
        </div>
      )}

      {/* ===== الوحدات والمستأجرين ===== */}
      {tab === 'units' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gray-500">{bUnits.length} وحدة — {bUnits.filter(u => u.status === 'rented').length} مؤجرة — إجمالي المتبقي: <b className={sumOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmtKWD(sumOutstanding)} {CURRENCY}</b></p>
            <div className="flex items-center gap-2 flex-wrap">
              <VoucherDialog trigger={<Button size="sm" variant="outline" className="border-orange-200 text-orange-700"><Printer size={14} className="ml-1" />طباعة المستند</Button>} title={`كشف الوحدات والمستأجرين — ${building.name}`}
                docHtml={buildingUnitsDocHtml({ building, currency: CURRENCY, rows: unitRows.map(r => ({
                  number: r.u.number,
                  floor: r.u.floor != null ? String(r.u.floor) : '-',
                  type: UNIT_TYPE_LABEL[r.u.type || ''] || r.u.type || '-',
                  status: UNIT_STATUS_MAP[r.u.status]?.label || r.u.status || '',
                  defaultRent: r.u.rentAmount ?? null,
                  actualRent: r.act ? effectiveRent(r.act as any) : null,
                  tenant: r.act?.tenant?.name || 'شاغرة',
                  tenantType: r.act?.tenant?.tenantType ? (TENANT_TYPE_LABEL[r.act.tenant.tenantType]?.label || '') : '',
                  outstanding: r.bal ? r.bal.outstanding : null,
                })) })} />
              {canWrite('units') && <FormDialog trigger={<Button size="sm" className="bg-gradient-to-l from-orange-500 to-amber-500 text-white"><Plus size={14} className="ml-1" />إضافة وحدة لهذه العمارة</Button>} title="إضافة وحدة جديدة">{(close) => <UnitForm buildings={buildings} initial={{ buildingId: building.id } as any} onSave={async (data) => { await api('/api/units', 'POST', data); refresh(); }} onClose={close} />}</FormDialog>}
            </div>
          </div>
          {/* ديسكتوب */}
          <div className="hidden md:block">
            <Card className="border-0 shadow-lg overflow-hidden"><div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="bg-orange-50">
                  <TableHead className="text-center">الوحدة</TableHead>
                  <TableHead className="text-center">الطابق</TableHead>
                  <TableHead className="text-center">النوع</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead>الإيجار الافتراضي</TableHead>
                  <TableHead>الإيجار الفعلي</TableHead>
                  <TableHead>المستأجر الحالي</TableHead>
                  <TableHead>المتبقي عليه</TableHead>
                </TableRow></TableHeader>
                <TableBody>{unitRows.map(({ u, act, bal }) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold text-center">{u.number}</TableCell>
                    <TableCell className="text-center">{u.floor ?? '-'}</TableCell>
                    <TableCell className="text-xs text-center">{UNIT_TYPE_LABEL[u.type || ''] || u.type || '-'}</TableCell>
                    <TableCell className="text-center"><Badge className={UNIT_STATUS_MAP[u.status]?.color}>{UNIT_STATUS_MAP[u.status]?.label || u.status}</Badge></TableCell>
                    <TableCell className="text-sm tabular-nums">{u.rentAmount ? `${fmtKWD(u.rentAmount)} ${CURRENCY}` : '-'}</TableCell>
                    <TableCell className="text-sm tabular-nums">{act ? <span className="font-semibold text-emerald-700">{fmtKWD(effectiveRent(act as any))} {CURRENCY}</span> : <span className="text-gray-400">-</span>}</TableCell>
                    <TableCell>{act?.tenant ? (<div className="flex items-center gap-1.5 flex-wrap"><span className="text-sm font-medium">{act.tenant.name}</span>{act.tenant.tenantType && <Badge className={`${TENANT_TYPE_LABEL[act.tenant.tenantType]?.color} text-[10px]`}>{TENANT_TYPE_LABEL[act.tenant.tenantType]?.label}</Badge>}</div>) : <span className="text-gray-400 text-sm">شاغرة</span>}</TableCell>
                    <TableCell className="text-sm font-bold tabular-nums">{bal ? (bal.outstanding > 0 ? <span className="text-red-600">{fmtKWD(bal.outstanding)} {CURRENCY}</span> : <span className="text-emerald-600">لا متبقي ✓</span>) : '-'}</TableCell>
                  </TableRow>
                ))}</TableBody>
                <TableFooter><TableRow className="bg-amber-50 hover:bg-amber-50">
                  <TableCell colSpan={4} className="font-bold text-gray-800">الإجمالي — {bUnits.length} وحدة</TableCell>
                  <TableCell className="font-bold tabular-nums">{fmtKWD(sumDefaultRent)} {CURRENCY}</TableCell>
                  <TableCell className="font-bold tabular-nums text-emerald-700">{fmtKWD(sumActualRent)} {CURRENCY}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className={`font-bold tabular-nums ${sumOutstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtKWD(sumOutstanding)} {CURRENCY}</TableCell>
                </TableRow></TableFooter>
              </Table>
            </div></Card>
          </div>
          {/* موبايل */}
          <div className="grid gap-3 md:hidden">
            {unitRows.map(({ u, act, bal }) => (
              <Card key={u.id} className="border-0 shadow-md"><CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between"><span className="font-bold">وحدة {u.number}</span><Badge className={UNIT_STATUS_MAP[u.status]?.color}>{UNIT_STATUS_MAP[u.status]?.label || u.status}</Badge></div>
                <p className="text-xs text-gray-500">الطابق: {u.floor ?? '-'} — {UNIT_TYPE_LABEL[u.type || ''] || u.type || '-'}</p>
                <p className="text-xs">الإيجار الافتراضي: <b>{u.rentAmount ? `${fmtKWD(u.rentAmount)} ${CURRENCY}` : '-'}</b>{act ? <> — الفعلي: <b className="text-emerald-700">{fmtKWD(effectiveRent(act as any))} {CURRENCY}</b></> : null}</p>
                {act?.tenant && <p className="text-sm">المستأجر: <b>{act.tenant.name}</b> {act.tenant.tenantType && <Badge className={`${TENANT_TYPE_LABEL[act.tenant.tenantType]?.color} text-[10px]`}>{TENANT_TYPE_LABEL[act.tenant.tenantType]?.label}</Badge>}</p>}
                {bal && <p className="text-xs text-gray-500">المتبقي: <b className={bal.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmtKWD(bal.outstanding)} {CURRENCY}</b></p>}
              </CardContent></Card>
            ))}
          </div>
          {bUnits.length === 0 && <EmptyState icon={<Home size={48} />} text="لا توجد وحدات في هذه العمارة بعد" />}
        </div>
      )}

      {/* ===== العقود ===== */}
      {tab === 'contracts' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{bContracts.length} عقد — {activeContracts.length} نشط</p>
          <div className="grid gap-3">
            {bContracts.map(c => (
              <Card key={c.id} className="border-0 shadow-md"><CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap"><Badge className={CONTRACT_STATUS_MAP[c.status]?.color}>{CONTRACT_STATUS_MAP[c.status]?.label || c.status}</Badge>{c.tenant?.tenantType && <Badge className={`${TENANT_TYPE_LABEL[c.tenant.tenantType]?.color} text-[10px]`}>{TENANT_TYPE_LABEL[c.tenant.tenantType]?.label}</Badge>}{(c as any).number && <Badge className="bg-slate-800 text-white text-[10px] font-bold tabular-nums">عقد {(c as any).number}</Badge>}</div>
                    <p className="font-bold text-gray-900">{c.tenant?.name || 'بدون مستأجر'} — وحدة {c.unit?.number || '?'}</p>
                    <p className="text-xs text-gray-500">إيجار شهري: {fmtKWD(effectiveRent(c as any))} {CURRENCY}{(c.discount || 0) > 0 ? ` (قبل الخصم ${fmtKWD(c.rentAmount)} — خصم ${fmtKWD(c.discount)})` : ''} — سنوي بعد الخصم: {fmtKWD(effectiveRent(c as any) * 12)} {CURRENCY} — من {new Date(c.startDate).toLocaleDateString('ar')} إلى {new Date(c.endDate).toLocaleDateString('ar')}</p>
                  </div>
                  {(() => { const bal = contractBalance(c as any, (c.payments || []) as any); return (
                    <div className="text-sm bg-blue-50 rounded-xl p-3 min-w-[180px]">
                      <p>المستحق: <b>{fmtKWD(bal.totalDue)}</b></p>
                      <p>المدفوع: <b className="text-emerald-700">{fmtKWD(bal.totalPaid)}</b></p>
                      <p>المتبقي: <b className={bal.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmtKWD(bal.outstanding)} {CURRENCY}</b></p>
                    </div>);
                  })()}
                </div>
              </CardContent></Card>
            ))}
            {bContracts.length === 0 && <EmptyState icon={<FileText size={48} />} text="لا توجد عقود لوحدات هذه العمارة" />}
          </div>
        </div>
      )}

      {/* ===== المستندات القانونية ===== */}
      {tab === 'legal' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">وثيقة العقار، التراخيص، شهادة الإشغال، المخططات وغيرها — تُرفع هنا وتُحفظ مرتبطة بهذه العمارة</p>
          {canWrite('files') && (
            <div className="flex flex-wrap items-center gap-2 bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <span className="text-sm font-semibold text-orange-900">رفع مستند:</span>
              {Object.entries(LEGAL_DOC_TYPES).map(([k, label]) => (
                <FileUploadButton key={k} className="border-orange-300 text-orange-800 bg-white" icon={<Upload size={13} className="ml-1" />}
                  onPick={async (file) => {
                    try {
                      const saved: any = await uploadFile(file, 'building_legal', { buildingId: building.id, docType: k });
                      if (saved?.warning) toast.warning(saved.warning); else toast.success(`تم رفع: ${label}`);
                      refresh();
                    } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل رفع الملف'); }
                  }}>{label}</FileUploadButton>
              ))}
            </div>
          )}
          <div className="grid gap-2">
            {bFiles.map(f => (
              <Card key={f.id} className="border-0 shadow-sm"><CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} showThumbnail />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{f.originalName}</p>
                    <p className="text-xs text-gray-500">{LEGAL_DOC_TYPES[f.docType || ''] || 'مستند'} — {new Date(f.createdAt).toLocaleDateString('ar')} — {(f.size / 1024).toFixed(0)}KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} triggerLabel="عرض" />
                  {canWrite('files') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف الملف؟')) { await api(`/api/files/${f.id}`, 'DELETE'); refresh(); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
                </div>
              </CardContent></Card>
            ))}
            {bFiles.length === 0 && <EmptyState icon={<FolderOpen size={48} />} text="لا توجد مستندات مرفوعة لهذه العمارة — ابدأ برفع وثيقة العقار" />}
          </div>
        </div>
      )}

      {/* ===== المالية ===== */}
      {tab === 'finance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'إيرادات العمارة', value: fmtKWD(incomeTotal), cls: 'bg-emerald-50 text-emerald-700' },
              { label: 'مصروفات العمارة', value: fmtKWD(expenseTotal), cls: 'bg-red-50 text-red-700' },
              { label: 'الصافي', value: fmtKWD(net), cls: net >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-orange-50 text-red-700' },
              { label: 'عدد القيود', value: String(bEntries.length), cls: 'bg-blue-50 text-blue-700' },
            ].map((s, i) => (<div key={i} className={`p-3.5 rounded-2xl ${s.cls} shadow-sm`}><p className="text-[11px] text-gray-600">{s.label}</p><p className="font-bold text-lg">{s.value} {CURRENCY}</p></div>))}
          </div>
          <div className="flex flex-wrap gap-2">
            <VoucherDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white"><Printer size={15} className="ml-1" />طباعة التقرير المالي للعمارة</Button>} title={`التقرير المالي — ${building.name}`}
              docHtml={buildingFinancialReportHtml({
                building, unitsCount: bUnits.length, occupiedCount: bUnits.filter(u => u.status === 'rented').length,
                expectedMonthly: stats.expectedMonthly, contractedMonthly: stats.contractedMonthly,
                income: reportIncome, expenses: reportExpenses, entries: bEntries.slice(0, 20), currency: CURRENCY,
              })} />
            {canWrite('transactions') && <FormDialog trigger={<Button variant="outline" className="border-orange-200 text-orange-700"><Plus size={14} className="ml-1" />إضافة حركة على هذه العمارة</Button>} title="إضافة حركة مالية">{(close) => <TransactionForm buildings={buildings} initial={{ buildingId: building.id } as any} accounts={accounts as any} onSave={async (data) => { const r: any = await api('/api/transactions', 'POST', data); if (r?.entryWarning) toast.warning(r.entryWarning); else if (r?.distributed) toast.success(`تم التوزيع على ${r.count} عمارة مع توليد القيود`); else toast.success('تم الحفظ وتوليد القيد المزدوج'); refresh(); }} onClose={close} />}</FormDialog>}
            {canWrite('journal') && <FormDialog trigger={<Button variant="outline" className="border-orange-200 text-orange-700"><Plus size={14} className="ml-1" />قيد يومي للعمارة</Button>} title="إضافة قيد يومي" maxWidth="max-w-lg">{(close) => <JournalForm accounts={accounts as any} buildings={buildings} initial={{ buildingId: building.id } as any} onSave={async (data) => { await api('/api/journal', 'POST', data); toast.success('تم حفظ القيد'); refresh(); }} onClose={close} />}</FormDialog>}
          </div>
          {/* جدول القيود */}
          <Card className="border-0 shadow-lg overflow-hidden"><div className="max-h-[420px] overflow-auto"><div className="min-w-[560px]">
            <Table><TableHeader><TableRow className="bg-orange-50 sticky top-0"><TableHead>التاريخ</TableHead><TableHead>البيان</TableHead><TableHead>المصدر</TableHead><TableHead>السطور</TableHead></TableRow></TableHeader>
            <TableBody>{bEntries.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(e.date).toLocaleDateString('ar')}</TableCell>
                <TableCell className="text-sm">{e.description}</TableCell>
                <TableCell><Badge className="bg-indigo-100 text-indigo-800 text-[10px]">{SOURCE_LABELS[e.source] || 'يدوي'}</Badge></TableCell>
                <TableCell className="text-xs"><div className="space-y-0.5">{(e.lines || []).map((l: any, i: number) => (<div key={i}>{l.accountCode} {l.accountName} — {l.debit > 0 ? <b className="text-emerald-700">م {l.debit.toLocaleString?.('ar') ?? l.debit}</b> : <b className="text-red-700">د {l.credit.toLocaleString?.('ar') ?? l.credit}</b>}</div>))}</div></TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </div></div></Card>
          {bEntries.length === 0 && <EmptyState icon={<ReceiptText size={48} />} text="لا توجد قيود محاسبية لهذه العمارة بعد — سجل حركة أو قيدًا وسيظهر هنا" />}
        </div>
      )}

      {/* ===== القضايا والمخالفات ===== */}
      {tab === 'cases' && (
        <div className="space-y-3">
          {canWrite('legalCases') && <FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white"><Plus size={15} className="ml-1" />إضافة مخالفة/قضية لهذه العمارة</Button>} title="مخالفة أو قضية جديدة">{(close) => <LegalCaseForm buildings={buildings} units={units as any} tenants={tenants as any} initial={{ buildingId: building.id } as any} onSave={async (data) => { const r: any = await api('/api/legal-cases', 'POST', data); if (r?.entryWarning) toast.warning(r.entryWarning); refresh(); }} onClose={close} />}</FormDialog>}
          <div className="grid gap-3">
            {bCases.map(c => <LegalCaseCard key={c.id} c={c} buildings={buildings} units={units as any} tenants={tenants as any} canWrite={canWrite} uploadFile={uploadFile} refresh={refresh} />)}
            {bCases.length === 0 && <EmptyState icon={<Gavel size={48} />} text="لا توجد مخالفات أو قضايا على هذه العمارة — الحمد لله" />}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// قسم المخالفات والقضايا — كل العمارات
// =============================================================
function LegalCasesSection({ cases, buildings, units, tenants, canWrite, uploadFile, refresh, openBuilding }: {
  cases: LegalCase[]; buildings: Building[]; units: Unit[]; tenants: Tenant[];
  canWrite: (e: string) => boolean;
  uploadFile: (file: File, category: string, meta?: any) => Promise<any>;
  refresh: () => void; openBuilding: (id: string) => void;
}) {
  const [caseStatusFilter, setCaseStatusFilter] = useState('all');
  // قائمة القضايا بعد فلتر الحالة — تُستخدم في العدّاد وقائمة الكروت
  const filteredCases = cases.filter(c => caseStatusFilter === 'all' || c.status === caseStatusFilter);
  const open = cases.filter(c => c.status === 'open' || c.status === 'in_progress');
  const paid = cases.filter(c => c.status === 'paid');
  const totalFines = cases.reduce((s, c) => s + (c.amount || 0), 0);
  const paidFines = cases.filter(c => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0);
  // جلسات قريبة خلال 14 يوم
  const soon = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const upcoming = cases.filter(c => c.hearingDate && c.status !== 'closed' && c.hearingDate <= soon);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">المخالفات البلدية والقضايا</h2><PageCount n={filteredCases.length} label="قضية" />
          <p className="text-sm text-gray-500 mt-0.5">متابعة المخالفات والقضايا القانونية وغراماتها</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="بحث..." value={undefined as any} readOnly className="pr-9 w-full sm:w-48 border-orange-200" /></div>
          {canWrite('legalCases') && <FormDialog trigger={<Button className="bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md"><Plus size={18} className="ml-2" />مخالفة/قضية جديدة</Button>} title="مخالفة أو قضية جديدة">{(close) => <LegalCaseForm buildings={buildings} units={units} tenants={tenants} onSave={async (data) => { const r: any = await api('/api/legal-cases', 'POST', data); if (r?.entryWarning) toast.warning(r.entryWarning); refresh(); }} onClose={close} />}</FormDialog>}
        </div>
      </div>
      {/* فلتر حالة القضايا */}
      <div className="flex gap-2 flex-wrap items-center">
        {[{ k: 'all', l: 'الكل' }, ...Object.entries(CASE_STATUS_MAP).map(([k, v]) => ({ k, l: v.label }))].map(({ k, l }) => (
          <button key={k} type="button" onClick={() => setCaseStatusFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${caseStatusFilter === k ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-gray-600 border-orange-200 hover:bg-orange-50'}`}>{l}{k === 'all' ? ` (${cases.length})` : ` (${cases.filter(c => c.status === k).length})`}</button>
        ))}
      </div>
      {/* ملخص */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'قضايا مفتوحة', value: String(open.length), icon: <AlertTriangle size={16} />, cls: 'bg-amber-50 text-amber-700' },
          { label: 'غرامات مسددة', value: fmtKWD(paidFines), icon: <CheckCircle2 size={16} />, cls: 'bg-emerald-50 text-emerald-700' },
          { label: 'إجمالي قيم القضايا', value: fmtKWD(totalFines), icon: <Gavel size={16} />, cls: 'bg-purple-50 text-purple-700' },
          { label: 'جلسات قريبة (14 يوم)', value: String(upcoming.length), icon: <Calendar size={16} />, cls: upcoming.length ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600' },
        ].map((s, i) => (
          <div key={i} className={`p-3.5 rounded-2xl ${s.cls} flex items-center gap-3 shadow-sm`}>
            <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">{s.icon}</div>
            <div className="min-w-0"><p className="text-[11px] text-gray-600">{s.label}</p><p className="font-bold text-sm sm:text-lg truncate">{s.value}</p></div>
          </div>
        ))}
      </div>
      {upcoming.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1">
          <p className="font-bold text-red-800 text-sm flex items-center gap-2"><Calendar size={15} />جلسات قادمة خلال أسبوعين:</p>
          {upcoming.map(c => (<p key={c.id} className="text-sm text-red-700">• {c.title} — جلسة {new Date(c.hearingDate!).toLocaleDateString('ar')}{c.building?.name ? ` (${c.building.name})` : ''}</p>))}
        </div>
      )}
      <div className="grid gap-3">
        {filteredCases.map(c => <LegalCaseCard key={c.id} c={c} buildings={buildings} units={units} tenants={tenants} canWrite={canWrite} uploadFile={uploadFile} refresh={refresh} openBuilding={openBuilding} />)}
        {filteredCases.length === 0 && (cases.length === 0 ? <EmptyState icon={<Gavel size={48} />} text="لا توجد مخالفات أو قضايا مسجلة" /> : <EmptyState icon={<Search size={48} />} text="لا توجد قضايا مطابقة للفلتر المحدد" />)}
      </div>
    </div>
  );
}

// كارت قضية/مخالفة — يستخدم في القسم الرئيسي وصفحة العمارة
function LegalCaseCard({ c, buildings, units, tenants, canWrite, uploadFile, refresh, openBuilding }: {
  c: LegalCase; buildings: Building[]; units: Unit[]; tenants: Tenant[];
  canWrite: (e: string) => boolean;
  uploadFile: (file: File, category: string, meta?: any) => Promise<any>;
  refresh: () => void; openBuilding?: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const setStatus = async (status: string) => {
    setSaving(true);
    try {
      const r: any = await api(`/api/legal-cases/${c.id}`, 'PUT', { status });
      if (r?.entryWarning) toast.warning(r.entryWarning);
      else if (status === 'paid') toast.success('تم تسجيل السداد وتوليد قيد الغرامة (مدين غرامات / دائن الصندوق)');
      refresh();
    } catch (e: any) { toast.error(e.message || 'خطأ'); } finally { setSaving(false); }
  };
  return (
    <Card className="border-0 shadow-lg"><CardContent className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className={CASE_TYPE_MAP[c.type]?.color}>{CASE_TYPE_MAP[c.type]?.label || c.type}</Badge>
            <Badge className={CASE_STATUS_MAP[c.status]?.color}>{CASE_STATUS_MAP[c.status]?.label || c.status}</Badge>
            {c.reference && <Badge className="bg-gray-100 text-gray-700">مرجع: {c.reference}</Badge>}
          </div>
          <h3 className="font-bold text-gray-900">{c.title}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1.5">
            {c.building && <button className="text-orange-600 hover:underline flex items-center gap-1" onClick={() => openBuilding?.(c.building!.id)}><Building2 size={12} />{c.building.name}</button>}
            {c.unit && <span>وحدة {c.unit.number}</span>}
            {c.tenant && <span><Users size={12} className="inline ml-1" />{c.tenant.name}</span>}
            {c.filedDate && <span><Calendar size={12} className="inline ml-1" />تاريخ التسجيل: {new Date(c.filedDate).toLocaleDateString('ar')}</span>}
            {c.hearingDate && <span className="text-red-600 font-semibold"><Clock size={12} className="inline ml-1" />الجلسة: {new Date(c.hearingDate).toLocaleDateString('ar')}</span>}
          </div>
          {c.description && <p className="text-sm text-gray-600 mt-2">{c.description}</p>}
          {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
          {c.amount != null && c.amount > 0 && <p className="text-sm font-bold text-amber-700 mt-2">قيمة الغرامة / القضية: {fmtKWD(c.amount)} {CURRENCY}{c.status === 'paid' ? ' — مسددة ✓' : ''}</p>}
          {(c.attachments && c.attachments.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.attachments.map(f => (<span key={f.id}><FilePreviewDialog fileId={f.id} fileName={f.originalName} mimeType={f.mimeType} showThumbnail /></span>))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-1.5 shrink-0">
          {canWrite('legalCases') && (
            <FormDialog trigger={<Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" title="تعديل"><Edit3 size={14} /></Button>} title="تعديل القضية/المخالفة">{(close) => <LegalCaseForm buildings={buildings} units={units} tenants={tenants} initial={c} onSave={async (data) => { await api(`/api/legal-cases/${c.id}`, 'PUT', data); refresh(); }} onClose={close} />}</FormDialog>
          )}
          {canWrite('files') && (
            <FileUploadButton className="border-orange-200 text-orange-700" icon={<Camera size={14} className="ml-1" />}
              onPick={async (file) => { try { const saved: any = await uploadFile(file, 'legal_case', { legalCaseId: c.id }); if (saved?.warning) toast.warning(saved.warning); else toast.success('تم رفع مستند القضية'); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : 'فشل الرفع'); } }}>مستند</FileUploadButton>
          )}
          {canWrite('legalCases') && c.status !== 'paid' && c.amount && c.amount > 0 && (
            <Button variant="outline" size="sm" disabled={saving} className="border-emerald-200 text-emerald-700" onClick={() => setStatus('paid')} title="سداد الغرامة مع توليد القيد المحاسبي"><CheckCircle2 size={14} /></Button>
          )}
          {canWrite('legalCases') && c.status !== 'closed' && (
            <Button variant="outline" size="sm" disabled={saving} className="border-gray-200 text-gray-600" onClick={() => setStatus('closed')} title="إغلاق القضية">إغلاق</Button>
          )}
          {canWrite('legalCases') && <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => { if (confirm('حذف القضية/المخالفة نهائيًا؟')) { await api(`/api/legal-cases/${c.id}`, 'DELETE'); refresh(); toast.success('تم الحذف'); } }}><Trash2 size={14} /></Button>}
        </div>
      </div>
    </CardContent></Card>
  );
}

// نموذج مخالفة/قضية — إنشاء وتعديل
function LegalCaseForm({ buildings, units, tenants, onSave, initial, onClose }: { buildings: Building[]; units: Unit[]; tenants: Tenant[]; onSave: (data: any) => Promise<void>; initial?: any; onClose?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initial?.title || '');
  const [type, setType] = useState(initial?.type || 'municipal');
  const [reference, setReference] = useState(initial?.reference || '');
  const [buildingId, setBuildingId] = useState(initial?.buildingId || initial?.building?.id || '');
  const [unitId, setUnitId] = useState(initial?.unitId || '');
  const [tenantId, setTenantId] = useState(initial?.tenantId || '');
  const [status, setStatus] = useState(initial?.status || 'open');
  const [filedDate, setFiledDate] = useState(initial?.filedDate || new Date().toISOString().slice(0, 10));
  const [hearingDate, setHearingDate] = useState(initial?.hearingDate || '');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [description, setDescription] = useState(initial?.description || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const filteredUnits = buildingId ? units.filter((u: any) => u.buildingId === buildingId) : units;
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ title, type, reference, buildingId: buildingId || null, unitId: unitId || null, tenantId: tenantId || null, status, filedDate, hearingDate: hearingDate || null, amount: amount ? +amount : null, description, notes }); toast.success(initial ? 'تم تعديل القضية' : 'تم إنشاء القضية/المخالفة'); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ في الحفظ'); } finally { setSaving(false); } }} className="space-y-3">
    <div><Label>العنوان *</Label><Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="مثال: مخالفة بلدية — ساكنات غير مرخصة" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>النوع</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="municipal">مخالفة بلدية</SelectItem><SelectItem value="lawsuit">قضية</SelectItem><SelectItem value="other">أخرى</SelectItem></SelectContent></Select></div>
      <div><Label>الحالة</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">مفتوحة</SelectItem><SelectItem value="in_progress">قيد المتابعة</SelectItem><SelectItem value="paid">مسددة</SelectItem><SelectItem value="closed">مغلقة</SelectItem></SelectContent></Select></div>
    </div>
    <div><Label>رقم المخالفة / القضية (مرجع)</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="اختياري" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>العمارة (اختياري)</Label><Select value={buildingId} onValueChange={(v) => { setBuildingId(v); setUnitId(''); }}><SelectTrigger><SelectValue placeholder="اختر العمارة" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>الوحدة (اختياري)</Label><Select value={unitId} onValueChange={setUnitId}><SelectTrigger><SelectValue placeholder={buildingId ? 'اختر الوحدة' : 'اختر العمارة أولاً'} /></SelectTrigger><SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>وحدة {u.number}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div><Label>المستأجر المرتبط (اختياري)</Label><Select value={tenantId} onValueChange={setTenantId}><SelectTrigger><SelectValue placeholder="بدون مستأجر" /></SelectTrigger><SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid grid-cols-2 gap-3">
      <div><Label>تاريخ المخالفة / رفع القضية</Label><Input type="date" value={filedDate} onChange={e => setFiledDate(e.target.value)} /></div>
      <div><Label>موعد الجلسة القادمة</Label><Input type="date" value={hearingDate} onChange={e => setHearingDate(e.target.value)} /></div>
    </div>
    <div><Label>قيمة الغرامة / مبلغ القضية ({CURRENCY})</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
    <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg p-2.5">عند تحويل الحالة إلى «مسددة» يُولد تلقائيًا قيد محاسبي مزدوج: مدين حساب الغرامات والمخالفات (5208) / دائن الصندوق — مرتبط بالعمارة ويظهر في تقريرها</p>
    <div><Label>الوصف</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
    <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    <Button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
  </form>);
}

// =============================================================
// تحصيل شيك شركة مجمّع — للعمارة كاملة
// يوزع المبلغ تلقائيًا على عقود الشركات النشطة (الأقدم استحقاقًا أولًا)
// =============================================================
function CompanyCheckForm({ buildings, contracts, onSave, onClose }: {
  buildings: Building[]; contracts: Contract[];
  onSave: (data: any) => Promise<void>; onClose?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [buildingId, setBuildingId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('check');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  // عقود الشركات النشطة في العمارة المختارة — مرتبة أقدم أولًا (نفس ترتيب السيرفر)
  const companyContracts = contracts
    .filter(c => (c.status === 'active' || c.status === 'renewed') && c.unit?.buildingId === buildingId && c.tenant?.tenantType === 'company')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  // معاينة التوزيع: كل عقد حتى رصيده المستحق — الآخر يستوعب الفائض
  let remaining = +amount || 0;
  const preview = companyContracts.map((c, i) => {
    const bal = contractBalance(c as any, (c.payments || []) as any, new Date(date));
    const isLast = i === companyContracts.length - 1;
    const pay = isLast ? remaining : Math.min(bal.outstanding, remaining);
    remaining = Math.max(0, Math.round((remaining - pay) * 1000) / 1000);
    return { c, pay, outstanding: bal.outstanding };
  }).filter(p => p.pay > 0);
  const totalOutstanding = companyContracts.reduce((s, c) => s + contractBalance(c as any, (c.payments || []) as any, new Date(date)).outstanding, 0);
  // الفائض = المبلغ فوق إجمالي المستحق — يُسجل دفعة مقدمة على آخر عقد (نفس منطق السيرفر)
  const surplus = Math.round(((+amount || 0) - totalOutstanding) * 1000) / 1000;
  return (<form onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ buildingId, amount: +amount, method, reference, date, notes }); onClose?.(); } catch (err: any) { toast.error(err.message || 'خطأ'); } finally { setSaving(false); } }} className="space-y-3">
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-900">
      <p className="font-bold flex items-center gap-2"><Landmark size={15} />تحصيل شركات — شيك/تحويل واحد للعمارة كاملة</p>
      <p className="text-xs mt-1">يوزع النظام المبلغ تلقائيًا على عقود الشركات النشطة (الأقدم استحقاقًا يُسدد أولًا)، وكل دفعة تولّد قيدها المحاسبي على العمارة.</p>
    </div>
    <div><Label>العمارة</Label><Select value={buildingId} onValueChange={setBuildingId} required><SelectTrigger><SelectValue placeholder="اختر العمارة" /></SelectTrigger><SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
    {buildingId && (companyContracts.length === 0 ? (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">لا توجد عقود شركات نشطة في هذه العمارة — المستأجرون هنا أفراد، استخدم «تسجيل دفعة» العادية لكل مستأجر على حدة</p>
    ) : (
      <div className="border border-orange-100 rounded-xl overflow-hidden">
        <div className="bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900">عقود الشركات في العمارة ({companyContracts.length}) — إجمالي المستحق: {fmtKWD(totalOutstanding)} {CURRENCY}</div>
        <div className="max-h-44 overflow-y-auto divide-y divide-gray-100">
          {companyContracts.map((c, i) => (<div key={c.id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-800">{c.tenant?.name} — وحدة {c.unit?.number}</span>
            <span className="text-gray-500 shrink-0">إيجار {fmtKWD(c.rentAmount)} — متبقٍ <b className="text-red-600">{fmtKWD(contractBalance(c as any, (c.payments || []) as any, new Date(date)).outstanding)}</b></span>
          </div>))}
        </div>
      </div>
    ))}
    {companyContracts.length > 0 && (<>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>مبلغ الشيك / التحويل ({CURRENCY})</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
        <div><Label>الطريقة</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="check">شيك</SelectItem><SelectItem value="transfer">تحويل بنكي</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>رقم الشيك / المرجع</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="اختياري" /></div>
        <div><Label>تاريخ الاستلام</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
      </div>
      {amount && +amount > 0 && (
        <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-bold text-emerald-900">معاينة التوزيع:</p>
          {preview.map(p => { const settle = Math.min(p.outstanding, p.pay); const advance = Math.round((p.pay - settle) * 1000) / 1000; return (<div key={p.c.id} className="text-xs flex justify-between text-emerald-900"><span>{p.c.tenant?.name} — وحدة {p.c.unit?.number}</span><b>{fmtKWD(p.pay)} {CURRENCY}{advance > 0 ? <span className="font-normal text-amber-700"> (تسديد {fmtKWD(settle)} + مقدمة {fmtKWD(advance)})</span> : ''}</b></div>); })}
          {surplus > 0 && <p className="text-xs text-amber-800">فائض {fmtKWD(surplus)} {CURRENCY} فوق إجمالي المستحق — سيُسجل دفعة مقدمة على آخر عقد وتوثّق في الملاحظات</p>}
          {surplus < 0 && <p className="text-xs text-gray-600">لم يُغطَّ كامل المستحق — سيتبقى {fmtKWD(-surplus)} {CURRENCY} مستحقة بعد هذا الشيك</p>}
        </div>
      )}
      <div><Label>ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </>)}
    <Button type="submit" disabled={saving || !buildingId || !amount || +amount <= 0 || companyContracts.length === 0} className="w-full bg-gradient-to-l from-orange-500 to-amber-500 text-white font-bold">{saving ? 'جاري التوزيع والحفظ...' : 'توزيع الشيك وتسجيل الدفعات'}</Button>
  </form>);
}

// محتوى القائمة الجانبية — مشترك بين الديسكتوب ودرج الموبايل
// قائمة مجمّعة: البنود المتشابهة داخل مجموعات منسدلة (اضغط المجموعة تفتح/تطوي)
// والمجموعة التي يوجد بها القسم الحالي تُفتح تلقائيًا عند التنقل
function SidebarContent({ user, section, isAdmin, onNavigate, onLogout, counts = {} }: {
  user: User; section: Section; isAdmin: boolean;
  onNavigate: (s: Section) => void; onLogout: () => void;
  counts?: Record<string, number>;
}) {
  type NavItem = { key: Section; icon: React.ReactNode; label: string };
  type NavGroup = { id: string; title: string; icon: React.ReactNode; items: NavItem[]; admin?: boolean };
  const NAV_GROUPS: NavGroup[] = [
    { id: 'properties', title: 'العقارات', icon: <Building2 size={17} />, items: [
      { key: 'buildings', icon: <Building2 size={17} />, label: 'المباني' },
      { key: 'units', icon: <Home size={17} />, label: 'الوحدات' },
      { key: 'maintenance', icon: <Wrench size={17} />, label: 'الصيانة' },
      { key: 'files', icon: <FolderOpen size={17} />, label: 'الملفات' },
    ] },
    { id: 'clients', title: 'العملاء والعقود', icon: <Users size={17} />, items: [
      { key: 'tenants', icon: <Users size={17} />, label: 'المستأجرين' },
      { key: 'contracts', icon: <FileText size={17} />, label: 'العقود' },
      { key: 'legalCases', icon: <Gavel size={17} />, label: 'المخالفات والقضايا' },
    ] },
    { id: 'finance', title: 'المالية', icon: <Landmark size={17} />, items: [
      { key: 'payments', icon: <DollarSign size={17} />, label: 'المدفوعات' },
      { key: 'transactions', icon: <TrendingUp size={17} />, label: 'الإيرادات والمصروفات' },
      { key: 'suppliers', icon: <Truck size={17} />, label: 'الموردين والمقاولين' },
      { key: 'loans', icon: <Briefcase size={17} />, label: 'القروض' },
      { key: 'voucherRegister', icon: <ReceiptText size={17} />, label: 'سجل السندات' },
    ] },
    { id: 'accounting', title: 'المحاسبة', icon: <Scale size={17} />, admin: true, items: [
      { key: 'accounts', icon: <Hash size={17} />, label: 'شجرة الحسابات' },
      { key: 'journal', icon: <ReceiptText size={17} />, label: 'القيود اليومية' },
      { key: 'trialBalance', icon: <Scale size={17} />, label: 'ميزان المراجعة' },
    ] },
    { id: 'system', title: 'النظام', icon: <Shield size={17} />, admin: true, items: [
      { key: 'users', icon: <Shield size={17} />, label: 'المستخدمون' },
      { key: 'audit', icon: <Activity size={17} />, label: 'سجل التدقيق' },
      { key: 'restore', icon: <Archive size={17} />, label: 'نقاط الاستعادة' },
      { key: 'health', icon: <Activity size={17} />, label: 'صحة النظام' },
    ] },
  ];
  const directItems: Record<'dashboard' | 'settings', NavItem> = {
    dashboard: { key: 'dashboard', icon: <LayoutDashboard size={17} />, label: 'لوحة التحكم' },
    settings: { key: 'settings', icon: <Settings size={17} />, label: 'الإعدادات' },
  };

  const groupOfSection = (s: Section) => NAV_GROUPS.find(g => g.items.some(i => i.key === s))?.id || null;
  // حالة الفتح: اختيار المستخدم يغلب — وإلا المجموعة الحالية مفتوحة تلقائيًا مشتقًا من القسم النشط
  // (بدون أي useEffect: التنقل من الوصول السريع يفتح المجموعة تلقائيًا لأن الحالة مشتقة)
  const [groupState, setGroupState] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => groupState[id] ?? groupOfSection(section) === id;
  const toggleGroup = (id: string) => setGroupState(prev => ({ ...prev, [id]: !isOpen(id) }));

  const navBtn = (item: NavItem) => {
    const n = counts[item.key];
    return (
    <button key={item.key} onClick={() => onNavigate(item.key)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${section === item.key ? 'bg-gradient-to-l from-orange-500 to-amber-500 text-white shadow-md' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700'}`}>
      {item.icon}<span className="flex-1 text-right">{item.label}</span>
      {typeof n === 'number' && (
        <span title={`عدد السجلات: ${n}`}
          className={`text-[10px] font-bold leading-none rounded-full px-1.5 py-1 min-w-[20px] text-center ${section === item.key ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-700'}`}>{n.toLocaleString('en-US')}</span>
      )}
    </button>
    );
  };

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
      {navBtn(directItems.dashboard)}
      {NAV_GROUPS.filter(g => !g.admin || isAdmin).map(group => {
        const activeInside = group.items.some(i => i.key === section);
        const open = isOpen(group.id);
        // عدد سجلات المجموعة = مجموع أعداد بنودها — وقبل تحميل الأعداد يظهر عدد البنود كما كان
        const hasCounts = group.items.some(i => typeof counts[i.key] === 'number');
        const groupCount = group.items.reduce((s, i) => s + (counts[i.key] ?? 0), 0);
        return (
          <div key={group.id}>
            <button onClick={() => toggleGroup(group.id)}
              aria-expanded={open}
              title={open ? `اضغط لإخفاء ${group.title}` : `اضغط لعرض ${group.title}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeInside ? 'bg-orange-100/80 text-orange-800 shadow-sm' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-colors ${activeInside ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white' : 'bg-orange-100 text-orange-600'}`}>{group.icon}</span>
              <span className="flex-1 text-right">{group.title}</span>
              <span className="text-[10px] font-medium text-gray-400" title={hasCounts ? 'إجمالي سجلات بنود المجموعة' : undefined}>{hasCounts ? groupCount.toLocaleString('en-US') : group.items.length}</span>
              <ChevronDown size={15} className={`text-orange-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="mt-1 mb-1 mr-[22px] space-y-0.5 border-r-2 border-orange-100 pr-2.5">
                {group.items.map(navBtn)}
              </div>
            )}
          </div>
        );
      })}
      {navBtn(directItems.settings)}
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
                {loan.receiptNo && <Badge className="bg-slate-800 text-white text-[11px] tabular-nums" title="الرقم التسلسلي لسند استلام القرض">سند قبض {loan.receiptNo}</Badge>}
                {buildingName && <Badge className="bg-orange-100 text-orange-800 text-[11px]">{buildingName}</Badge>}
                <Badge className="bg-purple-100 text-purple-800 text-[11px]">فائدة {loan.rate}%</Badge>
                <Badge className="bg-blue-100 text-blue-800 text-[11px]">{loan.months} شهر</Badge>
                <Badge className="bg-teal-100 text-teal-800 text-[11px]">قسط شهري ≈ {fmtKWD(principal / Math.max(1, Number(loan.months) || 1) + principal * (Number(loan.rate) || 0) / 100 / 12)} {CURRENCY}</Badge>
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
                      <p className="text-xs font-semibold text-gray-700">{lp.paymentNo && <span className="text-red-700 tabular-nums mr-1">سند {lp.paymentNo} •</span>}{new Date(lp.date).toLocaleDateString('ar')}</p>
                      <p className="text-[11px] text-gray-500">أصل {fmtKWD(lp.principal)} • فوائد {fmtKWD(lp.interest)} • إجمالي <b className="text-gray-700">{fmtKWD((Number(lp.principal) || 0) + (Number(lp.interest) || 0))} {CURRENCY}</b></p>
                    </div>
                    <VoucherDialog trigger={<Button variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50 shrink-0" title={`سند صرف القسط ${lp.paymentNo || ''}`}><Printer size={14} /></Button>} title={`سند صرف ${lp.paymentNo || ''} — قسط قرض`} docHtml={loanPaymentVoucherHtml(lp, loan.name, CURRENCY)} />
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
