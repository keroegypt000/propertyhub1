// =============================================================
// مكتبة استيراد/تصدير Excel — SheetJS
// لكل كيان: أعمدة عربية موحدة (للتصدير والقالب والاستيراد) + تحليل ذكي للمراجع
// الاستيراد يحلّ المراجع بالأسماء: «العمارة» → buildingId، «المستأجر + الوحدة» → contractId
// التواريخ: YYYY-MM-DD أو DD/MM/YYYY (النمط المصري/الخليجي) أو خلية تاريخ إكسل
// الأرقام: تقبل الأرقام العربية ٠-٩ والفواصل "1,234.5"
// =============================================================
import * as XLSX from 'xlsx';

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
  example?: string; // صف المثال في القالب
  note?: string;    // ملاحظة إرشادية في القالب
}

export interface ImportRowResult {
  ok: boolean;
  data?: any;
  error?: string;
}

export interface ImportCtx {
  buildings: any[];
  units: any[];
  tenants: any[];
  contracts: any[];
  // بيانات إضافية تُجلب فقط في وضع «تحديث موجود» لمطابقة الصفوف بالسجلات الحالية
  transactions?: any[];
  loans?: any[];
  maintenance?: any[];
  accounts?: any[];
}

/** في وضع التحديث: ما الذي يجب جلبه لكل كيان ليعمل قسم المطابقة */
export const UPDATE_CTX_EXTRA: Record<string, string[]> = {
  buildings: ['buildings'],
  units: ['units'],
  tenants: ['tenants'],
  contracts: ['contracts'],
  payments: ['contracts'],
  transactions: ['transactions'],
  loans: ['loans'],
  maintenance: ['maintenance'],
  accounts: ['accounts'],
};

/**
 * وضع «تحديث بيانات موجودة»: يطابق صف الملف مع سجل موجود في النظام بمفتاح طبيعي:
 * العمارات: الكود أو الاسم | الوحدات: العمارة + رقم الوحدة | المستأجرين: الاسم
 * العقود: العقد النشط على نفس الوحدة | المدفوعات: نفس العقد + نفس تاريخ الاستحقاق
 * الحركات: تاريخ + مبلغ + بيان | القروض: الاسم + العمارة | الصيانة: العنوان + الوحدة | الحسابات: رقم الحساب
 * يرجع { id } إن وجد مطابق (يُحدَّث بـ PUT) أو undefined (يُضاف جديد بـ POST)
 */
export function findExistingMatch(key: string, data: any, ctx: ImportCtx): { id: string } | undefined {
  const L = ctx as any;
  switch (key) {
    case 'buildings':
      return L.buildings?.find((b: any) =>
        (data.code && b.code && normMatch(b.code) === normMatch(data.code)) ||
        (data.name && b.name && normMatch(b.name) === normMatch(data.name)));
    case 'units':
      return L.units?.find((u: any) => u.buildingId === data.buildingId && String(u.number ?? '').trim() === String(data.number ?? '').trim());
    case 'tenants':
      return L.tenants?.find((t: any) => normMatch(t.name) === normMatch(data.name));
    case 'contracts': {
      // العقد النشط على نفس الوحدة — تحديثه بدل الرفض بـ «يوجد عقد نشط آخر»
      const active = (L.contracts as any[] | undefined)?.find((c: any) => ['active', 'renewed'].includes(c.status) && c.unitId === data.unitId);
      return active ? { id: active.id } : undefined;
    }
    case 'payments': {
      const c = (L.contracts as any[] | undefined)?.find((x: any) => x.id === data.contractId);
      const due = String(data.dueDate || '').slice(0, 10);
      const p = (c?.payments || []).find((x: any) => String(x.dueDate || '').slice(0, 10) === due);
      return p ? { id: p.id } : undefined;
    }
    case 'transactions':
      return L.transactions?.find((x: any) =>
        x.date === data.date &&
        Math.round((x.amount || 0) * 1000) / 1000 === Math.round((data.amount || 0) * 1000) / 1000 &&
        normMatch(x.category) === normMatch(data.category) &&
        (x.buildingId || undefined) === (data.buildingId || undefined));
    case 'loans':
      return L.loans?.find((x: any) => normMatch(x.name) === normMatch(data.name) && (x.buildingId || undefined) === (data.buildingId || undefined));
    case 'maintenance':
      return L.maintenance?.find((x: any) => normMatch(x.title) === normMatch(data.title) && (x.unitId || undefined) === (data.unitId || undefined));
    case 'accounts':
      return L.accounts?.find((x: any) => String(x.code).trim() === String(data.code).trim());
    default:
      return undefined;
  }
}

// ---------- أدوات تحليل ----------

export function toNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return isFinite(v) ? v : undefined;
  let s = String(v).trim();
  s = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  s = s.replace(/[٫،]/g, '.'); // فاصلة عشرية عربية
  // فاصلة ASCII واحدة يتبعها 1-2 خانة وعلامة عشرية غير موجودة → عشرية (350,5 = 350.5)
  const commas = (s.match(/,/g) || []).length;
  if (commas === 1 && !s.includes('.') && /,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  s = s.replace(/\s/g, '').replace(/[^\d.\-]/g, '');
  if (!s || s === '-' || s === '.') return undefined;
  const n = parseFloat(s);
  return isFinite(n) ? n : undefined;
}

export function toInt(v: any): number | undefined {
  const n = toNumber(v);
  return n === undefined ? undefined : Math.round(n);
}

/** تحويل قيمة تاريخ إلى YYYY-MM-DD */
export function toDateStr(v: any): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = v;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim()
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫]/g, '/');
  if (!s) return undefined;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) {
    let day = parseInt(m[1], 10), mon = parseInt(m[2], 10);
    if (mon > 12 && day <= 12) { const t = day; day = mon; mon = t; }
    return `${m[3]}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return undefined;
}

export function toMonthStr(v: any): string | undefined {
  const d = toDateStr(v);
  if (d) return d.slice(0, 7);
  const s = String(v || '').trim().replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
  const m = /^(\d{4})[-/](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  return undefined;
}

function norm(s: any): string {
  return String(s ?? '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) // أرقام عربية-هندية → لاتينية (لأرقام الوحدات والهواتف)
    .trim().replace(/\s+/g, ' ');
}

/** تطبيع أقوى للمطابقة فقط (لا يُخزن): يشيل التشكيل والتطويل ويوحد الهمزات والتاء المربوطة */
function normMatch(s: any): string {
  return norm(s)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // تشكيل + تطويل
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

/** يطابق قيمة قادمة من الإكسل مع معجم (عربي → كود) مع قبول الكود الإنجليزي نفسه */
export function mapValue(v: any, dict: Record<string, string>): string | undefined {
  const s = normMatch(v);
  if (!s) return undefined;
  const low = s.toLowerCase();
  for (const code of Object.values(dict)) if (low === code || s === code) return code;
  for (const [ar, code] of Object.entries(dict)) {
    const arN = normMatch(ar);
    if (s === arN || s.includes(arN) || arN.includes(s)) return code;
  }
  return undefined;
}

// ---------- معاجم القيم العربية ----------
export const DICTS = {
  unitType: { 'شقة': 'apartment', 'سكني': 'apartment', 'استوديو': 'studio', 'ستوديو': 'studio', 'مكتب': 'office', 'اداري': 'office', 'إداري': 'office', 'محل': 'shop', 'تجاري': 'shop', 'مخزن': 'warehouse', 'مستودع': 'warehouse' },
  unitStatus: { 'متاحة': 'available', 'متاح': 'available', 'شاغرة': 'available', 'مؤجرة': 'rented', 'مؤجر': 'rented', 'مؤجّرة': 'rented', 'مشغولة': 'rented', 'صيانة': 'maintenance', 'تحت الصيانة': 'maintenance', 'محجوزة': 'reserved', 'محجوز': 'reserved' },
  contractStatus: { 'نشط': 'active', 'ساري': 'active', 'منتهي': 'expired', 'منتهية': 'expired', 'ملغي': 'terminated', 'ملغى': 'terminated', 'مجدد': 'renewed', 'مجدّد': 'renewed', 'اخلي': 'vacated', 'إخلاء': 'vacated' },
  paymentStatus: { 'معلق': 'pending', 'لم يدفع': 'pending', 'مدفوع': 'paid', 'مدفوعة': 'paid', 'جزئي': 'partial', 'جزئية': 'partial', 'متأخر': 'overdue', 'متأخرة': 'overdue', 'ملغي': 'cancelled', 'ملغى': 'cancelled' },
  payMethod: { 'كاش': 'cash', 'نقدي': 'cash', 'نقدا': 'cash', 'cash': 'cash', 'تحويل': 'transfer', 'حوالة': 'transfer', 'بنكي': 'transfer', 'transfer': 'transfer', 'شيك': 'check', 'check': 'check', 'بطاقة': 'card', 'شبكة': 'card', 'كي نت': 'card', 'card': 'card' },
  maintCategory: { 'سباكة': 'plumbing', 'كهرباء': 'electrical', 'تكييف': 'ac', 'تكييفات': 'ac', 'مصعد': 'elevator', 'مصاعد': 'elevator', 'مدني': 'civil', 'إنشائي': 'civil', 'انشائي': 'civil', 'تنظيف': 'cleaning', 'أخرى': 'other', 'اخرى': 'other' },
  maintStatus: { 'مفتوح': 'open', 'جديد': 'open', 'قيد التنفيذ': 'in_progress', 'جاري التنفيذ': 'in_progress', 'مكتمل': 'completed', 'منجز': 'completed', 'تم': 'completed', 'ملغي': 'cancelled', 'ملغى': 'cancelled' },
  priority: { 'منخفض': 'low', 'عادي': 'low', 'متوسط': 'medium', 'عالي': 'high', 'مرتفع': 'high', 'عاجل': 'urgent', 'طارئ': 'urgent', 'حرج': 'urgent' },
  txType: { 'إيراد': 'income', 'ايراد': 'income', 'دخل': 'income', 'income': 'income', 'مصروف': 'expense', 'مصاريف': 'expense', 'expense': 'expense' },
  accType: { 'أصول': 'asset', 'اصول': 'asset', 'التزامات': 'liability', 'حقوق ملكية': 'equity', 'حقوق': 'equity', 'إيرادات': 'revenue', 'ايرادات': 'revenue', 'مصروفات': 'expense' },
  accKind: { 'رئيسي': 'group', 'تجميعي': 'group', 'فرعي': 'post', 'تشغيلي': 'post' },
  idType: { 'رقم قومي': 'national', 'قومي': 'national', 'جواز سفر': 'passport', 'جواز': 'passport', 'سجل تجاري': 'commercial', 'تجاري': 'commercial' },
};

// ---------- محلّلات المراجع (بالاسم/الكود) ----------
function findBuilding(ctx: ImportCtx, nameOrCode: any) {
  const s = normMatch(nameOrCode);
  if (!s) return undefined;
  return ctx.buildings.find((b: any) => b.code === s || normMatch(b.name) === s || normMatch(b.name).includes(s) || s.includes(normMatch(b.name)));
}
function findUnit(ctx: ImportCtx, buildingRef: any, number: any) {
  const numStr = norm(number);
  if (!numStr) return undefined;
  const b = buildingRef ? findBuilding(ctx, buildingRef) : undefined;
  const candidates = ctx.units.filter((u: any) => {
    const un = String(u.number ?? '').trim();
    return un === numStr || (un !== '' && (un.includes(numStr) || numStr.includes(un)));
  });
  if (b) return candidates.find((u: any) => u.buildingId === b.id) || candidates[0];
  return candidates[0];
}
function findTenant(ctx: ImportCtx, name: any) {
  const s = normMatch(name);
  if (!s) return undefined;
  return ctx.tenants.find((t: any) => normMatch(t.name) === s || normMatch(t.name).includes(s) || s.includes(normMatch(t.name)));
}
function findContract(ctx: ImportCtx, opts: { building?: any; unitNumber?: any; tenant?: any }) {
  const t = opts.tenant ? findTenant(ctx, opts.tenant) : undefined;
  const u = (opts.building || opts.unitNumber) ? findUnit(ctx, opts.building, opts.unitNumber || '') : undefined;
  let pool = ctx.contracts as any[];
  if (t) pool = pool.filter(c => c.tenantId === t.id);
  if (u) pool = pool.filter(c => c.unitId === u.id);
  if (!t && !u) return undefined;
  return pool.find(c => c.status === 'active') || pool.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
}

// ---------- تعريفات الكيانات ----------
export interface EntityDef {
  key: string;
  label: string;
  sheetName: string;
  columns: ExcelColumn[];
  exportRow: (r: any) => Record<string, any>;
  parseRow: (row: Record<string, any>, columns: ExcelColumn[], ctx: ImportCtx, seen: Set<string>) => ImportRowResult;
  ctxNeeds?: ('buildings' | 'units' | 'tenants' | 'contracts')[];
  apiPath: string;
}

function g(row: Record<string, any>, columns: ExcelColumn[], key: string): any {
  const col = columns.find(c => c.key === key);
  if (!col) return undefined;
  const v = row[col.header];
  return v !== undefined && v !== null && String(v).trim() !== '' ? v : undefined;
}

const EMPTY_CTX: ImportCtx = { buildings: [], units: [], tenants: [], contracts: [] };

export const ENTITIES: Record<string, EntityDef> = {
  // ============ العمارات ============
  buildings: {
    key: 'buildings', label: 'العمارات', sheetName: 'العمارات', apiPath: '/api/buildings',
    columns: [
      { key: 'code', header: 'الكود', width: 12, example: 'B01', note: 'كود فريد — إجباري' },
      { key: 'name', header: 'اسم العمارة', width: 22, example: 'عمارة الفروانية', note: 'إجباري' },
      { key: 'address', header: 'العنوان', width: 26, example: 'شارع الخليج، قطعة 5' },
      { key: 'city', header: 'المحافظة', width: 14, example: 'العاصمة' },
      { key: 'floors', header: 'عدد الطوابق', width: 12, example: '5' },
      { key: 'unitsCount', header: 'عدد الوحدات', width: 12, example: '10' },
      { key: 'value', header: 'القيمة الدفترية', width: 15, example: '250000' },
      { key: 'license', header: 'رقم الترخيص', width: 15, example: 'L-2024-001' },
      { key: 'notes', header: 'ملاحظات', width: 22 },
    ],
    exportRow: (b) => ({
      'الكود': b.code || '', 'اسم العمارة': b.name || '', 'العنوان': b.address || '', 'المحافظة': b.city || '',
      'عدد الطوابق': b.floors ?? '', 'عدد الوحدات': b.unitsCount ?? (b.units?.length ?? ''),
      'القيمة الدفترية': b.value ?? '', 'رقم الترخيص': b.license || '', 'ملاحظات': b.notes || '',
    }),
    parseRow: (row, columns) => {
      const name = norm(g(row, columns, 'name'));
      const code = norm(g(row, columns, 'code'));
      if (!name) return { ok: false, error: 'اسم العمارة مطلوب' };
      return { ok: true, data: {
        name,
        code: code || name,
        address: norm(g(row, columns, 'address')) || undefined,
        city: norm(g(row, columns, 'city')) || undefined,
        floors: toInt(g(row, columns, 'floors')),
        unitsCount: toInt(g(row, columns, 'unitsCount')),
        value: toNumber(g(row, columns, 'value')),
        license: norm(g(row, columns, 'license')) || undefined,
        notes: norm(g(row, columns, 'notes')) || undefined,
      } };
    },
  },

  // ============ الوحدات ============
  units: {
    key: 'units', label: 'الوحدات', sheetName: 'الوحدات', apiPath: '/api/units',
    ctxNeeds: ['buildings', 'contracts'],
    columns: [
      { key: 'building', header: 'العمارة', width: 20, example: 'B01', note: 'اسم أو كود عمارة موجودة (استورد العمارات أولاً)' },
      { key: 'number', header: 'رقم الوحدة', width: 12, example: '101', note: 'إجباري' },
      { key: 'floor', header: 'الطابق', width: 10, example: '1' },
      { key: 'area', header: 'المساحة م2', width: 12, example: '120' },
      { key: 'type', header: 'النوع', width: 12, example: 'شقة', note: 'شقة / استوديو / مكتب / محل / مخزن' },
      { key: 'status', header: 'الحالة', width: 12, example: 'متاحة', note: 'متاحة / مؤجرة / صيانة / محجوزة' },
      { key: 'rentAmount', header: 'الإيجار الشهري', width: 15, example: '350' },
      { key: 'notes', header: 'ملاحظات', width: 22 },
    ],
    exportRow: (u) => ({
      'العمارة': u.building?.name || u.building?.code || '', 'رقم الوحدة': u.number || '',
      'الطابق': u.floor ?? '', 'المساحة م2': u.area ?? '',
      'النوع': ({ apartment: 'شقة', studio: 'استوديو', office: 'مكتب', shop: 'محل', warehouse: 'مخزن' } as any)[u.type || ''] || u.type || '',
      'الحالة': ({ available: 'متاحة', rented: 'مؤجرة', maintenance: 'صيانة', reserved: 'محجوزة' } as any)[u.status] || u.status,
      'الإيجار الشهري': u.rentAmount ?? '', 'ملاحظات': u.notes || '',
    }),
    parseRow: (row, columns, ctx) => {
      const number = norm(g(row, columns, 'number'));
      if (!number) return { ok: false, error: 'رقم الوحدة مطلوب' };
      const bRef = norm(g(row, columns, 'building'));
      const b = findBuilding(ctx, bRef);
      if (!b) return { ok: false, error: `العمارة «${bRef || '—'}» غير موجودة — استورد العمارات أولاً` };
      // الوحدة عليها عقد نشط في النظام؟ تُعتبر مؤجرة تلقائيًا حتى لو وردت «متاحة» في الملف
      const hasActiveContract = (ctx.contracts || []).some((c: any) => {
        if (!['active', 'renewed'].includes(c.status)) return false;
        const cu = c.unit;
        if (!cu) return false;
        if (cu.buildingId && cu.buildingId !== b.id) return false;
        return String(cu.number ?? '').trim() === number;
      });
      const status = hasActiveContract ? 'rented' : (mapValue(g(row, columns, 'status'), DICTS.unitStatus) || 'available');
      return { ok: true, data: {
        buildingId: b.id,
        number,
        floor: toInt(g(row, columns, 'floor')),
        area: toNumber(g(row, columns, 'area')),
        type: mapValue(g(row, columns, 'type'), DICTS.unitType) || undefined,
        status,
        rentAmount: toNumber(g(row, columns, 'rentAmount')),
        notes: norm(g(row, columns, 'notes')) || undefined,
      } };
    },
  },

  // ============ المستأجرين ============
  tenants: {
    key: 'tenants', label: 'المستأجرين', sheetName: 'المستأجرين', apiPath: '/api/tenants',
    columns: [
      { key: 'name', header: 'الاسم', width: 24, example: 'أحمد محمد علي', note: 'إجباري' },
      { key: 'phone', header: 'الهاتف', width: 15, example: '99001122' },
      { key: 'email', header: 'البريد الإلكتروني', width: 22, example: 'ahmed@mail.com' },
      { key: 'idNumber', header: 'الرقم المدني / الهوية', width: 18, example: '289012345678' },
      { key: 'idType', header: 'نوع الهوية', width: 14, example: 'رقم قومي', note: 'رقم قومي / جواز سفر / سجل تجاري' },
      { key: 'address', header: 'العنوان', width: 24, example: '' },
      { key: 'emergencyContact', header: 'جهة اتصال للطوارئ', width: 20, example: '' },
      { key: 'guarantor', header: 'اسم الضامن', width: 20, example: '' },
      { key: 'guarantorPhone', header: 'هاتف الضامن', width: 15, example: '' },
      { key: 'notes', header: 'ملاحظات', width: 22 },
    ],
    exportRow: (t) => ({
      'الاسم': t.name || '', 'الهاتف': t.phone || '', 'البريد الإلكتروني': t.email || '',
      'الرقم المدني / الهوية': t.idNumber || '',
      'نوع الهوية': ({ national: 'رقم قومي', passport: 'جواز سفر', commercial: 'سجل تجاري' } as any)[t.idType || ''] || t.idType || '',
      'العنوان': t.address || '', 'جهة اتصال للطوارئ': t.emergencyContact || '',
      'اسم الضامن': t.guarantor || '', 'هاتف الضامن': t.guarantorPhone || '', 'ملاحظات': t.notes || '',
    }),
    parseRow: (row, columns) => {
      const name = norm(g(row, columns, 'name'));
      if (!name) return { ok: false, error: 'اسم المستأجر مطلوب' };
      return { ok: true, data: {
        name,
        phone: norm(g(row, columns, 'phone')) || undefined,
        email: norm(g(row, columns, 'email')) || undefined,
        idNumber: norm(g(row, columns, 'idNumber')) || undefined,
        idType: mapValue(g(row, columns, 'idType'), DICTS.idType) || undefined,
        address: norm(g(row, columns, 'address')) || undefined,
        emergencyContact: norm(g(row, columns, 'emergencyContact')) || undefined,
        guarantor: norm(g(row, columns, 'guarantor')) || undefined,
        guarantorPhone: norm(g(row, columns, 'guarantorPhone')) || undefined,
        notes: norm(g(row, columns, 'notes')) || undefined,
      } };
    },
  },

  // ============ العقود ============
  contracts: {
    key: 'contracts', label: 'العقود', sheetName: 'العقود', apiPath: '/api/contracts',
    ctxNeeds: ['buildings', 'units', 'tenants'],
    columns: [
      { key: 'building', header: 'العمارة', width: 20, example: 'B01', note: 'اسم أو كود العمارة' },
      { key: 'unitNumber', header: 'رقم الوحدة', width: 12, example: '101', note: 'إجباري' },
      { key: 'tenant', header: 'المستأجر', width: 24, example: 'أحمد محمد علي', note: 'اسم مستأجر موجود (استورد المستأجرين أولاً) — إجباري' },
      { key: 'startDate', header: 'تاريخ البداية', width: 15, example: '2025-01-01', note: 'إجباري — YYYY-MM-DD أو 01/01/2025' },
      { key: 'endDate', header: 'تاريخ النهاية', width: 15, example: '2025-12-31', note: 'إجباري' },
      { key: 'rentAmount', header: 'الإيجار الشهري', width: 14, example: '350', note: 'قبل الخصم — إجباري' },
      { key: 'discount', header: 'الخصم الشهري', width: 14, example: '40', note: 'اختياري — الإيجار الفعلي = الإيجار − الخصم' },
      { key: 'deposit', header: 'مبلغ التأمين', width: 14, example: '200' },
      { key: 'paymentDay', header: 'يوم الدفع (1-31)', width: 14, example: '5' },
      { key: 'status', header: 'الحالة', width: 12, example: 'نشط', note: 'نشط / منتهي / ملغي / مجدد' },
      { key: 'terms', header: 'الشروط', width: 24, example: '' },
      { key: 'notes', header: 'ملاحظات', width: 22 },
    ],
    exportRow: (c) => ({
      'العمارة': c.unit?.building?.name || '', 'رقم الوحدة': c.unit?.number || '', 'المستأجر': c.tenant?.name || '',
      'تاريخ البداية': c.startDate ? String(c.startDate).slice(0, 10) : '',
      'تاريخ النهاية': c.endDate ? String(c.endDate).slice(0, 10) : '',
      'الإيجار الشهري': c.rentAmount ?? '', 'الخصم الشهري': c.discount ?? 0, 'مبلغ التأمين': c.deposit ?? '', 'يوم الدفع (1-31)': c.paymentDay ?? '',
      'الحالة': ({ active: 'نشط', expired: 'منتهي', terminated: 'ملغي', renewed: 'مجدد', vacated: 'إخلاء' } as any)[c.status] || c.status,
      'الشروط': c.terms || '', 'ملاحظات': c.notes || '',
    }),
    parseRow: (row, columns, ctx) => {
      const unitNumber = norm(g(row, columns, 'unitNumber'));
      const tenantName = norm(g(row, columns, 'tenant'));
      const start = toDateStr(g(row, columns, 'startDate'));
      const end = toDateStr(g(row, columns, 'endDate'));
      const rent = toNumber(g(row, columns, 'rentAmount'));
      if (!unitNumber) return { ok: false, error: 'رقم الوحدة مطلوب' };
      if (!tenantName) return { ok: false, error: 'اسم المستأجر مطلوب' };
      const u = findUnit(ctx, g(row, columns, 'building'), unitNumber);
      if (!u) return { ok: false, error: `الوحدة «${unitNumber}» غير موجودة — استورد الوحدات أولاً` };
      const t = findTenant(ctx, tenantName);
      if (!t) return { ok: false, error: `المستأجر «${tenantName}» غير موجود — استورد المستأجرين أولاً` };
      if (!start) return { ok: false, error: 'تاريخ البداية مطلوب وغير صالح' };
      if (!end) return { ok: false, error: 'تاريخ النهاية مطلوب وغير صالح' };
      if (!rent || rent <= 0) return { ok: false, error: 'قيمة الإيجار مطلوبة وأكبر من صفر' };
      return { ok: true, data: {
        unitId: u.id, tenantId: t.id,
        startDate: start, endDate: end, rentAmount: rent,
        discount: toNumber(g(row, columns, 'discount')) ?? 0,
        deposit: toNumber(g(row, columns, 'deposit')) ?? 0,
        paymentDay: toInt(g(row, columns, 'paymentDay')),
        status: mapValue(g(row, columns, 'status'), DICTS.contractStatus) || 'active',
        terms: norm(g(row, columns, 'terms')) || undefined,
        notes: norm(g(row, columns, 'notes')) || undefined,
      } };
    },
  },

  // ============ المدفوعات ============
  payments: {
    key: 'payments', label: 'المدفوعات', sheetName: 'المدفوعات', apiPath: '/api/payments',
    ctxNeeds: ['buildings', 'units', 'tenants', 'contracts'],
    columns: [
      { key: 'building', header: 'العمارة', width: 20, example: 'B01', note: 'لتحديد العقد (اختياري إن كان رقم الوحدة كافياً)' },
      { key: 'unitNumber', header: 'رقم الوحدة', width: 12, example: '101' },
      { key: 'tenant', header: 'المستأجر', width: 24, example: 'أحمد محمد علي', note: 'لتحديد العقد — المستأجر + الوحدة معاً يحدد العقد' },
      { key: 'amount', header: 'المبلغ', width: 14, example: '350', note: 'إجباري' },
      { key: 'dueDate', header: 'تاريخ الاستحقاق', width: 15, example: '2025-01-05', note: 'إجباري' },
      { key: 'paidDate', header: 'تاريخ الدفع', width: 15, example: '2025-01-03' },
      { key: 'month', header: 'عن شهر', width: 12, example: '2025-01', note: 'YYYY-MM' },
      { key: 'status', header: 'الحالة', width: 12, example: 'مدفوع', note: 'مدفوع / معلق / جزئي / متأخر / ملغي' },
      { key: 'method', header: 'طريقة الدفع', width: 14, example: 'كاش', note: 'كاش / تحويل بنكي / شيك / بطاقة' },
      { key: 'reference', header: 'رقم السند / المرجع', width: 18, example: 'R-125' },
      { key: 'notes', header: 'ملاحظات', width: 22 },
    ],
    exportRow: (p) => ({
      'العمارة': p.contract?.unit?.building?.name || '', 'رقم الوحدة': p.contract?.unit?.number || '',
      'المستأجر': p.contract?.tenant?.name || '',
      'المبلغ': p.amount ?? '',
      'تاريخ الاستحقاق': p.dueDate ? String(p.dueDate).slice(0, 10) : '',
      'تاريخ الدفع': p.paidDate ? String(p.paidDate).slice(0, 10) : '',
      'عن شهر': p.month || '',
      'الحالة': ({ pending: 'معلق', paid: 'مدفوع', partial: 'جزئي', overdue: 'متأخر', cancelled: 'ملغي' } as any)[p.status] || p.status,
      'طريقة الدفع': ({ cash: 'كاش', transfer: 'تحويل بنكي', check: 'شيك', card: 'بطاقة' } as any)[p.method || ''] || p.method || '',
      'رقم السند / المرجع': p.reference || '', 'ملاحظات': p.notes || '',
    }),
    parseRow: (row, columns, ctx) => {
      const amount = toNumber(g(row, columns, 'amount'));
      if (!amount || amount <= 0) return { ok: false, error: 'المبلغ مطلوب وأكبر من صفر' };
      const dueDate = toDateStr(g(row, columns, 'dueDate'));
      if (!dueDate) return { ok: false, error: 'تاريخ الاستحقاق مطلوب وغير صالح' };
      const c = findContract(ctx, {
        building: g(row, columns, 'building'),
        unitNumber: g(row, columns, 'unitNumber'),
        tenant: g(row, columns, 'tenant'),
      });
      if (!c) return { ok: false, error: 'لم يتم تحديد العقد — أدخل المستأجر ورقم الوحدة بشكل صحيح (يجب استيراد العقود أولاً)' };
      return { ok: true, data: {
        contractId: c.id, amount, dueDate,
        paidDate: toDateStr(g(row, columns, 'paidDate')) || undefined,
        month: toMonthStr(g(row, columns, 'month')) || undefined,
        status: mapValue(g(row, columns, 'status'), DICTS.paymentStatus) || 'paid',
        method: mapValue(g(row, columns, 'method'), DICTS.payMethod) || 'cash',
        reference: norm(g(row, columns, 'reference')) || undefined,
        notes: norm(g(row, columns, 'notes')) || undefined,
      } };
    },
  },

  // ============ الحركات المالية ============
  transactions: {
    key: 'transactions', label: 'الحركات المالية', sheetName: 'الحركات', apiPath: '/api/transactions',
    ctxNeeds: ['buildings'],
    columns: [
      { key: 'date', header: 'التاريخ', width: 15, example: '2025-01-10', note: 'إجباري' },
      { key: 'type', header: 'النوع', width: 12, example: 'إيراد', note: 'إيراد / مصروف — إجباري' },
      { key: 'category', header: 'البيان', width: 24, example: 'إيجار محل', note: 'إجباري' },
      { key: 'amount', header: 'المبلغ', width: 14, example: '350', note: 'إجباري' },
      { key: 'building', header: 'العمارة', width: 20, example: 'B01', note: 'اختياري' },
      { key: 'account', header: 'رقم الحساب', width: 14, example: '4101', note: 'من شجرة الحسابات (اختياري)' },
      { key: 'cashAccount', header: 'الدفع من / الاستلام في', width: 20, example: 'كاش' },
    ],
    exportRow: (t) => ({
      'التاريخ': t.date || '',
      'النوع': ({ income: 'إيراد', expense: 'مصروف' } as any)[t.type] || t.type,
      'البيان': t.category || '', 'المبلغ': t.amount ?? '',
      'العمارة': t.building?.name || '', 'رقم الحساب': t.account || '',
      'الدفع من / الاستلام في': t.cashAccount || '',
    }),
    parseRow: (row, columns, ctx) => {
      const date = toDateStr(g(row, columns, 'date'));
      if (!date) return { ok: false, error: 'التاريخ مطلوب وغير صالح' };
      const type = mapValue(g(row, columns, 'type'), DICTS.txType);
      if (!type) return { ok: false, error: 'النوع مطلوب: إيراد أو مصروف' };
      const category = norm(g(row, columns, 'category'));
      if (!category) return { ok: false, error: 'البيان مطلوب' };
      const amount = toNumber(g(row, columns, 'amount'));
      if (!amount || amount <= 0) return { ok: false, error: 'المبلغ مطلوب وأكبر من صفر' };
      const bRef = norm(g(row, columns, 'building'));
      const b = bRef ? findBuilding(ctx, bRef) : undefined;
      if (bRef && !b) return { ok: false, error: `العمارة «${bRef}» غير موجودة` };
      return { ok: true, data: {
        date, type, category, amount,
        buildingId: b?.id || undefined,
        account: norm(g(row, columns, 'account')) || undefined,
        cashAccount: norm(g(row, columns, 'cashAccount')) || undefined,
      } };
    },
  },

  // ============ القروض ============
  loans: {
    key: 'loans', label: 'القروض', sheetName: 'القروض', apiPath: '/api/loans',
    ctxNeeds: ['buildings'],
    columns: [
      { key: 'name', header: 'اسم القرض / الجهة', width: 24, example: 'بنك الكويت الوطني', note: 'إجباري' },
      { key: 'principal', header: 'مبلغ القرض', width: 14, example: '50000', note: 'إجباري' },
      { key: 'date', header: 'تاريخ الحصول', width: 15, example: '2025-01-15', note: 'إجباري' },
      { key: 'rate', header: 'الفائدة السنوية %', width: 15, example: '4.5' },
      { key: 'months', header: 'المدة بالأشهر', width: 14, example: '60' },
      { key: 'building', header: 'العمارة', width: 20, example: 'B01', note: 'اختياري' },
    ],
    exportRow: (l) => ({
      'اسم القرض / الجهة': l.name || '', 'مبلغ القرض': l.principal ?? '',
      'تاريخ الحصول': l.date || '', 'الفائدة السنوية %': l.rate ?? '',
      'المدة بالأشهر': l.months ?? '', 'العمارة': l.building?.name || '',
    }),
    parseRow: (row, columns, ctx) => {
      const name = norm(g(row, columns, 'name'));
      if (!name) return { ok: false, error: 'اسم القرض مطلوب' };
      const principal = toNumber(g(row, columns, 'principal'));
      if (!principal || principal <= 0) return { ok: false, error: 'مبلغ القرض مطلوب وأكبر من صفر' };
      const date = toDateStr(g(row, columns, 'date'));
      if (!date) return { ok: false, error: 'تاريخ الحصول مطلوب وغير صالح' };
      const bRef = norm(g(row, columns, 'building'));
      const b = bRef ? findBuilding(ctx, bRef) : undefined;
      if (bRef && !b) return { ok: false, error: `العمارة «${bRef}» غير موجودة` };
      return { ok: true, data: {
        name, principal, date,
        rate: toNumber(g(row, columns, 'rate')) ?? 0,
        months: toInt(g(row, columns, 'months')) ?? 0,
        buildingId: b?.id || undefined,
      } };
    },
  },

  // ============ الصيانة ============
  maintenance: {
    key: 'maintenance', label: 'طلبات الصيانة', sheetName: 'الصيانة', apiPath: '/api/maintenance',
    ctxNeeds: ['buildings', 'units'],
    columns: [
      { key: 'title', header: 'العنوان', width: 24, example: 'تسريب مياه بالمطبخ', note: 'إجباري' },
      { key: 'building', header: 'العمارة', width: 20, example: 'B01' },
      { key: 'unitNumber', header: 'رقم الوحدة', width: 12, example: '101', note: 'اختياري' },
      { key: 'description', header: 'الوصف', width: 30, example: 'تسريب أسفل الحوض' },
      { key: 'category', header: 'التصنيف', width: 12, example: 'سباكة', note: 'سباكة / كهرباء / تكييف / مصعد / مدني / تنظيف / أخرى' },
      { key: 'priority', header: 'الأولوية', width: 12, example: 'عالي', note: 'منخفض / متوسط / عالي / عاجل' },
      { key: 'status', header: 'الحالة', width: 12, example: 'مفتوح', note: 'مفتوح / قيد التنفيذ / مكتمل / ملغي' },
      { key: 'estimatedCost', header: 'التكلفة التقديرية', width: 16, example: '50' },
      { key: 'cost', header: 'التكلفة الفعلية', width: 16, example: '45' },
      { key: 'assignedTo', header: 'مُكلّف بالتنفيذ', width: 18, example: 'ورشة النور' },
    ],
    exportRow: (m) => ({
      'العنوان': m.title || '',
      'العمارة': m.unit?.building?.name || '', 'رقم الوحدة': m.unit?.number || '',
      'الوصف': m.description || '',
      'التصنيف': ({ plumbing: 'سباكة', electrical: 'كهرباء', ac: 'تكييف', elevator: 'مصعد', civil: 'مدني', cleaning: 'تنظيف', other: 'أخرى' } as any)[m.category || ''] || m.category || '',
      'الأولوية': ({ low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل' } as any)[m.priority] || m.priority,
      'الحالة': ({ open: 'مفتوح', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' } as any)[m.status] || m.status,
      'التكلفة التقديرية': m.estimatedCost ?? '', 'التكلفة الفعلية': m.cost ?? '',
      'مُكلّف بالتنفيذ': m.assignedTo || '',
    }),
    parseRow: (row, columns, ctx) => {
      const title = norm(g(row, columns, 'title'));
      if (!title) return { ok: false, error: 'عنوان الطلب مطلوب' };
      let unitId: string | undefined;
      const unitNumber = norm(g(row, columns, 'unitNumber'));
      const bRef = norm(g(row, columns, 'building'));
      if (unitNumber) {
        const u = findUnit(ctx, bRef, unitNumber);
        if (!u) return { ok: false, error: `الوحدة «${unitNumber}» غير موجودة` };
        unitId = u.id;
      }
      return { ok: true, data: {
        title, unitId: unitId || undefined,
        description: norm(g(row, columns, 'description')) || undefined,
        category: mapValue(g(row, columns, 'category'), DICTS.maintCategory) || 'other',
        priority: mapValue(g(row, columns, 'priority'), DICTS.priority) || 'medium',
        status: mapValue(g(row, columns, 'status'), DICTS.maintStatus) || 'open',
        estimatedCost: toNumber(g(row, columns, 'estimatedCost')),
        cost: toNumber(g(row, columns, 'cost')),
        assignedTo: norm(g(row, columns, 'assignedTo')) || undefined,
      } };
    },
  },

  // ============ القيود اليومية (تصدير فقط) ============
  journal: {
    key: 'journal', label: 'القيود اليومية', sheetName: 'القيود', apiPath: '/api/journal',
    ctxNeeds: [],
    columns: [
      { key: 'date', header: 'التاريخ', width: 15, example: '2025-01-10' },
      { key: 'description', header: 'البيان', width: 28, example: 'تحصيل إيجار شقة 101' },
      { key: 'building', header: 'العمارة', width: 20, example: 'B01' },
      { key: 'source', header: 'المصدر', width: 14, example: 'يدوي', note: 'يدوي / تلقائي' },
      { key: 'lines', header: 'القيود (مدين/دائن)', width: 46, example: '1101 مدين 350 | 4101 دائن 350' },
    ],
    exportRow: (j) => ({
      'التاريخ': j.date || '',
      'البيان': j.description || '',
      'العمارة': j.building?.name || '',
      'المصدر': ({ manual: 'يدوي', payment: 'تحصيل إيجار', maintenance: 'مصروف صيانة', loan: 'استلام قرض', loanPayment: 'سداد قرض' } as any)[j.source] || j.source || 'يدوي',
      'القيود (مدين/دائن)': (j.lines || []).map((l: any) => `${l.accountCode} ${l.accountName || ''} ${l.debit > 0 ? `مدين ${l.debit}` : `دائن ${l.credit}`}`).join(' | '),
    }),
    parseRow: () => ({ ok: false, error: 'استيراد القيود غير متاح — القيود تُولّد تلقائيًا من العمليات أو تُدخل يدويًا من صفحة القيود' }),
  },

  // ============ شجرة الحسابات ============
  accounts: {
    key: 'accounts', label: 'الحسابات', sheetName: 'الحسابات', apiPath: '/api/accounts',
    ctxNeeds: [],
    columns: [
      { key: 'code', header: 'رقم الحساب', width: 14, example: '1101', note: 'إجباري — فريد' },
      { key: 'name', header: 'اسم الحساب', width: 26, example: 'النقد بالصندوق', note: 'إجباري' },
      { key: 'type', header: 'النوع', width: 14, example: 'أصول', note: 'أصول / التزامات / حقوق ملكية / إيرادات / مصروفات' },
      { key: 'kind', header: 'التصنيف', width: 14, example: 'فرعي', note: 'فرعي (يُسجل عليه) / رئيسي (تجميعي)' },
      { key: 'parent', header: 'الحساب الأب', width: 14, example: '11', note: 'رقم الحساب الأب' },
    ],
    exportRow: (a) => ({
      'رقم الحساب': a.code || '', 'اسم الحساب': a.name || '',
      'النوع': ({ asset: 'أصول', liability: 'التزامات', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' } as any)[a.type] || a.type,
      'التصنيف': ({ post: 'فرعي', group: 'رئيسي' } as any)[a.kind] || a.kind,
      'الحساب الأب': a.parent || '',
    }),
    parseRow: (row, columns) => {
      const code = norm(g(row, columns, 'code'));
      const name = norm(g(row, columns, 'name'));
      if (!code) return { ok: false, error: 'رقم الحساب مطلوب' };
      if (!name) return { ok: false, error: 'اسم الحساب مطلوب' };
      return { ok: true, data: {
        code, name,
        type: mapValue(g(row, columns, 'type'), DICTS.accType) || 'asset',
        kind: mapValue(g(row, columns, 'kind'), DICTS.accKind) || 'post',
        parent: norm(g(row, columns, 'parent')) || undefined,
      } };
    },
  },
};

// ترتيب الاستيراد الموصى به (يظهر كتلميح في المعالج)
export const IMPORT_ORDER = ['buildings', 'units', 'tenants', 'contracts', 'payments', 'transactions', 'loans', 'maintenance', 'accounts'];

// ---------- قراءة/كتابة الملفات ----------

/** تصدير صفوف إلى ملف xlsx عربي (ورقة RTL) */
export function downloadExcel(rows: Record<string, any>[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  // عرض الأعمدة تلقائيًا
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    ws['!cols'] = headers.map(h => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
      return { wch: Math.min(Math.max(maxLen + 4, 10), 40) };
    });
  }
  ws['!views'] = [{ RTL: true }]; // ورقة عربية من اليمين لليسار
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

/** تنزيل قالب فارغ للكيان: ورقة «اقرأني» إرشادية + صف رؤوس + صف إرشادي + صف مثال */
export function downloadTemplate(entityKey: string) {
  const def = ENTITIES[entityKey];
  if (!def) return;
  const guide = def.columns.map(c => c.note || '');
  const example = def.columns.map(c => c.example || '');
  const ws = XLSX.utils.aoa_to_sheet([
    def.columns.map(c => c.header),
    guide,
    example,
  ]);
  ws['!cols'] = def.columns.map(c => ({ wch: c.width || 16 }));
  ws['!views'] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, def.sheetName.slice(0, 31));
  // ورقة إرشادية ثانية توضح الغرض من القالب وفرقه عن التصدير والاستيراد — لا تُقرأ عند الاستيراد (الاستيراد يقرأ الورقة الأولى فقط)
  const info = [
    [`قالب ${def.label} — اقرأني`],
    [''],
    ['ما هذا الملف؟', `قالب فارغ لتعبئة بيانات ${def.label} بنفسك — أعمدته مطابقة تمامًا لما يقرأه الاستيراد.`],
    ['الفرق بين القالب والتصدير', 'القالب = ملف فارغ تعبئه للاستيراد • التصدير = نسخة ببياناتك الموجودة في النظام (تنفع تعدّلها وترفعها في وضع «تحديث بيانات موجودة»).'],
    ['طريقة الاستخدام', '1) اكتب بياناتك ابتداءً من الصف الرابع، أو امسح صف الإرشاد وصف المثال. 2) لا تغيّر أسماء الأعمدة في الصف الأول ولا ترتيبها. 3) احفظ الملف وارفعه من زر «استيراد» في صفحة ' + def.label + '.'],
    ['صف الإرشاد وصف المثال', 'الصف اللي فيه ملاحظات الأعمدة والصف اللي فيه المثال يتجاهلهم الاستيراد تلقائيًا — تقدر تمسحهم أو تسيبهم.'],
    ['التواريخ', 'تقبل 2025-01-31 أو 31/01/2025'],
    ['الأرقام', 'عادية أو عربية (٠-٩) مع أو بدون فواصل آلاف'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(info);
  wsInfo['!cols'] = [{ wch: 26 }, { wch: 80 }];
  wsInfo['!views'] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'اقرأني'.slice(0, 31));
  XLSX.writeFile(wb, `قالب-${def.label}.xlsx`);
}

/** تصدير بيانات كيان باستخدام تعريفه */
export function exportEntity(entityKey: string, records: any[]) {
  const def = ENTITIES[entityKey];
  if (!def) return;
  const rows = records.map(r => def.exportRow(r));
  downloadExcel(rows, def.sheetName, `${def.label}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** قراءة ملف إكسل وإرجاع صفوف مفتاحها رأس العمود العربي (يتجاهل صف الإرشاد وصف المثال في القالب) */
export async function readExcelFile(file: File, entityKey?: string): Promise<{ rows: Record<string, any>[]; headers: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('الملف فارغ — لا توجد أوراق');
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
  // raw:false يجعل كل الخلايا نصوصًا منسقة؛ نقرأ أيضًا نسخة خام لالتقاط الأرقام التسلسلية للتواريخ:
  const jsonRaw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  const merged = json.map((r, i) => {
    const raw = jsonRaw[i] || {};
    const out: Record<string, any> = {};
    for (const k of Object.keys(r)) {
      out[k] = r[k];
      if (typeof raw[k] === 'number') {
        const formatted = String(r[k] ?? '');
        const isDateLike = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(formatted) || /\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(formatted);
        if (isDateLike) out[k] = raw[k];
      }
    }
    return out;
  });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  const def = entityKey ? ENTITIES[entityKey] : undefined;
  const examples = def ? def.columns.map(c => String(c.example ?? '').trim()) : null;
  const notes = def ? def.columns.map(c => String(c.note ?? '').trim()) : null;
  // صف الإرشاد: قيمه = ملاحظات الأعمدة حرفيًا — يُفلتر بمطابقة خلية-بخلية مهما كان الكيان
  // (الفلتر القديم بالكلمات المفتاحية في أول خلية كان يفشل مع كيانات أول عمود فيها إرشاد بلا كلمة «إجباري/اختياري» مثل الوحدات والعقود)
  const isGuideRow = (r: Record<string, any>) => {
    if (!def || !notes) return false;
    return def.columns.every((c, i) => String(r[c.header] ?? '').trim() === notes[i]);
  };
  const isExampleRow = (r: Record<string, any>) => {
    if (!def || !examples) return false;
    return def.columns.every((c, i) => String(r[c.header] ?? '').trim() === examples[i]);
  };
  // استبعاد صف الإرشاد وصف المثال غير المعدّل والصفوف الفارغة تمامًا من القالب
  const filtered = merged.filter(r => {
    const first = String(r[headers[0]] ?? '');
    if (/إجباري|إجبارى|اختياري|مطلوب/.test(first)) return false;
    if (isGuideRow(r)) return false;
    if (isExampleRow(r)) return false;
    if (def && def.columns.every(c => String(r[c.header] ?? '').trim() === '')) return false;
    return true;
  });
  return { rows: filtered, headers };
}
