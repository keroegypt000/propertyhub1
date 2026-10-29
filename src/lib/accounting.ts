// =============================================================
// محرك القيود المحاسبية التلقائية — القيد المزدوج
// كل عملية مالية (تحصيل إيجار / صيانة / قرض) تولّد قيدًا متوازنًا
// يرتبط بمصدرها (source + sourceId) فيُحدَّث تلقائيًا عند التعديل
// ويُحذف تلقائيًا عند إلغاء العملية الأصلية.
// =============================================================
import { DEFAULT_ACCOUNTS } from './defaultAccounts';

// أكواد الحسابات المستخدمة في القيود التلقائية (من الشجرة الافتراضية)
export const ACC = {
  CASH: '1101',        // النقد بالصندوق
  BANK: '1102',        // النقد بالبنك — الحساب الجاري
  CHECKS: '1105',      // شيكات برسم التحصيل
  RENT_INCOME: '4101', // إيرادات إيجار سكني
  MAINTENANCE: '5101', // صيانة وإصلاحات
  LOAN: '2201',        // قروض بنكية — أصل مطلوب السداد
  INTEREST: '5207',    // فوائد ومصاريف قروض
};

export interface RawLine {
  accountCode: string;
  debit?: number;
  credit?: number;
}

export interface JournalLine {
  accountId: string | null;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

// نوع اتصال قاعدة البيانات: PrismaClient أو عميل داخل $transaction
type DB = any;

// تحديد حساب التحصيل حسب طريقة الدفع
export function resolveCashAccountCode(method?: string | null): string {
  if (method === 'transfer' || method === 'card') return ACC.BANK;
  if (method === 'check') return ACC.CHECKS;
  return ACC.CASH;
}

// التحقق من توازن القيد (مدين = دائن) — بتقريب 3 خانات (فلسات الدينار)
export function isBalanced(lines: RawLine[]): boolean {
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const debit = r3(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const credit = r3(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  return debit > 0 && debit === credit;
}

/**
 * التأكد من وجود الحسابات المطلوبة (وجميع حساباتها الأم) في شجرة الحسابات.
 * إن لم توجد تُنشأ من التعريف الافتراضي — فلن يفشل أي قيد تلقائي أبدًا
 * حتى لو لم يقم المستخدم باستيراد الشجرة الافتراضية من الإعدادات.
 * @returns خريطة الكود → { id, name }
 */
export async function ensureAccounts(db: DB, codes: string[]): Promise<Record<string, { id: string; name: string }>> {
  const byCode = new Map(DEFAULT_ACCOUNTS.map(a => [a.code, a]));
  const result: Record<string, { id: string; name: string }> = {};
  const needed = new Set<string>();
  for (const code of codes) {
    let c: string | undefined = code;
    while (c) { needed.add(c); c = byCode.get(c)?.parentCode; }
  }
  // DEFAULT_ACCOUNTS مرتّبة بالأب قبل الابن — نمر عليها بالترتيب
  for (const def of DEFAULT_ACCOUNTS) {
    if (!needed.has(def.code)) continue;
    const existing = await db.account.findUnique({ where: { code: def.code } });
    if (existing) { result[def.code] = { id: existing.id, name: existing.name }; continue; }
    const created = await db.account.create({
      data: {
        code: def.code, name: def.name, type: def.type,
        kind: def.kind, parent: def.parentCode ? (result[def.parentCode]?.id || null) : null,
      },
    });
    result[def.code] = { id: created.id, name: created.name };
  }
  return result;
}

/**
 * إنشاء قيد يومي متوازن تلقائيًا، أو تحديث قيد المصدر الموجود (upsert).
 * يرفض أي قيد غير متوازن أو خالٍ من السطور.
 */
export async function upsertAutoEntry(db: DB, params: {
  source: string;                      // payment | maintenance | loan | loanPayment
  sourceId: string;                    // معرّف العملية الأصلية
  date: string;                        // YYYY-MM-DD
  description: string;
  buildingId?: string | null;
  lines: RawLine[];
}): Promise<void> {
  const { source, sourceId, date, description, buildingId = null, lines } = params;
  const clean = lines.filter(l => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);
  if (!clean.length) throw new Error(`قيد تلقائي (${source}) بلا سطور صالحة`);
  if (!isBalanced(clean)) {
    const d = clean.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = clean.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    throw new Error(`قيد غير متوازن (${source}): مدين ${d} / دائن ${c}`);
  }
  // جلب بيانات الحسابات (id + الاسم) وإنشاء الغائب منها
  const accounts = await ensureAccounts(db, clean.map(l => l.accountCode));
  const journalLines: JournalLine[] = clean.map(l => ({
    accountId: accounts[l.accountCode]?.id || null,
    accountCode: l.accountCode,
    accountName: accounts[l.accountCode]?.name || l.accountCode,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
  }));
  const data = { date, description, buildingId, lines: JSON.stringify(journalLines) };
  const existing = await db.journalEntry.findUnique({
    where: { source_sourceId: { source, sourceId } },
  });
  if (existing) {
    await db.journalEntry.update({ where: { id: existing.id }, data });
  } else {
    await db.journalEntry.create({ data: { ...data, source, sourceId } });
  }
}

/** حذف القيد المرتبط بمصدره (عند حذف/إلغاء العملية الأصلية) */
export async function removeAutoEntry(db: DB, source: string, sourceId: string): Promise<void> {
  await db.journalEntry.deleteMany({ where: { source, sourceId } });
}

/** تحويل نص JSON للسطور إلى مصفوفة بأمان (سطور قديمة أو تالفة تعود []) */
export function parseLines(lines: unknown): JournalLine[] {
  if (Array.isArray(lines)) return lines;
  if (typeof lines === 'string') {
    try { const p = JSON.parse(lines); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

/** وسم مصدر القيد بالعربية للعرض في الواجهة */
export const SOURCE_LABELS: Record<string, string> = {
  manual: 'يدوي',
  payment: 'دفعة إيجار',
  maintenance: 'صيانة',
  loan: 'استلام قرض',
  loanPayment: 'سداد قرض',
};

// =============================================================
// دوال مزامنة القيود مع العمليات الأصلية — تُستدعى من مسارات الـ API
// =============================================================

/**
 * مزامنة قيد تحصيل إيجار مع الدفعة:
 * paid / partial → قيد (مدين الصندوق أو البنك أو الشيكات حسب الطريقة / دائن إيراد إيجار)
 * أي حالة أخرى (pending / overdue / cancelled) → لا قيد (مستحق لم يُحصَّل بعد)
 */
export async function syncPaymentEntry(db: DB, payment: any): Promise<void> {
  if (!['paid', 'partial'].includes(payment.status)) {
    await removeAutoEntry(db, 'payment', payment.id);
    return;
  }
  const contract = await db.contract.findUnique({
    where: { id: payment.contractId },
    include: { unit: true, tenant: true },
  });
  const paidDate = payment.paidDate ? new Date(payment.paidDate) : new Date();
  const date = paidDate.toISOString().slice(0, 10);
  const parts = [
    'تحصيل إيجار',
    contract?.tenant?.name ? `— ${contract.tenant.name}` : '',
    contract?.unit?.number ? `— وحدة ${contract.unit.number}` : '',
    payment.month ? `— عن ${payment.month}` : '',
    payment.reference ? `— مرجع ${payment.reference}` : '',
  ].filter(Boolean);
  await upsertAutoEntry(db, {
    source: 'payment',
    sourceId: payment.id,
    date,
    description: parts.join(' '),
    buildingId: contract?.unit?.buildingId || null,
    lines: [
      { accountCode: resolveCashAccountCode(payment.method), debit: payment.amount },
      { accountCode: ACC.RENT_INCOME, credit: payment.amount },
    ],
  });
}

/**
 * مزامنة قيد مصروف الصيانة مع الطلب:
 * مكتمل بتكلفة > 0 → قيد (مدين 5101 صيانة وإصلاحات / دائن الصندوق — يُدفع نقدًا)
 * غير مكتمل أو بلا تكلفة → لا قيد
 * item يجب أن يحتوي unit (include) لمعرفة العمارة
 */
export async function syncMaintenanceEntry(db: DB, item: any): Promise<void> {
  const cost = Number(item.cost) || 0;
  if (item.status !== 'completed' || cost <= 0) {
    await removeAutoEntry(db, 'maintenance', item.id);
    return;
  }
  const parts = [
    `مصروف صيانة: ${item.title}`,
    item.unit?.number ? `— وحدة ${item.unit.number}` : '',
  ].filter(Boolean);
  await upsertAutoEntry(db, {
    source: 'maintenance',
    sourceId: item.id,
    date: (item.completedAt ? new Date(item.completedAt) : new Date()).toISOString().slice(0, 10),
    description: parts.join(' '),
    buildingId: item.unit?.buildingId || null,
    lines: [
      { accountCode: ACC.MAINTENANCE, debit: cost },
      { accountCode: ACC.CASH, credit: cost },
    ],
  });
}

/**
 * مزامنة قيد استلام القرض مع القرض:
 * الحصول على قرض → نقد دخل البنك: مدين 1102 البنك / دائن 2201 أصل القرض
 */
export async function syncLoanEntry(db: DB, loan: any): Promise<void> {
  const principal = Number(loan.principal) || 0;
  if (principal <= 0) {
    await removeAutoEntry(db, 'loan', loan.id);
    return;
  }
  await upsertAutoEntry(db, {
    source: 'loan',
    sourceId: loan.id,
    date: loan.date,
    description: `استلام قرض: ${loan.name}`,
    buildingId: loan.buildingId || null,
    lines: [
      { accountCode: ACC.BANK, debit: principal },
      { accountCode: ACC.LOAN, credit: principal },
    ],
  });
}

/**
 * مزامنة قيد سداد القسط مع دفعة القرض:
 * مدين 2201 أصل القرض بمقدار principal + مدين 5207 فوائد بمقدار interest
 * دائن 1102 البنك بالإجمالي (الأقساط تُسدَّد تحويلًا بنكيًا)
 * lp يجب أن يحتوي loan (include)
 */
export async function syncLoanPaymentEntry(db: DB, lp: any): Promise<void> {
  const principal = Number(lp.principal) || 0;
  const interest = Number(lp.interest) || 0;
  const total = principal + interest;
  if (total <= 0) {
    await removeAutoEntry(db, 'loanPayment', lp.id);
    return;
  }
  const lines: RawLine[] = [];
  if (principal > 0) lines.push({ accountCode: ACC.LOAN, debit: principal });
  if (interest > 0) lines.push({ accountCode: ACC.INTEREST, debit: interest });
  lines.push({ accountCode: ACC.BANK, credit: total });
  await upsertAutoEntry(db, {
    source: 'loanPayment',
    sourceId: lp.id,
    date: lp.date,
    description: `سداد قرض: ${lp.loan?.name || ''}${lp.notes ? ` — ${lp.notes}` : ''}`,
    buildingId: lp.loan?.buildingId || null,
    lines,
  });
}

/** حذف قيود القرض وكل قيود أقساطه (يُستدعى قبل حذف القرض نفسه) */
export async function removeLoanEntries(db: DB, loanId: string): Promise<void> {
  const lps = await db.loanPayment.findMany({ where: { loanId }, select: { id: true } });
  await removeAutoEntry(db, 'loan', loanId);
  for (const lp of lps) await removeAutoEntry(db, 'loanPayment', lp.id);
}
