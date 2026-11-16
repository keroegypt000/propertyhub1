import { NextRequest, NextResponse } from 'next/server';
import { db, withDbRetry, ValidationError } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { upsertAutoEntry, resolveCashAccountCode, recomputeSupplierInvoiceStatus, ACC } from '@/lib/accounting';
import { nextDocNumber } from '@/lib/numbering';

/** دفعات الموردين والمقاولين — مربوطة بالمستحقات: الدفعة على مستحق تقيد على حساب المورد 2101 */
/** خطأ المصادقة فقط يرجع 401 — أخطاء قاعدة البيانات ترجع 500 بالرسالة الحقيقية */
function routeError(error: any) {
  if (error?.message === 'غير مصرح') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  console.error('[supplier-payments GET]', error?.message || error);
  return NextResponse.json({ error: `تعذر تحميل دفعات الموردين: ${error?.message || 'خطأ في قاعدة البيانات'}` }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const payments = await withDbRetry(() => db.supplierPayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, invoice: true },
    }));
    return NextResponse.json(payments);
  } catch (error: any) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();

    const supplierId = String(body.supplierId || '');
    if (!supplierId) return NextResponse.json({ error: 'المورد مطلوب' }, { status: 400 });
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
    const date = String(body.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    if (isNaN(new Date(date).getTime())) return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 });
    const method = ['cash', 'transfer', 'check', 'card'].includes(body.method) ? body.method : 'cash';
    const accountCode = String(body.accountCode || ACC.MISC_EXPENSE);

    // العملية كلها داخل معاملة واحدة (اتصال واحد): التحقق من المتبقي + السند التسلسلي + القيد + حالة السداد + التدقيق
    // يقلل ضغط اتصالات قاعدة البيانات في الإنتاج ويضمن الذرية — لا سند بلا قيد ولا دفعة تُحسب مرتين
    // مع إعادة المحاولة تلقائيًا عند أخطاء الاتصالات المؤقتة (ضغط الاتصالات في Supabase)
    const payment = await withDbRetry(() => db.$transaction(async (tdb) => {
      const supplier = await tdb.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw new ValidationError('المورد غير موجود');

      // الدفع على مستحق محدد: التحقق من المتبقي + تحميل العمارة من المستحق تلقائياً
      let invoice: any = null;
      let invoiceId: string | null = null;
      if (body.invoiceId) {
        invoice = await tdb.supplierInvoice.findUnique({
          where: { id: String(body.invoiceId) },
          include: { payments: { select: { amount: true } } },
        });
        if (!invoice) throw new ValidationError('المستحق المحدد غير موجود');
        if (invoice.supplierId !== supplierId) throw new ValidationError('المستحق لا يتبع هذا المورد');
        const r3 = (n: number) => Math.round(n * 1000) / 1000;
        const paidOnInvoice = r3((invoice.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
        const remaining = r3(invoice.amount - paidOnInvoice);
        if (Math.round(amount * 1000) / 1000 > remaining + 0.0005) {
          throw new ValidationError(`المبلغ أكبر من المتبقي على المستحق ${invoice.invoiceNo || ''} (المتبقي ${remaining} د.ك) — سجّل الفرق كدفعة عامة بدون ربط`);
        }
        invoiceId = invoice.id;
      }

      // دفعة المورد = سند صرف تسلسلي (ص) من العدّاد المركزي
      const pay = await tdb.supplierPayment.create({
        data: {
          supplierId,
          amount: Math.round(amount * 1000) / 1000,
          date,
          description: body.description ? String(body.description).trim() : null,
          buildingId: body.buildingId || invoice?.buildingId || null,
          method,
          accountCode,
          invoiceId,
          paymentNo: await nextDocNumber(tdb, 'payment'),
        },
      });

      // القيد المحاسبي داخل المعاملة نفسها:
      // دفعة على مستحق → مدين 2101 الذمم الدائنة — الموردون / دائن الصندوق أو البنك (المصروف قُيد عند المستحق نفسه)
      // دفعة عامة بدون مستحق → مدين حساب المصروف من شجرة الحسابات / دائن الصندوق أو البنك
      await upsertAutoEntry(tdb, {
        source: 'supplierPayment',
        sourceId: pay.id,
        date,
        description: `دفعة ${supplier.type === 'contractor' ? 'لمقاول' : 'لمورد'} — ${supplier.name}${invoice?.invoiceNo ? ` — سداد ${invoice.invoiceNo}` : ''}${pay.description ? ` — ${pay.description}` : ''}`,
        buildingId: pay.buildingId,
        lines: invoice
          ? [
              { accountCode: ACC.SUPPLIERS, debit: pay.amount },
              { accountCode: resolveCashAccountCode(method), credit: pay.amount },
            ]
          : [
              { accountCode, debit: pay.amount },
              { accountCode: resolveCashAccountCode(method), credit: pay.amount },
            ],
      });

      // تحديث حالة سداد المستحق (unpaid/partial/paid)
      if (invoiceId) await recomputeSupplierInvoiceStatus(tdb, invoiceId);
      await logAudit(user.id, 'create', 'supplierPayment', pay.id, body, `دفعة ${pay.amount} د.ك إلى ${supplier.name}`, tdb);
      return pay;
    }));

    return NextResponse.json({ ...payment, entryWarning: null }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[supplier-payments POST]', error?.message || error);
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 500 });
  }
}
