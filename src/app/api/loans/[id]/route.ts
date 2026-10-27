import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authMiddleware, canWrite } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authMiddleware(request);
    const { id } = await params;
    const loan = await db.loan.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!loan) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json(loan);
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
    const old = await db.loan.findUnique({ where: { id } });
    const loan = await db.loan.update({ where: { id }, data: body });
    await logAudit(user.id, 'update', 'loan', id, { before: old, after: body }, `تعديل قرض: ${body.name || old?.name}`);
    return NextResponse.json(loan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authMiddleware(request);
    if (!canWrite(user.role, 'loans')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
    const { id } = await params;
    const old = await db.loan.findUnique({ where: { id } });
    await db.loan.delete({ where: { id } });
    await logAudit(user.id, 'delete', 'loan', id, old, `حذف قرض: ${old?.name}`);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'خطأ' }, { status: 400 });
  }
}
