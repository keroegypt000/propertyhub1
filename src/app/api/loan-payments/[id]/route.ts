import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
    const payment = await db.loanPayment.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'loanPayment', id, { before: old, after: body }, `تعديل سداد قرض`);
    return NextResponse.json(payment);
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
    await logAudit(user.id, 'delete', 'loanPayment', id, old, `حذف سداد قرض`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
