import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { syncLoanPaymentEntry, removeAutoEntry } from '@/lib/accounting';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const payment = await db.loanPayment.findUnique({
      where: { id },
      include: { loan: true },
    });
    if (!payment) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(payment);
  } catch (error: any) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'loans')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const old = await db.loanPayment.findUnique({ where: { id } });
    // تحويل amount للنماذج القديمة إلى principal
    const data: any = { ...body };
    if (data.amount !== undefined && data.principal === undefined && data.interest === undefined) {
      data.principal = Number(data.amount) || 0;
      delete data.amount;
    }
    if (data.principal !== undefined) data.principal = Number(data.principal) || 0;
    if (data.interest !== undefined) data.interest = Number(data.interest) || 0;
    const payment = await db.loanPayment.update({ where: { id }, data });
    await logAudit(user.id, 'update', 'loanPayment', id, { before: old, after: data }, `تعديل سداد قرض`);

    // مزامنة قيد السداد مع التعديل
    let entryWarning: string | null = null;
    try {
      const withLoan = await db.loanPayment.findUnique({ where: { id }, include: { loan: true } });
      if (withLoan) await syncLoanPaymentEntry(db, withLoan);
    } catch (entryErr: any) {
      entryWarning = entryErr?.message || 'تعذر مزامنة قيد السداد';
      console.error('[loan-payments PUT entry]', entryWarning);
    }
    return NextResponse.json({ ...payment, entryWarning });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'loans')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.loanPayment.findUnique({ where: { id } });
    await db.loanPayment.delete({ where: { id } });
    // حذف قيد السداد المرتبط
    try { await removeAutoEntry(db, 'loanPayment', id); } catch (e: any) { console.error('[loan-payments DELETE entry]', e?.message); }
    await logAudit(user.id, 'delete', 'loanPayment', id, old || undefined, `حذف سداد قرض`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
