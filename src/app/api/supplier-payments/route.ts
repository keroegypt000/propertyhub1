import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { upsertAutoEntry, resolveCashAccountCode, ACC } from '@/lib/accounting';
import { nextDocNumber } from '@/lib/numbering';

/** دفعات الموردين والمقاولين — كل دفعة تولّد قيد مصروف (مدين حساب المصروف / دائن الصندوق أو البنك) */
export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const payments = await db.supplierPayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true },
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
    // دفعة المورد = سند صرف تسلسلي (ص) من العدّاد المركزي — داخل معاملة الإنشاء
    const payment = await db.$transaction(async (tdb) => tdb.supplierPayment.create({
      data: {
        supplierId,
        amount: Math.round(amount * 1000) / 1000,
        date,
        description: body.description ? String(body.description).trim() : null,
        buildingId: body.buildingId || null,
        method,
        accountCode,
        paymentNo: await nextDocNumber(tdb, 'payment'),
      },
    }));

    // القيد المحاسبي: مدين حساب المصروف / دائن الصندوق أو البنك حسب طريقة الدفع
    let entryWarning: string | null = null;
    try {
      await upsertAutoEntry(db, {
        source: 'supplierPayment',
        sourceId: payment.id,
        date,
        description: `دفعة ${supplier.type === 'contractor' ? 'لمقاول' : 'لمورد'} — ${supplier.name}${payment.description ? ` — ${payment.description}` : ''}`,
        buildingId: payment.buildingId,
        lines: [
          { accountCode, debit: payment.amount },
          { accountCode: resolveCashAccountCode(method), credit: payment.amount },
        ],
      });
    } catch (e: any) {
      entryWarning = e?.message || 'تعذر توليد القيد المحاسبي';
      console.error('[supplier-payment POST entry]', entryWarning);
    }

    await logAudit(user.id, 'create', 'supplierPayment', payment.id, body, `دفعة ${payment.amount} د.ك إلى ${supplier.name}`);
    return NextResponse.json({ ...payment, entryWarning }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
