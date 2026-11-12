import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncPaymentEntry, removeAutoEntry } from '@/lib/accounting';
import { nextDocNumber, isCollectedStatus } from '@/lib/numbering';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const payment = await db.payment.findUnique({ where: { id }, include: { contract: true } });
    if (!payment) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(payment);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'payments')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    // حماية التسلسل: حقول الأرقام التسلسلية لا تُقبل من المستخدم — تُسند آليًا فقط
    const { invoiceNo: _i, receiptNo: _r, ...cleanBody } = body || {};
    const old = await db.payment.findUnique({ where: { id } });
    const payment = await db.payment.update({ where: { id }, data: cleanBody });
    // صارت محصّلة (مدفوع/جزئي) بلا رقم سند قبض → إسناد رقم تسلسلي من العدّاد
    if (isCollectedStatus(payment.status) && !payment.receiptNo) {
      const receiptNo = await nextDocNumber(db, 'receipt');
      await db.payment.update({ where: { id }, data: { receiptNo } }).catch(() => null);
      (payment as any).receiptNo = receiptNo;
    }
    await logAudit(user.id, 'update', 'payment', id, { before: old, after: cleanBody }, `تعديل دفعة`);

    // مزامنة القيد مع الحالة الجديدة (تحديث / إنشاء / حذف حسب الحالة)
    let entryWarning: string | null = null;
    try {
      await syncPaymentEntry(db, payment);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر مزامنة القيد المحاسبي';
      console.error('[payments PUT entry]', entryWarning);
    }
    return NextResponse.json({ ...payment, entryWarning });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'payments')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.payment.findUnique({ where: { id } });
    await db.payment.delete({ where: { id } });
    // حذف القيد المرتبط بالدفعة المحذوفة
    try { await removeAutoEntry(db, 'payment', id); } catch (e: any) { console.error('[payments DELETE entry]', e?.message); }
    await logAudit(user.id, 'delete', 'payment', id, old || undefined, `حذف دفعة`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
