import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { upsertAutoEntry, resolveCashAccountCode, recomputeSupplierInvoiceStatus, ACC } from '@/lib/accounting';
import { nextDocNumber } from '@/lib/numbering';

/** دفعات الموردين والمقاولين — مربوطة بالمستحقات: الدفعة على مستحق تقيد على حساب المورد 2101 */
export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const payments = await db.supplierPayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, invoice: true },
    });
    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'suppliers')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const body = await request.json();

    const supplierId = String(body.supplierId || '');
    if (!supplierId) return NextResponse.json({ error: 'المورد مطلوب' }, { status: 400 });
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 400 });
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return NextResponse.json({ error: 'المبلغ يجب أن يكون أكبر من صفر' }, { status: 400 });
    const date = String(body.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    if (isNaN(new Date(date).getTime())) return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 });

    const method = ['cash', 'transfer', 'check', 'card'].includes(body.method) ? body.method : 'cash';
    const accountCode = String(body.accountCode || ACC.MISC_EXPENSE);

    // الدفع على مستحق محدد: التحقق من المتبقي + تحميل العمارة من المستحق تلقائياً
    let invoice: any = null;
    let invoiceId: string | null = null;
    if (body.invoiceId) {
      invoice = await db.supplierInvoice.findUnique({
        where: { id: String(body.invoiceId) },
        include: { payments: { select: { amount: true } } },
      });
      if (!invoice) return NextResponse.json({ error: 'المستحق المحدد غير موجود' }, { status: 400 });
      if (invoice.supplierId !== supplierId) return NextResponse.json({ error: 'المستحق لا يتبع هذا المورد' }, { status: 400 });
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      const paidOnInvoice = r3((invoice.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
      const remaining = r3(invoice.amount - paidOnInvoice);
      if (Math.round(amount * 1000) / 1000 > remaining + 0.0005) {
        return NextResponse.json({ error: `المبلغ أكبر من المتبقي على المستحق ${invoice.invoiceNo || ''} (المتبقي ${remaining} د.ك) — سجّل الفرق كدفعة عامة بدون ربط` }, { status: 400 });
      }
      invoiceId = invoice.id;
    }

    // دفعة المورد = سند صرف تسلسلي (ص) من العدّاد المركزي — داخل معاملة الإنشاء
    const payment = await db.$transaction(async (tdb) => tdb.supplierPayment.create({
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
    }));

    // القيد المحاسبي:
    // دفعة على مستحق → مدين 2101 الذمم الدائنة — الموردون / دائن الصندوق أو البنك (المصروف قُيد عند المستحق نفسه)
    // دفعة عامة بدون مستحق → مدين حساب المصروف من شجرة الحسابات / دائن الصندوق أو البنك
    let entryWarning: string | null = null;
    try {
      await upsertAutoEntry(db, {
        source: 'supplierPayment',
        sourceId: payment.id,
        date,
        description: `دفعة ${supplier.type === 'contractor' ? 'لمقاول' : 'لمورد'} — ${supplier.name}${invoice?.invoiceNo ? ` — سداد ${invoice.invoiceNo}` : ''}${payment.description ? ` — ${payment.description}` : ''}`,
        buildingId: payment.buildingId,
        lines: invoice
          ? [
              { accountCode: ACC.SUPPLIERS, debit: payment.amount },
              { accountCode: resolveCashAccountCode(method), credit: payment.amount },
            ]
          : [
              { accountCode, debit: payment.amount },
              { accountCode: resolveCashAccountCode(method), credit: payment.amount },
            ],
      });
    } catch (e: any) {
      entryWarning = e?.message || 'تعذر توليد القيد المحاسبي';
      console.error('[supplier-payment POST entry]', entryWarning);
    }

    // تحديث حالة سداد المستحق (unpaid/partial/paid)
    if (invoiceId) {
      try { await recomputeSupplierInvoiceStatus(db, invoiceId); } catch (e: any) { console.error('[supplier-payment POST status]', e?.message); }
    }

    await logAudit(user.id, 'create', 'supplierPayment', payment.id, body, `دفعة ${payment.amount} د.ك إلى ${supplier.name}`);
    return NextResponse.json({ ...payment, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
